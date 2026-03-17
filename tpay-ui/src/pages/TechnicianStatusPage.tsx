import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock3, Search } from "lucide-react";
import { PaymentsAPI, type PaymentDetail } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

function formatCurrency(value: string | number | undefined | null) {
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
  const normalized = status.toLowerCase();
  if (normalized === "succeeded" || normalized === "success" || normalized === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (normalized === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function summarize(payments: PaymentDetail[]) {
  return payments.reduce(
    (acc, p) => {
      const status = (p.status ?? "").toLowerCase();
      if (status === "succeeded" || status === "success" || status === "completed") acc.success += 1;
      else if (status === "failed") acc.failed += 1;
      else acc.processing += 1;
      return acc;
    },
    { success: 0, failed: 0, processing: 0 }
  );
}

export default function TechnicianStatusPage() {
  const [search, setSearch] = useState("");

  const paymentsQuery = useQuery({
    queryKey: ["technician-status-payments"],
    queryFn: () => PaymentsAPI.listPayments("?limit=50"),
  });

  const payments = paymentsQuery.data?.items ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return payments;
    return payments.filter((p) => {
      return (
        p.id.toLowerCase().includes(needle) ||
        String(p.job_id ?? "").toLowerCase().includes(needle) ||
        String(p.invoice_id ?? "").toLowerCase().includes(needle) ||
        String(p.status ?? "").toLowerCase().includes(needle)
      );
    });
  }, [payments, search]);
  const stats = summarize(filtered);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#f8fafc_100%)]">
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
          <CardDescription>Technician-friendly view of recent collections and outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Successful
            </div>
            <div className="mt-2 text-3xl font-semibold text-emerald-800">{stats.success}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
              <Clock3 className="h-4 w-4" />
              Processing
            </div>
            <div className="mt-2 text-3xl font-semibold text-amber-800">{stats.processing}</div>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
              <AlertCircle className="h-4 w-4" />
              Failed
            </div>
            <div className="mt-2 text-3xl font-semibold text-rose-800">{stats.failed}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Recent Collections</CardTitle>
            <CardDescription>Latest payment attempts, status, and references.</CardDescription>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by payment, job, invoice, or status"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No payment records found.
            </div>
          ) : (
            filtered.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-950">Payment {payment.id}</div>
                    <div className="text-sm text-slate-500">
                      Job {payment.job_id} • Invoice {payment.invoice_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={statusTone(payment.status)}>{payment.status}</Badge>
                    <div className="text-base font-semibold text-slate-950">{formatCurrency(payment.amount)}</div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  Created: {formatDateTime(payment.created_at)} • Executed: {formatDateTime(payment.executed_at)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
