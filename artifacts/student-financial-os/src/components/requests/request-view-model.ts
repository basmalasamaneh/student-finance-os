/**
 * Prompt 9 — presentation helpers over the generated DTOs (docs/prompt9-api.md).
 * Status and notification types are the exact backend enums; nothing is guessed.
 */
import type { FamilyMoneyRequest, FamilyMoneyRequestStatus, InAppNotification, InAppNotificationType } from '@workspace/api-client-react';
import type { StatusTone } from '@/components/finance/status-badge';
import type { Tx } from '@/features/money/money-model';

export const STATUS_META: Record<FamilyMoneyRequestStatus, { tone: StatusTone; en: string; ar: string }> = {
  pending: { tone: 'info', en: 'Waiting for review', ar: 'بانتظار المراجعة' },
  details_requested: { tone: 'warning', en: 'Details requested', ar: 'مطلوب تفاصيل' },
  approved: { tone: 'success', en: 'Approved', ar: 'تمت الموافقة' },
  declined: { tone: 'neutral', en: 'Declined', ar: 'مرفوض' },
  cancelled: { tone: 'neutral', en: 'Cancelled', ar: 'ملغى' },
};
export const REQUEST_STATUSES = Object.keys(STATUS_META) as FamilyMoneyRequestStatus[];
export const statusLabel = (s: FamilyMoneyRequestStatus, t: Tx) => t(STATUS_META[s].en, STATUS_META[s].ar);
export const isLive = (r: Pick<FamilyMoneyRequest, 'status'>) => r.status === 'pending' || r.status === 'details_requested';

/** Generic, type-only localized notification text. The server title is neutral fallback only. */
const NOTIFICATION_TEXT: Record<InAppNotificationType, [string, string]> = {
  request: ['New family money request', 'طلب مال عائلي جديد'],
  approval: ['A family request was approved', 'تمت الموافقة على طلب عائلي'],
  decline: ['A family request was declined', 'تم رفض طلب عائلي'],
  ask_details: ['More details were asked on a request', 'طُلبت تفاصيل إضافية حول طلب'],
  reply: ['A request received a reply', 'وصل رد على طلب'],
  allowance_posted: ['An allowance payment was posted', 'تم تسجيل دفعة مصروف'],
  goal_funded: ['A goal received a contribution', 'تلقّى هدف مساهمة'],
  permission_changed: ['Sharing settings changed', 'تغيّرت إعدادات المشاركة'],
};
export const notificationText = (n: InAppNotification, t: Tx) => {
  const pair = NOTIFICATION_TEXT[n.type];
  return pair ? t(pair[0], pair[1]) : n.title;
};

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const SAFE_HREF = new RegExp(`^/(family|family/requests/${UUID}|parent/requests/${UUID}|parent/allowances|goals/${UUID}|goals/fund\\?goalId=${UUID})$`);
/** Accept only the documented application-relative destinations; anything else is not linked. */
export const safeHref = (href: string | undefined) => (href && SAFE_HREF.test(href) ? href : undefined);
