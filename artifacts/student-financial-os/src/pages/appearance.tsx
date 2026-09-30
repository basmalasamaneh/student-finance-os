import { Check, Monitor, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Page, PageHeader, Section } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme } from '@/features/theme/theme-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import { cn } from '@/lib/utils';

/** Accessible segmented radio group — reused for every preference. */
function Choice<T extends string>({ name, value, options, onChange }: { name: string; value: T; options: { value: T; label: string; icon?: ReactNode; lang?: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-3">
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <label
            key={o.value}
            className={cn(
              'relative flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
              checked ? 'border-primary bg-primary-soft font-semibold text-foreground' : 'border-input hover:bg-muted',
            )}
            data-testid={`radio-${name.replace(/\s+/g, '-').toLowerCase()}-${o.value}`}
          >
            <input type="radio" className="sr-only" name={name} value={o.value} checked={checked} onChange={() => onChange(o.value)} />
            {o.icon ? <span className={cn('[&_svg]:size-4', checked ? 'text-primary' : 'text-muted-foreground')} aria-hidden>{o.icon}</span> : null}
            <span lang={o.lang}>{o.label}</span>
            {checked ? <Check className="ms-auto size-4 text-primary" aria-hidden /> : null}
          </label>
        );
      })}
    </div>
  );
}

export default function AppearancePage() {
  const { t, lang, setLang, resetLang } = useI18n();
  const { theme, setTheme, resolved, motion, setMotion, reset: resetTheme } = useTheme();
  const { role, setRole, mode, setMode, reset: resetPreview } = usePreview();
  const { toast } = useToast();

  return (
    <Page>
      <PageHeader eyebrow={t('ap.eyebrow')} title={t('ap.title')} lede={t('ap.lede')} />

      <Section id="theme" title={t('ap.theme')} description={t('ap.themeBody')}>
        <Choice
          name={t('ap.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t('theme.light'), icon: <Sun /> },
            { value: 'dark', label: t('theme.dark'), icon: <Moon /> },
            { value: 'system', label: t('theme.system'), icon: <Monitor /> },
          ]}
        />
        {theme === 'system' ? <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">{t('theme.systemNow', { mode: t(`theme.${resolved}`) })}</p> : null}
      </Section>

      <Section id="language" title={t('ap.lang')} description={t('ap.langBody')}>
        <Choice
          name={t('ap.lang')}
          value={lang}
          onChange={setLang}
          options={[
            { value: 'en', label: t('lang.english'), lang: 'en' },
            { value: 'ar', label: t('lang.arabic'), lang: 'ar' },
          ]}
        />
      </Section>

      <Section id="motion" title={t('ap.motion')} description={t('ap.motionBody')}>
        <Choice
          name={t('ap.motion')}
          value={motion}
          onChange={setMotion}
          options={[
            { value: 'system', label: t('motion.system') },
            { value: 'reduce', label: t('motion.reduce') },
            { value: 'full', label: t('motion.full') },
          ]}
        />
      </Section>

      <Section id="preview" title={t('ap.preview')} description={t('ap.previewBody')}>
        <Choice
          name={t('ap.preview')}
          value={role}
          onChange={setRole}
          options={[
            { value: 'student', label: t('role.student') },
            { value: 'parent', label: t('role.parent') },
            { value: 'admin', label: t('role.admin') },
          ]}
        />
      </Section>

      <Section id="mode" title={t('ap.mode')} description={t('ap.modeBody')}>
        <Choice
          name={t('ap.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'university', label: t('mode.university') },
            { value: 'school', label: t('mode.school') },
          ]}
        />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-divider pt-8">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="size-4 text-success" aria-hidden />
          {t('ap.saved')}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            resetLang();
            resetTheme();
            resetPreview();
            toast({ title: t('ap.resetDone'), description: t('ap.resetDoneBody') });
          }}
          data-testid="button-reset-preferences"
        >
          {t('ap.reset')}
        </Button>
      </div>
    </Page>
  );
}
