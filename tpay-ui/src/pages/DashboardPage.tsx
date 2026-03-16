import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Banknote, CheckCircle2, Clock3, ReceiptText, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentsAPI, ReconciliationAPI, type PaymentDetail } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

function formatCurrency(value: number | string | undefined | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

function formatAxisCurrencyCompact(value: number) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "$0";
  if (numeric === 0) return "$0";
  if (Math.abs(numeric) >= 1000) {
    const compact = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(numeric);
    return `$${compact}`;
  }
  return `$${Math.round(numeric)}`;
}

function formatTooltipDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(date);
}

function formatDateLong(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(date);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toDateInput(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function paymentIsSuccess(status: string | undefined) {
  const normalized = String(status ?? "").toLowerCase();
  return normalized === "succeeded" || normalized === "success" || normalized === "completed";
}

function buildVolumeSeries(payments: PaymentDetail[], start: Date, end: Date) {
  const first = startOfDay(start);
  const last = startOfDay(end);
  const totalDays = Math.max(1, Math.floor((last.getTime() - first.getTime()) / 86400000) + 1);

  const buckets = new Map<string, { gross: number; net: number; date: Date }>();
  for (let i = 0; i < totalDays; i += 1) {
    const day = new Date(first);
    day.setDate(first.getDate() + i);
    buckets.set(day.toISOString().slice(0, 10), { gross: 0, net: 0, date: day });
  }

  for (const payment of payments) {
    const rawDate = payment.executed_at ?? payment.created_at;
    if (!rawDate) continue;
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) continue;
    const dayKey = startOfDay(d).toISOString().slice(0, 10);
    const bucket = buckets.get(dayKey);
    if (!bucket) continue;
    const amount = Number(payment.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    bucket.gross += amount;
    if (paymentIsSuccess(payment.status)) {
      bucket.net += amount;
    }
  }

  return Array.from(buckets.values()).map((item) => ({
    date: item.date,
    label: formatDayLabel(item.date),
    gross: item.gross,
    net: item.net,
  }));
}

function buildSmoothLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function ProcessingVolumeChart({
  payments,
  startDate,
  endDate,
}: {
  payments: PaymentDetail[];
  startDate: Date;
  endDate: Date;
}) {
  const [mode, setMode] = useState<"gross" | "net">("gross");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const series = useMemo(() => buildVolumeSeries(payments, startDate, endDate), [payments, startDate, endDate]);
  const values = series.map((point) => (mode === "gross" ? point.gross : point.net));
  const total = values.reduce((sum, value) => sum + value, 0);
  const hasValues = values.some((value) => value > 0);
  const maxValue = hasValues ? Math.max(...values) : 1;
  const width = 1000;
  const height = 280;
  const leftPad = 64;
  const bottomPad = 36;
  const innerHeight = height - bottomPad;
  const plotWidth = width - leftPad;
  const xStep = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;

  const points = values.map((value, index) => {
    const x = leftPad + index * xStep;
    const y = innerHeight - (value / maxValue) * (innerHeight - 24);
    return { x, y };
  });

  const linePath = buildSmoothLinePath(points);
  const areaPath = `${linePath} L ${width} ${innerHeight} L ${leftPad} ${innerHeight} Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = maxValue * ratio;
    const y = innerHeight - ratio * (innerHeight - 24);
    return { value, y };
  });
  const targetLabels = 10;
  const xLabelStep = Math.max(1, Math.ceil(series.length / targetLabels));
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const hoverValue = hoverIndex !== null ? values[hoverIndex] : null;
  const hoverDate = hoverIndex !== null ? series[hoverIndex]?.date : null;
  const tooltipLeftPct = hoverPoint ? (hoverPoint.x / width) * 100 : 0;
  const tooltipTopPct = hoverPoint ? (hoverPoint.y / height) * 100 : 0;
  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (series.length === 0) {
      setHoverIndex(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) {
      setHoverIndex(null);
      return;
    }
    const relativeX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const scaledX = (relativeX / rect.width) * width;
    const plotX = Math.min(Math.max(scaledX - leftPad, 0), plotWidth);
    const ratio = plotWidth > 0 ? plotX / plotWidth : 0;
    const index = Math.round(ratio * (series.length - 1));
    setHoverIndex(Math.max(0, Math.min(series.length - 1, index)));
  };

  return (
    <Card className="overflow-hidden border-slate-800/80 bg-[radial-gradient(circle_at_14%_18%,rgba(59,130,246,0.16),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(15,23,42,0.22),transparent_30%),linear-gradient(135deg,#0b1220_0%,#0f1b33_52%,#13203c_100%)] text-white shadow-xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-0">
        <div>
          <CardTitle className="text-4xl leading-tight text-white">Total Processing Volume</CardTitle>
          <CardDescription className="text-slate-300">
            {mode === "gross" ? "Gross" : "Net"} volume of {formatCurrency(total)}
          </CardDescription>
        </div>
        <div className="inline-flex rounded-2xl bg-white/10 p-1 text-sm">
          <button
            className={`rounded-xl px-4 py-2 font-semibold transition ${mode === "gross" ? "bg-white/15 text-white" : "text-slate-300 hover:text-white"}`}
            onClick={() => setMode("gross")}
            type="button"
          >
            Gross
          </button>
          <button
            className={`rounded-xl px-4 py-2 font-semibold transition ${mode === "net" ? "bg-white/15 text-white" : "text-slate-300 hover:text-white"}`}
            onClick={() => setMode("net")}
            type="button"
          >
            Net
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="relative h-[340px] w-full">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            preserveAspectRatio="none"
            onMouseMove={handleChartMouseMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {yTicks.map((tick, index) => (
              <g key={`y-${index}`}>
                <line x1="0" y1={tick.y} x2={width} y2={tick.y} stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
                <text x="0" y={tick.y - 6} fill="rgba(226,232,240,0.9)" fontSize="14">
                  {formatAxisCurrencyCompact(tick.value)}
                </text>
              </g>
            ))}
            {series.map((point, index) => (
              <line
                key={`x-${point.label}-${index}`}
                x1={leftPad + index * xStep}
                y1="24"
                x2={leftPad + index * xStep}
                y2={innerHeight}
                stroke="rgba(148,163,184,0.12)"
                strokeWidth="1"
              />
            ))}
            {points.length > 1 ? (
              <>
                <path d={areaPath} fill="rgba(56,189,248,0.18)" />
                <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" />
                {hoverPoint ? (
                  <g>
                    <circle
                      cx={hoverPoint.x}
                      cy={hoverPoint.y}
                      r={hoverValue && hoverValue > 0 ? 5 : 4}
                      fill="#38bdf8"
                    />
                    <circle
                      cx={hoverPoint.x}
                      cy={hoverPoint.y}
                      r={hoverValue && hoverValue > 0 ? 8 : 6.5}
                      fill="none"
                      stroke="rgba(226,232,240,0.9)"
                      strokeWidth="2"
                    />
                  </g>
                ) : null}
              </>
            ) : null}
            {series.map((point, index) => (
              index % xLabelStep === 0 || index === series.length - 1 ? (
                <text
                  key={`label-${point.label}-${index}`}
                  x={leftPad + index * xStep}
                  y={height - 8}
                  fill="rgba(226,232,240,0.88)"
                  textAnchor="middle"
                  fontSize="14"
                >
                  {point.label}
                </text>
              ) : null
            ))}
          </svg>
          {hoverPoint && hoverValue !== null && hoverDate ? (
            <>
              <div
                className="pointer-events-none absolute bottom-[36px] w-px bg-slate-300/45"
                style={{ left: `${tooltipLeftPct}%`, top: "24px" }}
              />
              <div
                className="pointer-events-none absolute z-10 min-w-[180px] rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-sm text-slate-100 shadow-xl"
                style={{
                  left: `min(calc(${tooltipLeftPct}% + 12px), calc(100% - 188px))`,
                  top: `max(calc(${tooltipTopPct}% - 86px), 8px)`,
                }}
              >
                <div className="border-b border-slate-700/80 pb-2 font-semibold">{formatTooltipDate(hoverDate)}</div>
                <div className="pt-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400" />
                    Amount: <strong>{formatCurrency(hoverValue)}</strong>
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
}) {
  return (
    <Card className="border-white/60 bg-white/85 backdrop-blur">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <div className="text-sm font-medium text-slate-500">{title}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
        </div>
        <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-lg shadow-slate-950/10">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [defaultRange] = useState(() => {
    const end = startOfDay(new Date());
    const start = addDays(end, -13);
    return { start, end, from: toDateInput(start), to: toDateInput(end) };
  });
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [merchantFilter, setMerchantFilter] = useState("all");

  const summaryQuery = useQuery({
    queryKey: ["payments-summary"],
    queryFn: () => PaymentsAPI.summary(),
  });
  const recentPaymentsQuery = useQuery({
    queryKey: ["payments-recent"],
    queryFn: () => PaymentsAPI.listPayments("?limit=200"),
  });
  const reconSummaryQuery = useQuery({
    queryKey: ["reconciliation-summary"],
    queryFn: () => ReconciliationAPI.summary(),
  });
  const exceptionsQuery = useQuery({
    queryKey: ["reconciliation-exceptions-dashboard"],
    queryFn: () => ReconciliationAPI.exceptions("?limit=5"),
  });

  const summary = summaryQuery.data;
  const recon = reconSummaryQuery.data;
  const recentPayments = recentPaymentsQuery.data?.items ?? [];
  const exceptions = exceptionsQuery.data ?? [];
  const currencies = useMemo(
    () => Array.from(new Set(recentPayments.map((p) => String(p.currency ?? "USD").toUpperCase()))).filter(Boolean),
    [recentPayments]
  );
  const merchants = ["HVAC Operations"];

  const parsedFromDate = useMemo(() => {
    const parsed = new Date(`${fromDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? defaultRange.start : startOfDay(parsed);
  }, [fromDate, defaultRange.start]);
  const parsedToDate = useMemo(() => {
    const parsed = new Date(`${toDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? defaultRange.end : startOfDay(parsed);
  }, [toDate, defaultRange.end]);
  const safeRange = useMemo(() => {
    if (parsedFromDate.getTime() <= parsedToDate.getTime()) {
      return { start: parsedFromDate, end: parsedToDate };
    }
    return { start: parsedToDate, end: parsedFromDate };
  }, [parsedFromDate, parsedToDate]);

  const filteredChartPayments = useMemo(() => {
    return recentPayments.filter((payment) => {
      const rawDate = payment.executed_at ?? payment.created_at;
      if (!rawDate) return false;
      const d = startOfDay(new Date(rawDate));
      if (Number.isNaN(d.getTime())) return false;
      if (d < safeRange.start || d > safeRange.end) return false;
      if (currencyFilter !== "all" && String(payment.currency ?? "").toUpperCase() !== currencyFilter) return false;
      if (merchantFilter !== "all" && merchantFilter !== "hvac-operations") return false;
      return true;
    });
  }, [recentPayments, safeRange.start, safeRange.end, currencyFilter, merchantFilter]);

  const clearFilters = () => {
    setFromDate(defaultRange.from);
    setToDate(defaultRange.to);
    setCurrencyFilter("all");
    setMerchantFilter("all");
  };
  const isDateFiltered = fromDate !== defaultRange.from || toDate !== defaultRange.to;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-slate-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_30%),linear-gradient(135deg,#fffdf8_0%,#eef4ff_55%,#f6fafc_100%)] p-8 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            <Badge className="border-amber-200 bg-amber-50 text-amber-800">Merchant Portal MVP</Badge>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
                TPay dashboard for ServiceTitan-driven collections and exception-first reconciliation.
              </h1>
              <p className="max-w-2xl text-base text-slate-600">
                Placeholder branding, merchant isolation-ready structure, and live visibility into payments, invoice-linked collections, and reconciliation exceptions.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/collect"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-slate-800"
              >
                Collect payment
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/reconciliation"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold !text-slate-900 transition hover:bg-slate-50"
              >
                Review exceptions
              </Link>
            </div>
          </div>

          <Card className="border-slate-200/80 bg-slate-950 text-white">
            <CardHeader>
              <CardTitle className="text-white">Reconciliation posture</CardTitle>
              <CardDescription className="text-slate-300">
                Latest automated run and merchant-visible exception load.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Last run</div>
                  <div className="mt-2 text-lg font-semibold">{formatDateTime(recon?.last_run_at)}</div>
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Report date</div>
                  <div className="mt-2 text-lg font-semibold">{recon?.last_report_date ?? "No run yet"}</div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <div className="text-sm text-emerald-100">Matched</div>
                  <div className="mt-1 text-2xl font-semibold">{recon?.matched_count ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
                  <div className="text-sm text-orange-100">Mismatch</div>
                  <div className="mt-1 text-2xl font-semibold">{recon?.mismatch_count ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <div className="text-sm text-rose-100">Missing</div>
                  <div className="mt-1 text-2xl font-semibold">{recon?.missing_count ?? 0}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Total volume today"
          value={formatCurrency(summary?.total_volume_today)}
          subtitle="Captured and pending internal payment records"
          icon={<Banknote className="h-5 w-5" />}
        />
        <MetricCard
          title="Total volume MTD"
          value={formatCurrency(summary?.total_volume_mtd)}
          subtitle={`${summary?.total_payments_mtd ?? 0} payment records this month`}
          icon={<ReceiptText className="h-5 w-5" />}
        />
        <MetricCard
          title="Successful payments"
          value={String(summary?.successful_payments_today ?? 0)}
          subtitle="Today"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <MetricCard
          title="Failed payments"
          value={String(summary?.failed_payments_today ?? 0)}
          subtitle={`Chargebacks placeholder: ${summary?.chargebacks_count ?? 0}`}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
              currencyFilter === "all"
                ? "border-dashed border-slate-400 bg-white text-slate-700"
                : "border-solid border-blue-400 bg-blue-50 text-slate-800"
            }`}
          >
            + Currency
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">All</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
          <label
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
              merchantFilter === "all"
                ? "border-dashed border-slate-400 bg-white text-slate-700"
                : "border-solid border-blue-400 bg-blue-50 text-slate-800"
            }`}
          >
            + Merchant
            <select
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className="bg-transparent text-sm outline-none"
            >
              <option value="all">All</option>
              {merchants.map((merchant) => (
                <option key={merchant} value="hvac-operations">
                  {merchant}
                </option>
              ))}
            </select>
          </label>
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              isDateFiltered
                ? "border-solid border-blue-400 bg-blue-50 text-slate-800"
                : "border-dashed border-slate-400 bg-white text-slate-700"
            }`}
          >
            <span>x Date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md bg-transparent text-sm outline-none"
            />
            <span>-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md bg-transparent text-sm outline-none"
            />
            <span className="text-slate-500">
              {formatDateLong(safeRange.start)} - {formatDateLong(safeRange.end)}
            </span>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-950"
          >
            Clear Filters
          </button>
        </div>
        <ProcessingVolumeChart payments={filteredChartPayments} startDate={safeRange.start} endDate={safeRange.end} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Recent payments</CardTitle>
              <CardDescription>Latest internal payment records tied to jobs and invoices.</CardDescription>
            </div>
            <Link to="/payments" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPayments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No payments found.
              </div>
            ) : (
              recentPayments.map((payment) => (
                <div key={payment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{payment.invoice_id}</div>
                    <div className="text-sm text-slate-500">
                      Job {payment.job_id} • {formatDateTime(payment.created_at)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">{payment.status}</Badge>
                    <div className="text-base font-semibold text-slate-950">{formatCurrency(payment.amount)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Exceptions to review</CardTitle>
              <CardDescription>Mismatch and missing items surfaced for merchant action.</CardDescription>
            </div>
            <Link to="/reconciliation" className="text-sm font-semibold text-slate-700 hover:text-slate-950">
              Open workbench
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {exceptions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-800">
                No current exceptions.
              </div>
            ) : (
              exceptions.map((exception) => (
                <Link
                  key={`${exception.payment_id}-${exception.run_id ?? "latest"}`}
                  to={`/reconciliation/exceptions/${encodeURIComponent(exception.payment_id)}${exception.run_id ? `?run_id=${encodeURIComponent(exception.run_id)}` : ""}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 rounded-full bg-rose-50 p-2 text-rose-600">
                      <AlertCircle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{exception.payment_id}</div>
                      <div className="text-sm text-slate-500">
                        Expected {formatCurrency(exception.expected_amount)} • Actual {formatCurrency(exception.actual_amount)}
                      </div>
                    </div>
                  </div>
                  <Badge className="border-orange-200 bg-orange-50 text-orange-700">{exception.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Merchant notes</CardTitle>
            <CardDescription>MVP assumptions aligned to the attached document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 p-4">
              Hardcoded merchant identity is assumed for now, but the information architecture is ready for tenant-based isolation.
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              Chargebacks remain a placeholder metric until provider and dispute workflows are added.
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              Reconciliation stays exception-driven so merchants spend time only on missing and mismatched records.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent reconciliation runs</CardTitle>
            <CardDescription>Full history remains visible, with exceptions emphasized.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recon?.history ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No reconciliation runs recorded.
              </div>
            ) : (
              recon?.history.map((run) => (
                <div key={run.run_id} className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-slate-100 p-2 text-slate-700">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{run.report_date}</div>
                      <div className="text-sm text-slate-500">{formatDateTime(run.created_at)}</div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-slate-950">{run.exception_count} exceptions</div>
                    <div className="text-slate-500">{run.matched_count} matched</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
