'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Tooltip from '@mui/material/Tooltip';
import {
  BookOpen,
  LogOut,
  ChevronDown,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors } from '@/config/design-tokens';
import { useAuth } from '@/hooks/useAuth';
import { NotificationBell } from './NotificationBell';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIDEBAR_W = 220;

const SIDEBAR_BG     = '#FFFFFF';
const SIDEBAR_BORDER = '#E2E8F0';   // slate-200
const TEXT_MUTED     = '#94A3B8';   // slate-400
const TEXT_DEFAULT   = '#64748B';   // slate-500
const TEXT_ACTIVE    = '#0C4A6E';   // sky-900
const ACTIVE_BG      = '#E0F2FE';   // sky-100
const ACTIVE_ICON    = '#0284C7';   // sky-600
const HOVER_BG       = '#F5F3FF';   // violet-50 (light purple hover)
const MAD_RED        = '#E53935';

// ── Nav structure ─────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  match: (p: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Schools',
    href: '/schools',
    icon: BookOpen,
    match: (p) => p.startsWith('/schools'),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function avatarColor(name: string): string {
  const palette = ['#3B82F6', '#8B5CF6', '#0891B2', '#059669', '#D97706'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

// ── Sidebar nav item ──────────────────────────────────────────────────────────

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link href={item.href} style={{ textDecoration: 'none', display: 'block' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.5,
          py: 0.875,
          mx: 1,
          borderRadius: '7px',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.15s ease',
          bgcolor: active ? ACTIVE_BG : 'transparent',
          ...(active && {
            '&::before': {
              content: '""',
              position: 'absolute',
              left: -8,
              top: '25%',
              bottom: '25%',
              width: '3px',
              borderRadius: '0 3px 3px 0',
              bgcolor: MAD_RED,
            },
          }),
          ...(!active && {
            '&:hover': { bgcolor: HOVER_BG },
            '&:hover .nav-label': { color: TEXT_ACTIVE },
            '&:hover .nav-icon': { color: ACTIVE_ICON },
          }),
        }}
      >
        <Icon
          size={16}
          strokeWidth={active ? 2 : 1.75}
          className="nav-icon"
          color={active ? ACTIVE_ICON : TEXT_MUTED}
          style={{ flexShrink: 0, transition: 'color 0.15s ease' }}
        />
        <Typography
          className="nav-label"
          sx={{
            fontSize: '13px',
            fontWeight: active ? 600 : 400,
            color: active ? TEXT_ACTIVE : TEXT_DEFAULT,
            letterSpacing: active ? '-0.01em' : 0,
            transition: 'color 0.15s ease',
          }}
        >
          {item.label}
        </Typography>
      </Box>
    </Link>
  );
}

// ── AppShell ──────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['Function Lead', 'Project Associate', 'Project Lead'];

function isAdminRole(roleStr: string): boolean {
  const roles = roleStr.split(',').map((r) => r.trim());
  return ADMIN_ROLES.some((ar) => roles.includes(ar));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const displayName = user?.name ?? 'User';
  const role = user?.role ?? '';
  const isAdmin = isAdminRole(role);

  // School detail pages use their own layout (workspace sidebar) — bypass AppShell
  const isDetailPage = /^\/schools\/[^/]+/.test(pathname);
  if (isDetailPage) {
    return <>{children}</>;
  }

  async function handleLogout() {
    setMenuAnchor(null);
    await logout();
  }

  const sidebar = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: SIDEBAR_BG,
        borderRight: `1px solid ${SIDEBAR_BORDER}`,
      }}
    >
      {/* ── Logo area ──────────────────────────────────────────────────────── */}
      <Box
        sx={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          px: 2.5,
          borderBottom: `1px solid ${SIDEBAR_BORDER}`,
          flexShrink: 0,
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '7px',
            bgcolor: MAD_RED,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpen size={14} strokeWidth={2} color="#fff" />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>
            Session-Ops
          </Typography>
          <Typography sx={{ fontSize: '10px', color: TEXT_MUTED, letterSpacing: '0.04em', lineHeight: 1.4, mt: 0.125 }}>
            Make a Difference
          </Typography>
        </Box>
      </Box>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1.5 }}>
        <Typography
          sx={{
            fontSize: '10px',
            fontWeight: 600,
            color: TEXT_MUTED,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            px: 2.5,
            mb: 0.75,
          }}
        >
          Menu
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} active={item.match(pathname)} />
          ))}
        </Box>
      </Box>

      {/* ── Bottom: notification bell (admin-only) + user ──────────────────── */}
      {isAdmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, pb: 0.5 }}>
          <NotificationBell />
        </Box>
      )}
      <Box
        sx={{
          borderTop: `1px solid ${SIDEBAR_BORDER}`,
          p: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          borderRadius: '7px',
          m: 1,
          mt: 0,
          transition: 'background 0.15s ease',
          '&:hover': { bgcolor: HOVER_BG },
        }}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
      >
        <Avatar
          sx={{
            width: 30,
            height: 30,
            bgcolor: avatarColor(displayName),
            fontSize: '11px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {userInitials(displayName)}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </Typography>
          {role && (
            <Typography sx={{ fontSize: '10px', color: TEXT_MUTED, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {role}
            </Typography>
          )}
        </Box>
        <ChevronDown size={13} color={TEXT_MUTED} strokeWidth={2} style={{ flexShrink: 0 }} />
      </Box>

      {/* User menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'top' }}
        PaperProps={{
          sx: {
            mb: 0.5,
            minWidth: 200,
            borderRadius: '10px',
            border: `1px solid ${colors.gray[200]}`,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: colors.gray[900] }}>
            {displayName}
          </Typography>
          {role && (
            <Typography sx={{ fontSize: '11px', color: colors.gray[500], mt: 0.25 }}>
              {role}
            </Typography>
          )}
        </Box>
        <Divider />
        {isAdmin && (
          <MenuItem
            component={Link}
            href="/admin"
            onClick={() => setMenuAnchor(null)}
            sx={{ fontSize: '13px', color: colors.gray[700], py: 1, gap: 1 }}
          >
            <ListItemIcon sx={{ minWidth: 'auto' }}>
              <ShieldCheck size={15} color="#0284C7" strokeWidth={1.5} />
            </ListItemIcon>
            Admin
          </MenuItem>
        )}
        <MenuItem
          onClick={() => setMenuAnchor(null)}
          sx={{ fontSize: '13px', color: colors.gray[700], py: 1, gap: 1 }}
          disabled
        >
          <ListItemIcon sx={{ minWidth: 'auto' }}>
            <Settings size={15} color={colors.gray[400]} strokeWidth={1.5} />
          </ListItemIcon>
          Settings
        </MenuItem>
        <MenuItem
          onClick={handleLogout}
          sx={{ fontSize: '13px', color: '#DC2626', py: 1, gap: 1 }}
        >
          <ListItemIcon sx={{ minWidth: 'auto' }}>
            <LogOut size={15} color="#DC2626" strokeWidth={1.5} />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: '#F8FAFC' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: SIDEBAR_W,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: SIDEBAR_W,
            boxSizing: 'border-box',
            border: 'none',
            bgcolor: SIDEBAR_BG,
          },
        }}
      >
        {sidebar}
      </Drawer>

      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>
        {children}
      </Box>
    </Box>
  );
}
