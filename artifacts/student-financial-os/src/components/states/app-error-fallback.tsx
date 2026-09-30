import { Home, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-provider';
import type { ErrorFallbackProps } from '@/components/error-boundary';

/** Localized error boundary fallback. Works outside providers (falls back to English). */
export function AppErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] w-full max-w-2xl flex-col justify-center gap-5 px-6 py-16">
      <p className="type-label font-medium tracking-wide text-destructive">{t('err.eyebrow')}</p>
      <h1 className="text-3xl font-semibold tracking-tight">{t('err.title')}</h1>
      <p className="max-w-lg type-body text-muted-foreground">{t('err.body')}</p>
      {import.meta.env.DEV ? (
        <details className="max-w-lg type-label font-normal text-muted-foreground">
          <summary className="cursor-pointer">{t('err.details')}</summary>
          <pre dir="ltr" className="mt-3 overflow-x-auto rounded-md bg-muted p-3 text-start type-caption">{error.message || String(error)}</pre>
        </details>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button onClick={resetError} data-testid="button-error-retry">
          <RotateCw aria-hidden />
          {t('err.retry')}
        </Button>
        <Button variant="outline" onClick={() => { window.location.href = import.meta.env.BASE_URL; }} data-testid="button-error-home">
          <Home aria-hidden />
          {t('err.home')}
        </Button>
      </div>
    </div>
  );
}
