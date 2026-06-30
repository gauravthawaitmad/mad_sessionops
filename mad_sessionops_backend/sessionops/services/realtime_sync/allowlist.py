# Roles whose users are actively managed in Session-Ops (insert + update flows)
ACTIVE_ROLES: frozenset[str] = frozenset(
    {
        "Youth",
        "Wingman",
        "Project Associate",
        "Fellow",
        "CHO",
        "CO Part Time",
        "Function Lead",
        "CO Full Time",
        "Academic Support",
        "Admin",
        "Project Lead",
    }
)

# Roles (or None) that trigger user deactivation
DEACTIVATE_ROLES: frozenset = frozenset({"Alumni", None})


def classify_event(event_type: str, incoming_role: str | None) -> str:
    """
    Classify the incoming sync event as one of:
      "insert" | "update" | "deactivate" | "skipped"

    The role allowlist takes precedence over the event_type hint from the caller.
    """
    if incoming_role in DEACTIVATE_ROLES:
        return "deactivate"
    if incoming_role in ACTIVE_ROLES:
        if event_type == "insert":
            return "insert"
        return "update"
    return "skipped"
