import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';

// Componentes base de la interfaz. Estilo con Tailwind y los colores del tema.

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-acento text-acento-texto hover:brightness-110',
  secondary: 'bg-elevado text-texto border border-borde hover:border-texto-suave',
  ghost: 'text-texto-suave hover:text-texto hover:bg-elevado',
  danger: 'bg-peligro/15 text-peligro hover:bg-peligro/25',
};

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-texto-suave transition hover:bg-elevado hover:text-texto disabled:opacity-40',
        className,
      )}
      {...props}
    />
  );
}

const fieldBase =
  'rounded-xl border border-borde bg-fondo px-3 py-2 text-sm placeholder:text-texto-suave/70 focus:border-acento focus:outline-none';

/** Ancho completo salvo que la clase ya indique un ancho (w-20, w-auto…). */
function fieldClass(className: string | undefined, ...extra: string[]): string {
  return cx(fieldBase, !/(^|\s)w-/.test(className ?? '') && 'w-full', ...extra, className);
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={fieldClass(className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={fieldClass(className, 'min-h-20 resize-y')} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={fieldClass(className, 'appearance-auto')} {...props} />;
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-texto-suave uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-texto-suave">{hint}</span>}
    </label>
  );
}

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-acento bg-acento-suave text-acento'
          : 'border-borde text-texto-suave hover:border-texto-suave hover:text-texto',
        className,
      )}
      {...props}
    />
  );
}

/** Grupo de opciones excluyentes (pestañas pequeñas). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx('inline-flex rounded-xl border border-borde bg-fondo p-1', className)}
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition',
            o.value === value
              ? 'bg-elevado text-texto shadow-sm'
              : 'text-texto-suave hover:text-texto',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-2xl border border-borde bg-superficie', className)}>
      {children}
    </section>
  );
}

export function ProgressBar({
  value,
  color = 'bg-acento',
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-elevado', className)}>
      <div
        className={cx('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">
        {icon}
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-texto-suave">{children}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-texto-suave">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Diálogo modal: hoja inferior en móvil, ventana centrada en escritorio. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cx(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-3xl border border-borde bg-superficie shadow-2xl',
            'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[85vh] md:w-full md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl',
            wide ? 'md:max-w-2xl' : 'md:max-w-lg',
          )}
        >
          <div className="flex items-center justify-between border-b border-borde px-5 py-3.5">
            <RadixDialog.Title className="text-base font-semibold">{title}</RadixDialog.Title>
            <RadixDialog.Close asChild>
              <IconButton label="Cerrar">
                <X size={18} />
              </IconButton>
            </RadixDialog.Close>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Casilla redonda para completar. */
export function CheckCircle({
  checked,
  onChange,
  label,
  color,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={cx(
        'grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
        checked ? 'border-acento bg-acento text-acento-texto' : 'hover:bg-elevado',
      )}
      style={!checked && color ? { borderColor: color } : undefined}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
