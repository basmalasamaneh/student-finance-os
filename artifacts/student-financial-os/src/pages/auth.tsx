import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { useLogIn, useSignUp, ApiError } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { LanguageToggle, ThemeMenu } from '@/components/shell/shell-controls';
import { BrandMark } from '@/components/shell/app-shell';
import { Check } from 'lucide-react';
import { useI18n } from '@/features/i18n/i18n-provider';

type Values = { name: string; email: string; password: string; role: 'student' | 'parent' };
export default function AuthPage({ signup }: { signup: boolean }) {
  const { lang } = useI18n();
  const text = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const form = useForm<Values>({ defaultValues: { name: '', email: '', password: '', role: 'student' } });
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const success = (completed: boolean) => { qc.clear(); navigate(completed ? '/' : '/onboarding', { replace: true }); qc.invalidateQueries(); };
  const register = useSignUp({ mutation: { onSuccess: (account) => success(account.onboardingCompleted) } });
  const login = useLogIn({ mutation: { onSuccess: (account) => success(account.onboardingCompleted) } });
  const mutation = signup ? register : login;
  const error = mutation.error as ApiError<{ error?: { code?: string } }> | null;
  const code = error?.data && typeof error.data === 'object' && 'error' in error.data ? error.data.error?.code : '';
  const errorLabel = code === 'INVALID_CREDENTIALS' ? text('Invalid email or password.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.') :
    code === 'EMAIL_TAKEN' ? text('This email is already registered.', 'هذا البريد الإلكتروني مسجل بالفعل.') :
    code === 'RATE_LIMITED' ? text('Too many attempts. Try again later.', 'محاولات كثيرة. حاول لاحقاً.') :
    text('Unable to continue. Check your details and try again.', 'تعذّر المتابعة. تحقق من بياناتك وحاول مجدداً.');
  return <main className="min-h-dvh bg-background px-4 py-8 text-foreground sm:px-8">
    <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 pb-5">
      <Link href={signup ? '/login' : '/signup'} className="flex min-h-11 items-center gap-2.5 text-sm font-semibold" data-testid="link-auth-brand"><BrandMark className="size-9" />{text('Student Financial OS', 'نظام الطالب المالي')}</Link>
      <div className="flex items-center"><LanguageToggle /><ThemeMenu /></div>
    </div>
    <div className="mx-auto grid max-w-5xl gap-8 pt-4 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:gap-14 md:pt-16">
      <section className="surface-gold motion-rise relative flex min-w-0 flex-col justify-between gap-8 overflow-hidden p-6 sm:p-8 md:min-h-[26rem]" data-testid="panel-welcome">
        <div className="flex items-center gap-3"><BrandMark className="size-12 [&_.stroke-primary]:stroke-gold-300 [&_.fill-primary]:fill-gold-300 [&_.stroke-background]:stroke-gold-50" /><span className="type-label">{text('YOUR SPACE, YOUR PACE', 'مساحتك، على راحتك')}</span></div>
        <div className="space-y-3">
          <p className="type-display max-w-md" data-testid="text-tagline">{text('More than a wallet. Your financial life, organized.', 'أكثر من محفظة. حياتك المالية منظمة.')}</p>
          <h1 className="type-title">{signup ? text('Begin with the basics.', 'لنبدأ بالأساسيات.') : text('Welcome back.', 'مرحباً بعودتك.')}</h1>
          <p className="type-body max-w-md">{text('Make space for your plans. Your profile is yours to shape, at any time.', 'خطط لمستقبلك براحتك. يمكنك تعديل ملفك الشخصي في أي وقت.')}</p>
        </div>
      </section>
      <div className="motion-rise min-w-0 rounded-card border border-divider bg-surface p-5 shadow-sm sm:p-8">
        <h2 className="type-title mb-6">{signup ? text('Create your account', 'أنشئ حسابك') : text('Sign in', 'تسجيل الدخول')}</h2>
        <Form {...form}><form className="space-y-5" onSubmit={form.handleSubmit((values) => {
          if (signup) register.mutate({ data: { name: values.name.trim(), email: values.email.trim(), password: values.password, role: values.role } });
          else login.mutate({ data: { email: values.email.trim(), password: values.password } });
        })}>
          {signup && <div className="space-y-2"><Label htmlFor="auth-name">{text('Full name', 'الاسم الكامل')}</Label><Input id="auth-name" autoComplete="name" required maxLength={120} {...form.register('name')} /></div>}
          <div className="space-y-2"><Label htmlFor="auth-email">{text('Email', 'البريد الإلكتروني')}</Label><Input id="auth-email" type="email" autoComplete="email" required maxLength={254} dir="ltr" {...form.register('email')} /></div>
          <div className="space-y-2"><Label htmlFor="auth-password">{text('Password', 'كلمة المرور')}</Label><Input id="auth-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} required minLength={signup ? 12 : undefined} maxLength={128} {...form.register('password')} />{signup && <p className="text-xs text-muted-foreground">{text('Use 12–128 characters.', 'استخدم من ١٢ إلى ١٢٨ حرفاً.')}</p>}</div>
          {signup && <fieldset className="space-y-2"><legend className="text-sm font-medium">{text('I am a', 'أنا')}</legend><div className="grid grid-cols-2 gap-3">{(['student','parent'] as const).map(role => <label key={role} className="group relative flex min-h-14 cursor-pointer items-center gap-2 rounded-xl border border-border bg-surface px-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring" data-testid={`option-role-${role}`}><input type="radio" value={role} {...form.register('role')} className="sr-only" /><span className="type-label flex-1">{role === 'student' ? text('Student', 'طالب/ة') : text('Parent or guardian', 'ولي أمر')}</span><Check className="size-4 text-gold-ink opacity-0 transition-opacity group-has-[:checked]:opacity-100" aria-hidden /></label>)}</div></fieldset>}
          {mutation.isError && <p role="alert" className="text-sm text-destructive">{errorLabel}</p>}
          <Button type="submit" className="w-full" loading={mutation.isPending} data-testid="button-auth-submit">{signup ? text('Create account', 'إنشاء الحساب') : text('Sign in', 'تسجيل الدخول')}</Button>
        </form></Form>
        <p className="mt-6 text-sm text-muted-foreground">{signup ? text('Already registered?', 'لديك حساب؟') : text('New here?', 'ليس لديك حساب؟')} <Link className="font-semibold text-gold-ink underline underline-offset-4" href={signup ? '/login' : '/signup'}>{signup ? text('Sign in', 'سجّل الدخول') : text('Create account', 'أنشئ حساباً')}</Link></p>
        <p className="mt-4 border-t border-divider pt-4 text-xs leading-5 text-muted-foreground">{text('Email verification and password reset are not yet available. No email is sent. Contact support if you lose access.', 'التحقق بالبريد وإعادة تعيين كلمة المرور غير متاحين حالياً. لا تُرسل أي رسائل. تواصل مع الدعم عند فقدان الوصول.')}</p>
      </div>
    </div>
  </main>;
}