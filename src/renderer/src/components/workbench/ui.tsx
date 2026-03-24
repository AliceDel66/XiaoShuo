import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  PropsWithChildren,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function ShellPanel({
  className,
  children
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-3xl border border-white/6 bg-[#141722]/92 shadow-[0_30px_80px_rgba(0,0,0,0.25)] backdrop-blur",
        className
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
      <div>
        {eyebrow ? <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">{eyebrow}</p> : null}
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function NavButton({
  active,
  label,
  icon,
  onClick
}: {
  active?: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "group relative flex h-12 w-12 items-center justify-center rounded-2xl border transition-all",
        active
          ? "border-cyan-400/40 bg-cyan-500/14 text-cyan-300 shadow-[0_0_0_1px_rgba(56,189,248,0.12)]"
          : "border-transparent bg-transparent text-slate-500 hover:border-white/6 hover:bg-white/5 hover:text-slate-200"
      )}
    >
      {active ? <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-cyan-400" /> : null}
      {icon}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cn(
        "rounded-xl bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cn(
        "rounded-xl border border-white/8 bg-white/4 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={cn(
        "rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/6 hover:text-white disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  helper,
  children
}: PropsWithChildren<{ label: string; helper?: string }>) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {children}
      {helper ? <span className="text-xs text-slate-500">{helper}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60",
        props.className
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/60",
        props.className
      )}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-2xl border border-white/8 bg-[#0d1018] px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60",
        props.className
      )}
    />
  );
}

export function StatusPill({
  tone = "neutral",
  children
}: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger" | "info" }>) {
  const toneClass =
    tone === "success"
      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-300"
      : tone === "warning"
        ? "border-amber-500/30 bg-amber-500/12 text-amber-300"
        : tone === "danger"
          ? "border-rose-500/30 bg-rose-500/12 text-rose-300"
          : tone === "info"
            ? "border-cyan-500/30 bg-cyan-500/12 text-cyan-300"
            : "border-white/8 bg-white/4 text-slate-300";

  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", toneClass)}>{children}</span>;
}

export function EmptyState({
  title,
  detail,
  action
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Metric({
  label,
  value,
  hint
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0d1018] p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-white">{value}</div>
      {hint ? <div className="mt-2 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function SplitLabel({
  title,
  meta
}: {
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-100">{title}</div>
        {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children
}: PropsWithChildren<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
}>) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-y-6 right-6 z-50 w-[460px] max-w-[calc(100vw-2rem)]">
      <div className="flex h-full flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[#0f121b] shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <GhostButton onClick={onClose}>关闭</GhostButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}
