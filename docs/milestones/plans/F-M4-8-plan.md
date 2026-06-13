# Feature Plan: F-M4-8 — Sync Health Alerts (In-App Notifications)

## Overview

Implements in-app notifications for two sync health conditions: (1) N=3 consecutive automatic sync failures for the same entity type, and (2) M=24h of sync silence (no successful automatic sync). Notifications are per-user rows (one per admin per event). A new `Notification` model stores them. A `check_sync_health` management command runs hourly to detect the silence condition. The failure threshold is checked at the end of each sync run. Admins see a bell icon in the app header with an unread count badge. Clicking the bell shows a dropdown of recent unread notifications. A full notification center page is available at `/notifications`.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | New | `Notification` model + migration |
| Backend services | New | `services/notifications/sync_alerts.py` |
| Backend services | Modified | `services/sync/incremental.py` — call `check_failure_threshold` after each entity sync |
| Backend API endpoints | New | 3 endpoints under `/api/v1/notifications/` |
| Backend schemas | New | `schemas/notifications.py` |
| Backend management commands | New | `management/commands/check_sync_health.py` |
| Frontend pages | New | `app/notifications/page.tsx` |
| Frontend components | New | `NotificationBell` (full), `NotificationDropdown`, `NotificationCenterPage` |
| Frontend components | Modified | App header — fully wire `NotificationBell` (shell was added in F-M4-4) |
| Database migrations | Yes | New table `notification` |
| Celery tasks | No | |
| Existing tests | Modified | `incremental.py` tests need to account for `check_failure_threshold` call |
| Documentation | No | |

## High-Level Design (HLD)

**Failure threshold trigger (called from `incremental.py`):**
After each `_sync_entity_incremental` or `_sync_partner_worknode_full` completes (success or failure), call `check_failure_threshold(entity_type, run)`. If the run failed, count the last 3 auto runs for that entity. If all 3 failed → create one `Notification` row per admin.

**Silence trigger (hourly heartbeat cron):**
`check_sync_health` management command calls `check_sync_silence()`. Queries the last successful auto sync. If older than 24h → check no `sync_silent` notification was already created in the last 24h (dedup) → create one `Notification` row per admin.

**Notification model:** Append-only. No soft-delete. Mark-as-read is the only mutation. One row per admin per event (not one global row).

**Frontend:** Bell icon in header (admin-only). Click → dropdown of top-5 unread. "See all" navigates to `/notifications`. Clicking a notification marks it as read.

## Low-Level Design (LLD)

### Backend

#### New model: `sessionops/models/notification.py`

```python
NOTIFICATION_TYPES = [
    ("sync_failure", "Sync failure"),
    ("sync_silent", "Sync silent"),
]

class Notification(models.Model):
    notification_id   = models.BigAutoField(primary_key=True)
    user              = models.ForeignKey("User", on_delete=models.PROTECT, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=NOTIFICATION_TYPES)
    title             = models.CharField(max_length=200)
    body              = models.TextField()
    is_read           = models.BooleanField(default=False)
    read_at           = models.DateTimeField(null=True, blank=True)
    metadata          = models.JSONField(null=True, blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "notification"
        indexes = [
            models.Index(fields=["user", "is_read"]),
            models.Index(fields=["user", "created_at"]),
        ]
```

No soft-delete fields — notifications are append-only.

Register in `sessionops/models/__init__.py`.

#### New service: `sessionops/services/notifications/sync_alerts.py`

```python
def check_failure_threshold(entity_type: str, current_run: SyncRun) -> None:
    """
    Called after each sync run. Creates notifications if 3 consecutive auto failures.
    Only fires for auto runs — manual failures don't count toward the threshold.
    """
    if current_run.status != "failed" or current_run.sync_type != "auto":
        return

    last_three = list(
        SyncRun.objects.filter(entity_type=entity_type, sync_type="auto")
        .order_by("-started_at")[:3]
    )

    if len(last_three) == 3 and all(r.status == "failed" for r in last_three):
        _create_notifications_for_admins(
            notification_type="sync_failure",
            title=f"Sync failed 3 times in a row ({entity_type})",
            body=(
                f"The last 3 automatic sync runs for {entity_type} have all failed. "
                f"Last error: {current_run.error_details or 'unknown'}"
            ),
            metadata={"sync_run_id": current_run.sync_run_id, "entity_type": entity_type},
        )


def check_sync_silence() -> None:
    """
    Called hourly. Creates notifications if no successful auto sync in 24h.
    Deduped: only fires once per 24h window.
    """
    last_success = (
        SyncRun.objects.filter(sync_type="auto", status="success")
        .order_by("-completed_at")
        .first()
    )

    if not last_success:
        return  # Never synced successfully — don't fire (no false alarm on fresh deploy)

    hours_since = (timezone.now() - last_success.completed_at).total_seconds() / 3600

    if hours_since <= 24:
        return

    # Dedup: don't fire again if we already fired in the last 24h
    already_fired = Notification.objects.filter(
        notification_type="sync_silent",
        created_at__gte=timezone.now() - timedelta(hours=24),
    ).exists()

    if not already_fired:
        _create_notifications_for_admins(
            notification_type="sync_silent",
            title="Sync has not run in 24 hours",
            body=(
                f"The last successful automatic sync was {round(hours_since, 1)} hours ago "
                f"(at {last_success.completed_at}). Check the cron job on the production server."
            ),
            metadata={"hours_since_last_success": round(hours_since, 1)},
        )


def _create_notifications_for_admins(notification_type: str, title: str, body: str, metadata: dict) -> None:
    admins = User.objects.filter(
        user_role__icontains="admin",
        is_active=True,
        removed=False,
    )
    Notification.objects.bulk_create([
        Notification(
            user=admin,
            notification_type=notification_type,
            title=title,
            body=body,
            metadata=metadata,
        )
        for admin in admins
    ])
```

Note: Use `bulk_create` to create all admin notifications atomically with a single INSERT.

#### Modified service: `sessionops/services/sync/incremental.py`

After each `_sync_entity_incremental` and `_sync_partner_worknode_full` call, call `check_failure_threshold`:

```python
# After run is saved (success or failure):
from sessionops.services.notifications.sync_alerts import check_failure_threshold
check_failure_threshold(entity_type, run)
```

This must happen outside the entity's `transaction.atomic` block (or in a separate `on_commit` hook) to avoid the notification being rolled back if the transaction fails.

#### New management command: `sessionops/management/commands/check_sync_health.py`

```python
from sessionops.services.notifications.sync_alerts import check_sync_silence

class Command(BaseCommand):
    help = "Check sync health and fire silence notification if needed"

    def handle(self, *args, **options):
        try:
            check_sync_silence()
            self.stdout.write("Sync health check complete.")
        except Exception as e:
            self.stderr.write(f"Health check failed: {e}")
            raise SystemExit(1)
```

#### New schemas: `sessionops/schemas/notifications.py`

```python
class NotificationOut(Schema):
    notification_id: int
    notification_type: str
    title: str
    body: str
    is_read: bool
    read_at: datetime | None
    metadata: dict | None
    created_at: datetime

class UnreadCountOut(Schema):
    count: int
```

#### New API: `sessionops/api/notifications_api.py`

```python
router = Router(tags=["notifications"])

@router.get("/notifications/", response={200: list[NotificationOut]}, auth=jwt_auth)
def list_notifications(request, is_read: bool = None, limit: int = 50):
    qs = Notification.objects.filter(user=request.auth).order_by("-created_at")
    if is_read is not None:
        qs = qs.filter(is_read=is_read)
    return 200, list(qs[:limit])

@router.get("/notifications/unread-count/", response={200: UnreadCountOut}, auth=jwt_auth)
def get_unread_count(request):
    count = Notification.objects.filter(user=request.auth, is_read=False).count()
    return 200, {"count": count}

@router.patch("/notifications/{notification_id}/read/", response={200: NotificationOut}, auth=jwt_auth)
def mark_read(request, notification_id: int):
    notif = get_object_or_404(Notification, notification_id=notification_id, user=request.auth)
    if not notif.is_read:
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=["is_read", "read_at", "updated_at"])
    return 200, notif

@router.post("/notifications/mark-all-read/", response={200: None}, auth=jwt_auth)
def mark_all_read(request):
    Notification.objects.filter(user=request.auth, is_read=False).update(
        is_read=True,
        read_at=timezone.now(),
    )
    return 200, None
```

**RBAC note:** All notification endpoints are scoped to `user=request.auth` — users can only see and modify their own notifications. Admin role check is NOT needed here (a CO could theoretically have a notification in a future feature); for M4, only admins will have any notifications, but the scope filter is still by user FK.

Register router in `urls.py`.

#### Migration

New migration: create `notification` table. No backfill.

### Frontend

#### Modified: `components/layout/NotificationBell.tsx`

Replace the F-M4-4 shell with the real implementation:

```tsx
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const { data: countData, refetch } = useQuery({ queryFn: getUnreadCount, ... });
  const count = countData?.count ?? 0;

  return (
    <div>
      <button onClick={() => setOpen(!open)}>
        <BellIcon />
        {count > 0 && <Badge>{count}</Badge>}
      </button>
      {open && <NotificationDropdown onClose={() => setOpen(false)} onRead={refetch} />}
    </div>
  );
};
```

#### New component: `components/layout/NotificationDropdown.tsx`

- Fetches `GET /notifications/?is_read=false&limit=5` on open
- Lists top 5 unread: title, truncated body, relative timestamp
- Click notification → `PATCH /notifications/{id}/read/` → re-fetch count + dropdown
- "Mark all as read" → `POST /notifications/mark-all-read/`
- "See all" link → `/notifications`
- Empty state: "No unread notifications"

#### New page: `app/notifications/page.tsx`

Renders `<NotificationCenterPage />`.

#### New component: `components/notifications/NotificationCenterPage.tsx`

- Tab filter: All / Unread / Read
- Paginated list: `GET /notifications/?is_read=<filter>&limit=20&offset=<page*20>`
- Each row: title, body snippet, timestamp, read/unread indicator
- Click row → mark as read (PATCH)
- "Mark all as read" button

#### API integration: `lib/api/notifications.ts`

```ts
export const listNotifications = (params?: { is_read?: boolean; limit?: number; offset?: number }) =>
  apiClient.get<NotificationOut[]>("/notifications/", { params });

export const getUnreadCount = () =>
  apiClient.get<UnreadCountOut>("/notifications/unread-count/");

export const markNotificationRead = (id: number) =>
  apiClient.patch<NotificationOut>(`/notifications/${id}/read/`);

export const markAllNotificationsRead = () =>
  apiClient.post("/notifications/mark-all-read/");
```

#### State management

Unread count is a global concern for the bell badge — poll `GET /notifications/unread-count/` every 60s for admin users (can use a simple interval in the header component or React Query's `refetchInterval`).

## Business Rules Enforced

- **Per-user rows:** One notification per admin per event — no global notification rows (uses `bulk_create` loop)
- **Dedup on silence:** `sync_silent` fires at most once per 24h window (checked before creating)
- **Threshold for failure:** Exactly 3 consecutive **auto** failures of the same entity — manual failures excluded
- **Recovery is silent:** No notification when sync recovers — dashboard shows state only
- **Mark-as-read is user-scoped:** `PATCH /notifications/{id}/read/` filters by `user=request.auth` — users can't mark others' notifications

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `GET /notifications/` | JWT required | Scoped to `user=request.auth` |
| `GET /notifications/unread-count/` | JWT required | Scoped to current user |
| `PATCH /notifications/{id}/read/` | JWT required | `get_object_or_404` with `user=request.auth` — 404 if wrong user |
| `POST /notifications/mark-all-read/` | JWT required | Scoped update on `user=request.auth` |

- No write surface beyond `is_read` / `read_at` — notification content is system-generated, not user-supplied
- `notification_id` is an int — Ninja rejects non-integer
- `is_read` query param is a bool — Ninja rejects non-bool values

## Testing Strategy

**Backend unit tests (`tests/services/test_sync_alerts.py`):**
- `test_failure_threshold_creates_notification_when_3_auto_failures_in_a_row`
- `test_failure_threshold_does_not_fire_on_2_failures`
- `test_failure_threshold_ignores_manual_failures`
- `test_failure_threshold_creates_one_row_per_admin`
- `test_failure_threshold_uses_bulk_create`
- `test_sync_silent_fires_when_last_success_over_24h_ago`
- `test_sync_silent_does_not_fire_within_24h_of_previous_alert`
- `test_sync_silent_does_not_fire_when_never_synced`
- `test_recovery_from_failures_does_not_create_notification`

**Backend integration tests (`tests/api/test_notifications_api.py`):**
- `test_list_notifications_returns_own_notifications_only`
- `test_mark_read_updates_is_read_and_read_at`
- `test_mark_read_returns_404_for_other_users_notification`
- `test_mark_all_read_only_affects_current_user`
- `test_unread_count_accurate`
- `test_list_notifications_paginates`

**Frontend component tests:**
- `NotificationBell` shows badge count from API
- `NotificationDropdown` renders top-5 unread, marks read on click
- `NotificationCenterPage` renders all tabs, paginates

**Manual verification:**
- Induce 3 consecutive sync failures (mock Hasura to return 500) → bell badge shows unread count
- Click bell → dropdown shows failure notification
- Click notification → marked as read, badge count decreases
- Trigger recovery (fix mock) → no new notification generated
- Let 25h pass without sync (or advance DB time in test) → `sync_silent` notification appears

## Milestones (implementation order)

1. **`Notification` model + migration** — Model file, register, generate migration. (1 hr)
2. **`sync_alerts.py` service** — `check_failure_threshold`, `check_sync_silence`, `_create_notifications_for_admins`. Unit tests. (3 hr)
3. **Wire into `incremental.py`** — Call `check_failure_threshold` after each entity run. Update incremental tests. (1 hr)
4. **`check_sync_health` management command** — Simple wrapper for `check_sync_silence`. (30 min)
5. **Notification API** — 4 endpoints, schemas, register router. Integration tests. (2 hr)
6. **`NotificationBell` + dropdown** — Full bell component with real API, unread count polling. (2 hr)
7. **Notification center page** — `/notifications` route + `NotificationCenterPage` with tabs + pagination. (2 hr)
8. **Tests** — Frontend component tests. (1 hr)

## Open Questions

- **Admin role filter for `_create_notifications_for_admins`:** The current spec uses `user_role__icontains="admin"`. Confirm the exact role string values used for admins in this project (check `services/auth/role_helpers.py` and the User model). Using `icontains` is a fuzzy match — if the role string is always exact (e.g. `"admin"`, `"functional_lead"`), use an `__in` filter for precision.
- **`check_failure_threshold` + transaction boundary:** The failure check reads the 3 most recent auto runs for the entity. This must happen AFTER the current run's `SyncRun` row is committed (not inside its `transaction.atomic`). Use `transaction.on_commit` to call `check_failure_threshold`, or call it outside the atomic block in `run_incremental_sync`. Decide before implementation.
- **Bell visibility for non-admins:** The bell should be hidden for CO/CHO users entirely. Confirm how `user.role` is available in the frontend header component (likely from the Redux `authSlice`).
- **Pagination offset approach:** The spec uses `offset`-based pagination for the notification center. This is simple but can have drift on live data. For M4, this is acceptable — note as a known limitation.
