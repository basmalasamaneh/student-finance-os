import { Link } from 'wouter';
import { BookOpen, HandCoins, HeartHandshake, PiggyBank, Receipt, Wallet } from 'lucide-react';
import { HomeBlock, type T } from './home-primitives';

/** Prompt 10: school students' prominent shortcuts — family requests, parent links, savings, expenses, Learn. */
export function SchoolLinks({ t }: { t: T }) {
  const items = [
    { href: '/family/requests', icon: HandCoins, label: t('Ask family', 'اطلب من العائلة'), id: 'family-requests' },
    { href: '/family', icon: HeartHandshake, label: t('Parent links', 'روابط الأهل'), id: 'family' },
    { href: '/goals', icon: PiggyBank, label: t('Savings', 'الادخار'), id: 'goals' },
    { href: '/transactions', icon: Receipt, label: t('Expenses', 'المصروفات'), id: 'transactions' },
    { href: '/plan', icon: Wallet, label: t('Budget', 'الميزانية'), id: 'plan' },
    { href: '/learn', icon: BookOpen, label: t('Learn', 'تعلّم'), id: 'learn' },
  ];
  return (
    <HomeBlock id="school-links" title={t('Your school money', 'مالك المدرسي')}>
      <nav aria-label={t('School shortcuts', 'اختصارات المدرسة')} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.map(({ href, icon: Icon, label, id }) => (
          <Link key={id} href={href} data-testid={`link-school-${id}`} className="flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-card border border-border bg-surface p-2 text-center transition-colors hover:border-primary">
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-gold-ink"><Icon className="size-[18px]" aria-hidden /></span>
            <span className="type-caption font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </HomeBlock>
  );
}
