import { Eye, Languages, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/features/i18n/i18n-provider';
import { useTheme, type ThemePreference } from '@/features/theme/theme-provider';
import { usePreview } from '@/features/preferences/preview-provider';
import type { NavRole } from '@/features/navigation/nav-config';
import { cn } from '@/lib/utils';

export function LanguageToggle({ className }: { className?: string }) {
  const { t, lang, setLang } = useI18n();
  const next = lang === 'en' ? 'ar' : 'en';
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('gap-2 text-muted-foreground hover:text-foreground', className)}
      onClick={() => setLang(next)}
      aria-label={`${t('lang.label')}: ${t('lang.switchTo')}`}
      lang={next}
      data-testid="button-toggle-language"
    >
      <Languages aria-hidden />
      <span className={next === 'ar' ? 'font-arabic' : undefined}>{t('lang.switchTo')}</span>
    </Button>
  );
}

const themeIcons: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export function ThemeMenu() {
  const { t } = useI18n();
  const { theme, resolved, setTheme } = useTheme();
  const Icon = themeIcons[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label={`${t('theme.label')}: ${t(`theme.${theme}`)}`} data-testid="button-theme-menu">
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{t('theme.label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
          {(['light', 'dark', 'system'] as const).map((opt) => {
            const I = themeIcons[opt];
            return (
              <DropdownMenuRadioItem key={opt} value={opt} className="gap-2" data-testid={`option-theme-${opt}`}>
                <I className="size-4 text-muted-foreground" aria-hidden />
                {t(`theme.${opt}`)}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
        {theme === 'system' ? (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t('theme.systemNow', { mode: t(`theme.${resolved}`) })}</p>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Role navigation PREVIEW. Explicitly not authentication. */
export function RolePreviewMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { role, setRole } = usePreview();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed"
          aria-label={`${t('preview.label')}: ${t(`role.${role}`)}`}
          data-testid="button-role-preview"
        >
          <Eye aria-hidden />
          {compact ? null : <span className="text-muted-foreground">{t('preview.label')}</span>}
          <span className="font-semibold">{t(`role.${role}`)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
          <span className="text-sm font-semibold">{t('preview.label')}</span>
          <span className="text-xs leading-5 text-muted-foreground">{t('preview.hint')}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as NavRole)}>
          {(['student', 'parent', 'admin'] as const).map((r) => (
            <DropdownMenuRadioItem key={r} value={r} data-testid={`option-role-${r}`}>
              {t(`role.${r}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
