import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, Banknote, CheckCircle2, Clock3, ReceiptText, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { PaymentsAPI, ReconciliationAPI } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

function formatCurrency(value: number | string | undefined | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(numeric);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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
  const summaryQuery = useQuery({
    queryKey: ["payments-summary"],
    queryFn: () => PaymentsAPI.summary(),
  });
  const recentPaymentsQuery = useQuery({
    queryKey: ["payments-recent"],
    queryFn: () => PaymentsAPI.listPayments("?limit=6"),
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
