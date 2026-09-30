import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { ShieldCheck } from 'lucide-react';
import { getGetFinanceSummaryQueryKey, useGetFinanceSummary } from '@workspace/api-client-react';
import { Section } from '@/components/layout/page';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useAccount } from '@/features/auth/account';
import { useI18n } from '@/features/i18n/i18n-provider';
import { KIND_LABEL, label, useTx } from '@/features/money/money-model';
import { Cooldown, useDeviceSecurity } from './device-security';
import { PinKeypad } from './pin-keypad';
import { parseThreshold, thresholdText, type IdleMinutes } from './security-state';

export function SecuritySettings() {
  const t = useTx();
  const security = useDeviceSecurity();
  const account = useAccount();
  const [mode, setMode] = useState<'set' | 'change' | 'disable' | null>(null);
  const [privacy, setPrivacy] = useState(false);
  return <Section id="security" title={t('Security', 'الأمان')} description={t('Small controls for your space. Device-only preferences, never a replacement for real login.', 'أدوات بسيطة لمساحتك. تفضيلات خاصة بالجهاز، وليست بديلاً عن تسجيل الدخول الحقيقي.')}>
    <div className="grouped-list">
      <label className="flex min-h-[64px] cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <span><span className="block text-sm font-semibold">{t('Hide balances by default', 'إخفاء الأرصدة افتراضياً')}</span><span className="text-xs text-muted-foreground">{t('Shared with the eye button on Home; saved for this account on this device.', 'مشترك مع زر العين في الرئيسية؛ يُحفظ لهذا الحساب على هذا الجهاز.')}</span></span>
        <span className="grid size-11 shrink-0 place-items-center"><input type="checkbox" className="size-5 accent-primary" data-testid="input-security-hide-balances" checked={security.hideBalances} onChange={(e) => security.setHideBalances(e.target.checked)} /></span>
      </label>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-gold-ink" aria-hidden />{t('App lock', 'قفل التطبيق')}</span>
          <span className="text-sm text-muted-foreground" data-testid="status-device-lock">{security.lockEnabled ? t('On · this device', 'مفعّل · هذا الجهاز') : t('Off', 'غير مفعّل')}</span>
        </div>
        <p className="text-xs text-muted-foreground">{t('Optional 4–6 digit PIN. Only a salted hash is saved locally. This convenience lock cannot protect against someone who controls your browser or device.', 'رمز اختياري من ٤–٦ أرقام. تُحفظ بصمة مشتقة ومملّحة فقط محلياً. هذا القفل لا يحمي من شخص يتحكم بمتصفحك أو جهازك.')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" data-testid="button-security-set-pin" onClick={() => { security.clearError(); setMode(security.lockEnabled ? 'change' : 'set'); }}>{security.lockEnabled ? t('Change PIN', 'تغيير الرمز') : t('Set up PIN', 'إعداد الرمز')}</Button>
          {security.lockEnabled && <>
            <Button variant="outline" data-testid="button-security-lock-now" onClick={security.lockNow}>{t('Lock now', 'القفل الآن')}</Button>
            <Button variant="ghost" data-testid="button-security-disable-pin" onClick={() => { security.clearError(); setMode('disable'); }}>{t('Turn off lock', 'إيقاف القفل')}</Button>
          </>}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <fieldset disabled={!security.lockEnabled}>
          <legend className="mb-2 text-sm font-semibold">{t('Auto-lock after inactivity', 'القفل التلقائي بعد عدم النشاط')}</legend>
          <div className="flex flex-wrap gap-2">
            {([1, 5, 15, 0] as IdleMinutes[]).map((minutes) => <label key={minutes} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${!security.lockEnabled ? 'opacity-50' : 'cursor-pointer'}`}>
              <input type="radio" name="device-idle" value={minutes} checked={security.idleMinutes === minutes} onChange={() => security.setIdleMinutes(minutes)} className="accent-primary" data-testid={`input-security-idle-${minutes}`} />
              {minutes ? t(`${minutes} min`, `${minutes} دقائق`) : t('Never', 'أبداً')}
            </label>)}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">{security.lockEnabled ? t('We’ll ask “Still there?” 20 seconds before locking. Reloading also locks the app.', 'سنسأل «هل ما زلت هنا؟» قبل القفل بـ٢٠ ثانية. إعادة تحميل الصفحة تقفل التطبيق أيضاً.') : t('Enable app lock to choose a timeout.', 'فعّل قفل التطبيق لاختيار المهلة.')}</p>
      </div>
      <div className="flex min-h-[64px] items-center justify-between gap-3 p-4 text-sm">
        <span>{t('Biometric unlock', 'الفتح بالبصمة')}</span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{t('Coming soon', 'قريباً')}</span>
      </div>
      <div className="space-y-1 p-4">
        <h3 className="text-sm font-semibold">{t('Background privacy cover', 'غطاء الخصوصية في الخلفية')}</h3>
        <p className="text-xs text-muted-foreground">{t('A gold-branded cover appears when you leave this tab. Browser and device screenshot behavior varies; screenshot prevention is not guaranteed.', 'يظهر غطاء بهوية ذهبية عند مغادرة التبويب. يختلف سلوك لقطات الشاشة حسب المتصفح والجهاز؛ لا نضمن منعها.')}</p>
      </div>
      <div className="p-4"><ThresholdSetting /></div>
    </div>
    {security.error && !mode && <p role="alert" data-testid="status-security-error" className="mt-3 text-sm text-destructive">{security.error}</p>}
    <div className="mt-6">
      <h3 className="text-sm font-semibold">{t('Recent activity', 'النشاط الأخير')}</h3>
      <p className="mb-2 text-xs text-muted-foreground">{t('Existing simulated transactions, not a security or login audit.', 'معاملات محاكاة موجودة، وليست سجل تدقيق أمان أو تسجيل دخول.')}</p>
      {account.role === 'student' ? <RecentActivity /> : <p className="text-sm text-muted-foreground">{t('Coming soon — no activity source for this account.', 'قريباً — لا يوجد مصدر نشاط لهذا الحساب.')}</p>}
    </div>
    <Button variant="ghost" className="mt-4" data-testid="button-security-privacy-info" onClick={() => setPrivacy(true)}>{t('About your privacy', 'حول خصوصيتك')}</Button>
    {mode && <PinSettingsDialog mode={mode} onClose={() => setMode(null)} />}
    <Dialog open={privacy} onOpenChange={setPrivacy}>
      <DialogContent><DialogHeader>
        <DialogTitle>{t('Your privacy, in plain words', 'خصوصيتك بكلمات بسيطة')}</DialogTitle>
        <DialogDescription>{t('Only you can see your private account details unless you explicitly share access through an available feature.', 'تفاصيل حسابك الخاصة مرئية لك وحدك ما لم تشارك الوصول صراحةً عبر ميزة متاحة.')}</DialogDescription>
      </DialogHeader>
        <p className="text-sm">{t('Residence details use city or area only — never enter an exact address. Device preferences stay in this browser for your signed-in account; they do not change your login, password or server session.', 'تستخدم بيانات السكن المدينة أو المنطقة فقط — لا تدخل عنواناً دقيقاً. تبقى تفضيلات الجهاز في هذا المتصفح لحسابك المسجّل؛ ولا تغيّر الدخول أو كلمة المرور أو جلسة الخادم.')}</p>
        <p className="text-sm text-muted-foreground">{t('All payments here are simulated. Biometric unlock and security audit history are not available. A local PIN is not encryption of account data.', 'جميع المدفوعات هنا محاكاة. الفتح بالبصمة وسجل تدقيق الأمان غير متاحين. الرمز المحلي ليس تشفيراً لبيانات الحساب.')}</p>
        <Button data-testid="button-security-privacy-close" onClick={() => setPrivacy(false)}>{t('Got it', 'فهمت')}</Button>
      </DialogContent>
    </Dialog>
  </Section>;
}

function ThresholdSetting() {
  const t = useTx();
  const security = useDeviceSecurity();
  const [saved, setSaved] = useState(false);
  const form = useForm({ defaultValues: { amount: thresholdText(security.confirmationThreshold.minor) } });
  useEffect(() => { form.reset({ amount: thresholdText(security.confirmationThreshold.minor) }); }, [security.confirmationThreshold.minor, form]);
  return <Form {...form}><form className="space-y-3" onSubmit={form.handleSubmit(({ amount }) => {
    const minor = parseThreshold(amount);
    if (minor === null) { form.setError('amount', { message: t('Enter a nonnegative ILS amount with up to 2 decimal places.', 'أدخل مبلغ شيكل غير سالب بخانتين عشريتين كحد أقصى.') }); return; }
    setSaved(security.setConfirmationThreshold(minor));
  })}>
    <FormField control={form.control} name="amount" render={({ field }) => <FormItem>
      <FormLabel>{t('Review simulated payments above (₪)', 'مراجعة مدفوعات المحاكاة فوق (₪)')}</FormLabel>
      <FormControl><Input {...field} inputMode="decimal" dir="ltr" data-testid="input-security-threshold" onChange={(event) => { setSaved(false); field.onChange(event); }} /></FormControl>
      <FormMessage />
    </FormItem>} />
    <p className="text-xs text-muted-foreground">{t('Default ₪200.00. This threshold applies to ILS; other currencies are reviewed without exchange-rate conversion. No fee, no real money movement.', 'القيمة الافتراضية ٢٠٠٫٠٠ ₪. تنطبق هذه العتبة على الشيكل؛ تُراجع العملات الأخرى دون تحويل سعر الصرف. لا رسوم ولا حركة أموال حقيقية.')}</p>
    <Button type="submit" variant="outline" data-testid="button-security-save-threshold">{t('Save review amount', 'حفظ مبلغ المراجعة')}</Button>
    {saved && <p role="status" className="text-xs text-success">{t('Saved on this device.', 'تم الحفظ على هذا الجهاز.')}</p>}
  </form></Form>;
}

function PinSettingsDialog({ mode, onClose }: { mode: 'set' | 'change' | 'disable'; onClose: () => void }) {
  const t = useTx();
  const security = useDeviceSecurity();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>(mode === 'set' ? 'new' : 'current');
  const [input, setInput] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  const submit = async () => {
    setMessage('');
    if (step === 'current') {
      if (mode === 'disable') {
        if (await security.savePin(null, input)) onClose();
        setInput('');
      } else { setCurrent(input); setInput(''); setStep('new'); }
      return;
    }
    if (step === 'new') { setNext(input); setInput(''); setStep('confirm'); return; }
    if (input !== next) {
      setMessage(t('The PINs did not match. Choose your new PIN again.', 'الرمزان غير متطابقين. اختر الرمز الجديد مجدداً.'));
      setNext(''); setInput(''); setStep('new'); return;
    }
    const saved = await security.savePin(next, current);
    setInput(''); setCurrent(''); setNext('');
    if (saved) onClose();
    else setStep(mode === 'set' ? 'new' : 'current');
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !security.busy) onClose(); }}>
    <DialogContent onEscapeKeyDown={(e) => { if (security.busy) e.preventDefault(); }} onPointerDownOutside={(e) => { if (security.busy) e.preventDefault(); }}>
      <DialogHeader>
        <DialogTitle>{mode === 'disable' ? t('Turn off app lock', 'إيقاف قفل التطبيق') : mode === 'change' ? t('Change device PIN', 'تغيير رمز الجهاز') : t('Set up your device PIN', 'إعداد رمز جهازك')}</DialogTitle>
        <DialogDescription>{t('Device-only convenience. Your real account password stays unchanged.', 'للراحة على هذا الجهاز فقط. لا تتغيّر كلمة مرور حسابك الحقيقية.')}</DialogDescription>
      </DialogHeader>
      <PinKeypad value={input} onChange={setInput} onSubmit={() => void submit()} disabled={security.busy || security.cooldownSeconds > 0}
        label={step === 'current' ? t('Current PIN', 'الرمز الحالي') : step === 'new' ? t('New PIN', 'الرمز الجديد') : t('Confirm new PIN', 'تأكيد الرمز الجديد')}
        submitLabel={security.busy ? t('Saving…', 'جارٍ الحفظ…') : step === 'confirm' ? t('Save PIN', 'حفظ الرمز') : mode === 'disable' ? t('Confirm & turn off', 'تأكيد وإيقاف') : t('Continue', 'متابعة')} />
      <Cooldown seconds={security.cooldownSeconds} />
      {(message || security.error) && <p role="alert" className="text-sm text-destructive">{message || security.error}</p>}
      <Button variant="ghost" data-testid="button-security-pin-cancel" disabled={security.busy} onClick={onClose}>{t('Cancel', 'إلغاء')}</Button>
    </DialogContent>
  </Dialog>;
}

function RecentActivity() {
  const t = useTx();
  const { locale } = useI18n();
  const query = useGetFinanceSummary({ query: { queryKey: getGetFinanceSummaryQueryKey(), staleTime: 15_000, refetchOnWindowFocus: true } });
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">{t('Loading activity…', 'جارٍ تحميل النشاط…')}</p>;
  if (query.isError) return <div role="alert"><p className="text-sm text-destructive">{t('Activity could not be loaded.', 'تعذّر تحميل النشاط.')}</p><Button variant="outline" data-testid="button-security-activity-retry" onClick={() => void query.refetch()}>{t('Retry', 'إعادة المحاولة')}</Button></div>;
  if (!query.data?.recentTransactions.length) return <p className="text-sm text-muted-foreground">{t('No recorded transactions yet. Security audit history: Coming soon.', 'لا معاملات مسجّلة بعد. سجل تدقيق الأمان: قريباً.')}</p>;
  return <ul className="divide-y divide-divider">
    {query.data.recentTransactions.slice(0, 3).map((tx) => <li key={tx.id}>
      <Link href={`/transactions/${tx.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm" data-testid={`link-security-activity-${tx.id}`}>
        <span>{label(KIND_LABEL, tx.kind, t)} <span className="text-xs text-muted-foreground">· {t('Simulated', 'محاكاة')}</span></span>
        <bdi className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString(locale)}</bdi>
      </Link>
    </li>)}
  </ul>;
}