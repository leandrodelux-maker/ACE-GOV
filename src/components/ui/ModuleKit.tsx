/**
 * Componentes reutilizáveis dos módulos LIRAa/LIA e Zoonoses, no padrão visual do
 * Endemias GOV (teal/slate, cantos arredondados, tipografia compacta).
 *
 * Campos usam fonte de 16px no celular (evita zoom automático do iOS) e altura
 * mínima de 44px para toque. Gráficos seguem a skill de dataviz: barras finas
 * (≤ 24px), rótulo de valor na ponta em texto neutro, uma cor por série
 * (#2a78d6 / #eb6834, paleta validada para daltonismo) e legenda quando há 2 séries.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, Info, Loader2, Search, X } from 'lucide-react';
import { ExportFormat, ReportDocument, exportReport } from '../../services/reportExport';

export const SERIES_COLORS = ['#2a78d6', '#eb6834'] as const;

const inputBase =
  'w-full min-h-11 sm:min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 disabled:bg-slate-100 disabled:text-slate-500';

// ----------------------------------------------------------------------------
// Formulário
// ----------------------------------------------------------------------------
export const Field: React.FC<{ label: string; hint?: string; error?: string; required?: boolean; children: (id: string) => React.ReactNode; className?: string }> = ({
  label, hint, error, required, children, className = '',
}) => {
  const id = useId();
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
        {label}
        {required && <span className="text-rose-600" aria-hidden="true"> *</span>}
      </label>
      {children(id)}
      {hint && !error && <p className="text-[11px] text-slate-500">{hint}</p>}
      {error && <p className="text-[11px] font-medium text-rose-700" role="alert">{error}</p>}
    </div>
  );
};

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...props }, ref) => (
  <input ref={ref} className={`${inputBase} ${className}`} {...props} />
));
TextInput.displayName = 'TextInput';

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = '', children, ...props }) => (
  <select className={`${inputBase} ${className}`} {...props}>
    {children}
  </select>
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = '', ...props }) => (
  <textarea className={`${inputBase} min-h-20 ${className}`} {...props} />
);

/** Contador +/− para quantidades em campo (toque fácil). */
export const Stepper: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }> = ({ value, onChange, min = 0, max = 999, label }) => (
  <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white" role="group" aria-label={label}>
    <button type="button" className="h-11 w-11 text-lg font-bold text-slate-700 disabled:text-slate-300" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`}>−</button>
    <input
      type="number"
      inputMode="numeric"
      className="h-11 w-14 border-x border-slate-200 text-center text-base font-semibold text-slate-900"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.trunc(n))));
      }}
      aria-label={label}
    />
    <button type="button" className="h-11 w-11 text-lg font-bold text-slate-700 disabled:text-slate-300" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`}>+</button>
  </div>
);

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
const BUTTON_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-teal-800 text-white hover:bg-teal-900 disabled:bg-slate-300',
  secondary: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 disabled:bg-slate-300',
  ghost: 'text-teal-800 hover:bg-teal-50 disabled:text-slate-400',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean; icon?: React.ElementType }> = ({
  variant = 'primary', loading, icon: Icon, children, className = '', disabled, ...props
}) => (
  <button
    type="button"
    className={`inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed ${BUTTON_CLASSES[variant]} ${className}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
    {children}
  </button>
);

// ----------------------------------------------------------------------------
// Estados e mensagens
// ----------------------------------------------------------------------------
export type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
const TONE: Record<Tone, string> = {
  info: 'bg-sky-50 text-sky-900 border-sky-200',
  success: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  warning: 'bg-amber-50 text-amber-900 border-amber-200',
  danger: 'bg-rose-50 text-rose-900 border-rose-200',
  neutral: 'bg-slate-50 text-slate-800 border-slate-200',
};
const TONE_ICON: Record<Tone, React.ElementType> = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertTriangle, neutral: Info };

export const Notice: React.FC<{ tone?: Tone; title?: string; children?: React.ReactNode; onClose?: () => void }> = ({ tone = 'info', title, children, onClose }) => {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`flex gap-2.5 rounded-lg border p-3 text-sm ${TONE[tone]}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-[13px] leading-relaxed">{children}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="shrink-0 rounded p-1 hover:bg-black/5" aria-label="Fechar aviso">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export const StatusPill: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}>{children}</span>
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({ title, description, action }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <p className="text-sm font-semibold text-slate-800">{title}</p>
    {description && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Carregando…' }) => (
  <p className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
  </p>
);

/** Carrega dados com estados de carregamento e erro. */
export function useAsync<T>(fn: () => Promise<T>, deps: React.DependencyList): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e?.message || 'Não foi possível carregar.'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}

// ----------------------------------------------------------------------------
// Diálogo
// ----------------------------------------------------------------------------
export const Dialog: React.FC<{ open: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }> = ({
  open, title, onClose, children, footer, wide,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-xl outline-none sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Tabela com pesquisa e paginação
// ----------------------------------------------------------------------------
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** texto usado na pesquisa e na ordenação */
  text?: (row: T) => string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, pageSize = 25, searchable = true, searchPlaceholder = 'Pesquisar…', emptyText = 'Sem registros.', onRowClick, toolbar, caption }: {
  rows: T[];
  columns: Column<NoInfer<T>>[];
  rowKey: (row: NoInfer<T>) => string;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  onRowClick?: (row: NoInfer<T>) => void;
  toolbar?: React.ReactNode;
  caption?: string;
}) {
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      columns.some((c) => {
        const v = c.text ? c.text(r) : String((r as any)[c.key] ?? '');
        return v.toLowerCase().includes(t);
      })
    );
  }, [rows, columns, term]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);
  useEffect(() => setPage(0), [term, rows]);

  return (
    <div className="space-y-2">
      {(searchable || toolbar) && (
        <div className="flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative min-w-48 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                className={`${inputBase} pl-9`}
                placeholder={searchPlaceholder}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                aria-label={searchPlaceholder}
              />
            </div>
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slice.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">{emptyText}</td>
              </tr>
            ) : (
              slice.map((r) => (
                <tr
                  key={rowKey(r)}
                  className={onRowClick ? 'cursor-pointer hover:bg-slate-50 focus-within:bg-slate-50' : ''}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onRowClick(r)) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-3 py-2.5 align-top text-slate-700 ${c.align === 'right' ? 'text-right tabular-nums' : c.align === 'center' ? 'text-center' : ''} ${c.className || ''}`}>
                      {c.render ? c.render(r) : String((r as any)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {current * pageSize + 1}–{Math.min(filtered.length, (current + 1) * pageSize)} de {filtered.length}
          </span>
          <div className="flex gap-1">
            <button type="button" className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Próxima página">
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Exportação
// ----------------------------------------------------------------------------
export const ExportMenu: React.FC<{ build: () => ReportDocument | Promise<ReportDocument>; disabled?: boolean }> = ({ build, disabled }) => {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (f: ExportFormat) => {
    setBusy(f);
    setError(null);
    try {
      await exportReport(f, await build());
    } catch (e: any) {
      setError(e?.message || 'Falha ao gerar o arquivo.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" icon={FileText} loading={busy === 'pdf'} disabled={disabled || !!busy} onClick={() => run('pdf')}>PDF</Button>
      <Button variant="secondary" icon={FileSpreadsheet} loading={busy === 'xlsx'} disabled={disabled || !!busy} onClick={() => run('xlsx')}>Excel</Button>
      <Button variant="secondary" icon={Download} loading={busy === 'csv'} disabled={disabled || !!busy} onClick={() => run('csv')}>CSV</Button>
      {error && <span className="text-xs text-rose-700" role="alert">{error}</span>}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Gráficos
// ----------------------------------------------------------------------------
export interface BarDatum {
  label: string;
  value: number;
  /** texto exibido na ponta (padrão: valor) */
  display?: string;
  /** texto do tooltip */
  detail?: string;
}

/** Barras horizontais de série única (magnitude por categoria). */
export const BarList: React.FC<{ data: BarDatum[]; max?: number; color?: string; emptyText?: string; ariaLabel: string }> = ({
  data, max, color = SERIES_COLORS[0], emptyText = 'Sem dados no período.', ariaLabel,
}) => {
  const top = max ?? Math.max(0, ...data.map((d) => d.value));
  if (!data.length || top <= 0) return <p className="py-4 text-xs text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(6rem,38%)_1fr] items-center gap-3 text-xs" title={d.detail || `${d.label}: ${d.display ?? d.value.toLocaleString('pt-BR')}`}>
          <span className="truncate text-slate-700">{d.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 rounded-r-[4px]" style={{ width: `${Math.max(1.5, (d.value / top) * 100)}%`, maxWidth: 'calc(100% - 3.5rem)', backgroundColor: color }} aria-hidden="true" />
            <span className="shrink-0 font-semibold tabular-nums text-slate-800">{d.display ?? d.value.toLocaleString('pt-BR')}</span>
          </span>
        </li>
      ))}
    </ul>
  );
};

export interface ColumnSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Colunas empilhadas por período (até 2 séries). Legenda sempre presente com 2 séries;
 * dica com valores ao passar o mouse/tocar; tabela acessível para leitores de tela.
 */
export const StackedColumns: React.FC<{ labels: string[]; series: ColumnSeries[]; ariaLabel: string; height?: number }> = ({ labels, series, ariaLabel, height = 160 }) => {
  const [hover, setHover] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0));
  const top = Math.max(0, ...totals);
  if (!labels.length || top <= 0) return <p className="py-4 text-xs text-slate-500">Sem dados no período.</p>;
  const labelEvery = Math.ceil(labels.length / 10);
  return (
    <figure className="space-y-2">
      {series.length > 1 && (
        <figcaption className="flex flex-wrap gap-3 text-xs text-slate-700">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" /> {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="relative">
        <div className="flex items-end gap-[2px] border-b border-slate-300" style={{ height }} onMouseLeave={() => setHover(null)}>
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${l}: ${series.map((s) => `${s.name} ${s.values[i] || 0}`).join(', ')}`}
            >
              <span className="mx-auto flex w-full max-w-6 flex-col-reverse gap-[2px]">
                {series.map((s, si) => {
                  const v = s.values[i] || 0;
                  if (!v) return null;
                  const isTop = series.slice(si + 1).every((x) => !(x.values[i] || 0));
                  return (
                    <span
                      key={s.name}
                      className={isTop ? 'rounded-t-[4px]' : ''}
                      style={{ height: `${(v / top) * (height - 8)}px`, backgroundColor: s.color, opacity: hover === null || hover === i ? 1 : 0.55 }}
                    />
                  );
                })}
              </span>
            </button>
          ))}
        </div>
        {hover !== null && (
          <div className="pointer-events-none absolute -top-2 z-10 -translate-y-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
               style={{ left: `min(calc(${((hover + 0.5) / labels.length) * 100}% - 3rem), calc(100% - 9rem))` }}>
            <p className="font-semibold text-slate-900">{labels[hover]}</p>
            {series.map((s) => (
              <p key={s.name} className="flex items-center gap-1.5 text-slate-700">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} aria-hidden="true" />
                {s.name}: <strong className="tabular-nums">{(s.values[hover] || 0).toLocaleString('pt-BR')}</strong>
              </p>
            ))}
          </div>
        )}
        <div className="mt-1 flex gap-[2px] text-[10px] text-slate-500" aria-hidden="true">
          {labels.map((l, i) => (
            <span key={l} className="min-w-0 flex-1 truncate text-center">{i % labelEvery === 0 ? l : ''}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th>Período</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
        <tbody>{labels.map((l, i) => <tr key={l}><td>{l}</td>{series.map((s) => <td key={s.name}>{s.values[i] || 0}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
};

/** Indicador grande com legenda (hero number). */
export const Metric: React.FC<{ label: string; value: React.ReactNode; caption?: React.ReactNode; tone?: Tone }> = ({ label, value, caption, tone }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-2xl font-bold tabular-nums ${tone === 'danger' ? 'text-rose-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-slate-900'}`}>{value}</p>
    {caption && <p className="mt-0.5 text-[11px] text-slate-500">{caption}</p>}
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; actions?: React.ReactNode }> = ({ children, actions }) => (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
    <h2 className="text-sm font-bold text-slate-900">{children}</h2>
    {actions}
  </div>
);

export const fmtDate = (v?: string | null) => {
  if (!v) return '—';
  const d = v.length <= 10 ? new Date(`${v}T12:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR');
};
export const fmtDateTime = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? 'Indisponível' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
export const todayLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
