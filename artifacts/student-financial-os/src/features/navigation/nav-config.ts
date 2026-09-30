import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  Goal,
  GraduationCap,
  Home,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  type LucideIcon,
  MessageCircle,
  Palette,
  Scale,
  Settings,
  ShoppingBag,
  Tags,
  UserRound,
  Users,
  Wallet,
  Map as MapIcon,
} from 'lucide-react';
import type { TranslationKey } from '@/features/i18n/dictionary';

export type NavRole = 'student' | 'parent' | 'admin';
export type NavGroup = 'money' | 'plan' | 'campus' | 'family' | 'oversight' | 'system';

export interface NavItem {
  id: string;
  path: string;
  icon: LucideIcon;
  labelKey: TranslationKey;
  /** Alternate wording when the school institution preview is active. */
  schoolLabelKey?: TranslationKey;
  /** Shorter label used in the mobile bottom bar. */
  mobileLabelKey?: TranslationKey;
  group: NavGroup;
  roles: readonly NavRole[];
  /** false → route renders the shared Not implemented state. */
  implemented: boolean;
  /** Order in the mobile bottom bar (max 5; "More" lives in the header). */
  mobile?: Partial<Record<NavRole, number>>;
}

const ALL: readonly NavRole[] = ['student', 'parent', 'admin'];

/** Single source of truth for routes + navigation. Feature prompts flip `implemented`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'home', path: '/', icon: Home, labelKey: 'nav.home', group: 'money', roles: ALL, implemented: true, mobile: { student: 1, parent: 1, admin: 1 } },
  // Student
  { id: 'money', path: '/money', icon: Wallet, labelKey: 'nav.money', group: 'money', roles: ['student'], implemented: true, mobile: { student: 2 } },
  { id: 'transactions', path: '/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions', mobileLabelKey: 'nav.m.activity', group: 'money', roles: ['student'], implemented: true },
  { id: 'upcoming', path: '/upcoming', icon: CalendarClock, labelKey: 'nav.upcoming', group: 'money', roles: ['student'], implemented: false },
  { id: 'plan', path: '/plan', icon: MapIcon, labelKey: 'nav.plan', group: 'plan', roles: ['student'], implemented: true, mobile: { student: 4 } },
  { id: 'goals', path: '/goals', icon: Goal, labelKey: 'nav.goals', group: 'plan', roles: ['student'], implemented: true, mobile: { student: 5 } },
  { id: 'afford', path: '/afford', icon: Scale, labelKey: 'nav.afford', group: 'plan', roles: ['student'], implemented: false },
  { id: 'campus', path: '/campus', icon: ShoppingBag, labelKey: 'nav.campus', schoolLabelKey: 'nav.campus.school', mobileLabelKey: 'nav.group.campus', group: 'campus', roles: ['student'], implemented: true, mobile: { student: 3 } },
  { id: 'assistant', path: '/assistant', icon: MessageCircle, labelKey: 'nav.assistant', group: 'campus', roles: ['student'], implemented: false },
  { id: 'family', path: '/family', icon: HeartHandshake, labelKey: 'nav.family', group: 'family', roles: ['student'], implemented: false },
  // Parent
  { id: 'children', path: '/parent/children', icon: Users, labelKey: 'nav.children', group: 'family', roles: ['parent'], implemented: false, mobile: { parent: 2 } },
  { id: 'allowances', path: '/parent/allowances', icon: Wallet, labelKey: 'nav.allowance', group: 'family', roles: ['parent'], implemented: false, mobile: { parent: 3 } },
  { id: 'requests', path: '/parent/requests', icon: Inbox, labelKey: 'nav.requests', group: 'family', roles: ['parent'], implemented: false, mobile: { parent: 4 } },
  { id: 'parent-goals', path: '/goals/fund', icon: Goal, labelKey: 'nav.fundGoal', group: 'family', roles: ['parent'], implemented: true, mobile: { parent: 5 } },
  // Admin
  { id: 'admin-dashboard', path: '/admin', icon: LayoutDashboard, labelKey: 'nav.dashboard', group: 'oversight', roles: ['admin'], implemented: false, mobile: { admin: 2 } },
  { id: 'admin-users', path: '/admin/users', icon: UserRound, labelKey: 'nav.users', group: 'oversight', roles: ['admin'], implemented: false, mobile: { admin: 3 } },
  { id: 'admin-students', path: '/admin/students', icon: GraduationCap, labelKey: 'nav.students', group: 'oversight', roles: ['admin'], implemented: false, mobile: { admin: 4 } },
  { id: 'admin-parents', path: '/admin/parents', icon: Users, labelKey: 'nav.parents', group: 'oversight', roles: ['admin'], implemented: false },
  { id: 'admin-transactions', path: '/admin/transactions', icon: ArrowLeftRight, labelKey: 'nav.transactions', mobileLabelKey: 'nav.m.activity', group: 'oversight', roles: ['admin'], implemented: false, mobile: { admin: 5 } },
  { id: 'admin-institutions', path: '/admin/institutions', icon: Building2, labelKey: 'nav.institutions', schoolLabelKey: 'nav.institutions.school', group: 'oversight', roles: ['admin'], implemented: true },
  { id: 'admin-categories', path: '/admin/categories', icon: Tags, labelKey: 'nav.categories', group: 'oversight', roles: ['admin'], implemented: false },
  { id: 'admin-settings', path: '/admin/settings', icon: Settings, labelKey: 'nav.settings', group: 'oversight', roles: ['admin'], implemented: false },
  // Foundation (all roles)
  { id: 'foundation', path: '/foundation', icon: LayoutGrid, labelKey: 'nav.foundation', group: 'system', roles: ALL, implemented: true },
  { id: 'appearance', path: '/appearance', icon: Palette, labelKey: 'nav.appearance', group: 'system', roles: ALL, implemented: true },
];

export const GROUP_LABEL: Record<NavGroup, TranslationKey> = {
  money: 'nav.group.money',
  plan: 'nav.group.plan',
  campus: 'nav.group.campus',
  family: 'nav.group.family',
  oversight: 'nav.group.oversight',
  system: 'nav.group.system',
};

export function itemsForRole(role: NavRole) {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function mobileItemsForRole(role: NavRole) {
  return itemsForRole(role)
    .filter((i) => i.mobile?.[role] !== undefined)
    .sort((a, b) => (a.mobile![role]! - b.mobile![role]!));
}

export function groupedForRole(role: NavRole) {
  const groups = new Map<NavGroup, NavItem[]>();
  for (const item of itemsForRole(role)) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }
  return [...groups.entries()];
}

export function isActive(item: NavItem, location: string) {
  return item.path === '/' ? location === '/' : location === item.path || location.startsWith(`${item.path}/`);
}
