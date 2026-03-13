import type { ReactNode } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, FileWarning, Search } from "lucide-react";
import { ReconciliationAPI } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/table";

function formatCurrency(value: number | undefined | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: string) {
  return status.toLowerCase() === "mismatch"
    ? "border-orange-200 bg-orange-50 text-orange-700"
    : "border-rose-200 bg-rose-50 text-rose-700";
}

function ReconStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  tone: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${tone}`}>
      <div className="flex items-center gap-3 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

export default function ReconciliationPage() {
  const nav = useNavigate();
  const queryClient = useQueryClient();
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["reconciliation-summary"],
    queryFn: () => ReconciliationAPI.summary(),
  });

  const runsQuery = useQuery({
    queryKey: ["reconciliation-runs"],
    queryFn: () => ReconciliationAPI.runs(),
  });

  const exceptionsQuery = useQuery({
    queryKey: ["reconciliation-exceptions"],
    queryFn: () => ReconciliationAPI.exceptions(),
  });

  const runMutation = useMutation({
    mutationFn: () => ReconciliationAPI.run(reportDate),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["reconciliation-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["reconciliation-exceptions"] }),
      ]);
    },
  });

  const exceptions = (exceptionsQuery.data ?? []).filter((item) => {
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      item.payment_id.toLowerCase().includes(needle) ||
      (item.provider_payment_id ?? "").toLowerCase().includes(needle) ||
      (item.error ?? "").toLowerCase().includes(needle)
    );
  });

  const summary = summaryQuery.data;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.10),_transparent_30%),linear-gradient(135deg,#fff_0%,#fff8f6_50%,#f8fbff_100%)]">
          <CardHeader>
            <CardTitle>Reconciliation workbench</CardTitle>
            <CardDescription>
              Automated matching stays in the background. Merchant attention goes to exceptions, history, and last-run posture.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ReconStat
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Matched count"
                value={summary?.matched_count ?? 0}
                tone="border-emerald-200 bg-emerald-50 text-emerald-800"
              />
              <ReconStat
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Exception count"
                value={summary?.exception_count ?? 0}
                tone="border-orange-200 bg-orange-50 text-orange-800"
              />
              <ReconStat
                icon={<FileWarning className="h-4 w-4" />}
                label="Mismatch"
                value={summary?.mismatch_count ?? 0}
                tone="border-amber-200 bg-amber-50 text-amber-800"
              />
              <ReconStat
                icon={<Clock3 className="h-4 w-4" />}
                label="Missing"
                value={summary?.missing_count ?? 0}
                tone="border-rose-200 bg-rose-50 text-rose-800"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Last reconciliation run</div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  {summary?.last_run_at ? `${formatDateTime(summary.last_run_at)} • ${summary.last_run_id}` : "No run recorded yet"}
                </div>
              </div>
              <div className="w-full md:w-[180px]">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Report date</div>
                <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
              </div>
              <Button className="h-10 px-5" onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                {runMutation.isPending ? "Running..." : "Run reconciliation"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Full reconciliation history</CardTitle>
            <CardDescription>Merchants can review prior runs, not only the latest internal view.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(runsQuery.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No reconciliation history yet.
              </div>
            ) : (
              (runsQuery.data ?? []).map((run) => (
                <div key={run.run_id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{run.report_date}</div>
                      <div className="text-sm text-slate-500">{formatDateTime(run.created_at)}</div>
                    </div>
                    <Badge className="border-slate-200 bg-slate-50 text-slate-700">{run.status}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-3 py-2">{run.matched_count} matched</div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">{run.exception_count} exceptions</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Exceptions</CardTitle>
            <CardDescription>Highlighted mismatches and missing items that require merchant attention.</CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              placeholder="Search payment, provider ref, or error"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Table>
              <THead className="bg-slate-50 text-[11px] uppercase tracking-wide">
                <TR>
                  <TH>Payment ID</TH>
                  <TH>Expected</TH>
                  <TH>Actual</TH>
                  <TH>Status</TH>
                  <TH>Provider</TH>
                  <TH>Internal status</TH>
                  <TH>Run</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {exceptions.length === 0 ? (
                  <TR>
                    <TD colSpan={8} className="py-16 text-center text-sm text-slate-500">
                      No exceptions found.
                    </TD>
                  </TR>
                ) : (
                  exceptions.map((row) => (
                    <TR key={`${row.payment_id}-${row.run_id ?? "latest"}`} className="hover:bg-slate-50">
                      <TD className="font-mono text-xs text-slate-700">{row.payment_id}</TD>
                      <TD>{formatCurrency(row.expected_amount)}</TD>
                      <TD>{row.actual_amount == null ? "-" : formatCurrency(row.actual_amount)}</TD>
                      <TD>
                        <Badge className={statusTone(row.status)}>{row.status}</Badge>
                      </TD>
                      <TD className="font-mono text-xs text-slate-700">{row.provider_payment_id ?? "-"}</TD>
                      <TD>{row.internal_status ?? "-"}</TD>
                      <TD className="text-xs text-slate-500">{row.run_id ?? "-"}</TD>
                      <TD>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            nav(
                              `/reconciliation/exceptions/${encodeURIComponent(row.payment_id)}${row.run_id ? `?run_id=${encodeURIComponent(row.run_id)}` : ""}`
                            )
                          }
                        >
                          Review
                        </Button>
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
