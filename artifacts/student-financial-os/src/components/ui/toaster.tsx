import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/** Status icon inferred from variant: destructive → alert, success → check, default → info (gold). */
export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const v = props.variant ?? 'default';
        const Icon = v === 'destructive' ? AlertTriangle : v === 'success' ? CheckCircle2 : Info;
        return (
          <Toast key={id} {...props}>
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full',
                v === 'destructive' ? 'bg-destructive-soft text-destructive' : v === 'success' ? 'bg-success-soft text-success' : 'bg-primary-soft text-gold-ink',
              )}
            >
              <Icon className="size-[18px]" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
