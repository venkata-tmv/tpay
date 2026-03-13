import type { ReactNode } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, Receipt, Wallet } from "lucide-react";
import { PaymentsAPI, ReconciliationAPI, WebhooksAPI } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

function formatCurrency(value: number | string | undefined | null) {
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

function DetailRow({
  label,
  value,
  tone = "light",
}: {
  label: string;
  value: ReactNode;
  tone?: "light" | "dark";
}) {
  const borderClass = tone === "dark" ? "border-white/20" : "border-slate-100";
  const labelClass = tone === "dark" ? "text-slate-300" : "text-slate-500";
  const valueClass = tone === "dark" ? "text-white" : "text-slate-950";

  return (
    <div className={`flex items-center justify-between gap-4 border-b py-3 last:border-b-0 ${borderClass}`}>
      <div className={`text-sm font-medium ${labelClass}`}>{label}</div>
      <div className={`text-right text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

export default function ExceptionDetailPage() {
  const { paymentId = "" } = useParams();
  const [params] = useSearchParams();
  const [note, setNote] = useState("");
  const runId = params.get("run_id");

  const detailQuery = useQuery({
    queryKey: ["reconciliation-exception-detail", paymentId, runId],
    queryFn: () => ReconciliationAPI.exceptionDetail(paymentId, runId),
    enabled: Boolean(paymentId),
  });

  const paymentQuery = useQuery({
    queryKey: ["payment-detail", paymentId],
    queryFn: () => PaymentsAPI.getPayment(paymentId),
    enabled: Boolean(paymentId),
  });

  const eventsQuery = useQuery({
    queryKey: ["payment-events", paymentId],
    queryFn: () => WebhooksAPI.listEvents(`?payment_id=${encodeURIComponent(paymentId)}&limit=20`),
    enabled: Boolean(paymentId),
  });

  const detail = detailQuery.data;
  const payment = paymentQuery.data;
  const events = eventsQuery.data?.items ?? [];
  const isMismatch = detail?.status?.toLowerCase() === "mismatch";

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_55%,#f8fafc_100%)]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Badge className={isMismatch ? "border-orange-200 bg-orange-50 text-orange-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                {detail?.status ?? "Loading"}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-700">Run {detail?.run_id ?? runId ?? "-"}</Badge>
            </div>
            <CardTitle className="mt-3">Reconciliation exception detail</CardTitle>
            <CardDescription>
              Internal expected amount, provider actual amount, settlement date, and audit context for merchant review.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Receipt className="h-4 w-4 text-slate-500" />
                Internal record
              </div>
              <DetailRow label="Payment ID" value={<span className="font-mono text-xs">{detail?.payment_id ?? paymentId}</span>} />
              <DetailRow label="Job ID" value={detail?.job_id ?? payment?.job_id ?? "-"} />
              <DetailRow label="Invoice ID" value={detail?.invoice_id ?? payment?.invoice_id ?? "-"} />
              <DetailRow label="Expected amount" value={formatCurrency(detail?.expected_amount ?? payment?.amount)} />
              <DetailRow label="Internal status" value={detail?.internal_status ?? payment?.status ?? "-"} />
              <DetailRow label="Created time" value={formatDateTime(detail?.payment_created_at ?? payment?.created_at)} />
              <DetailRow label="Executed time" value={formatDateTime(detail?.payment_executed_at ?? payment?.executed_at)} />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
                <Wallet className="h-4 w-4 text-slate-300" />
                Provider record
              </div>
              <DetailRow tone="dark" label="Provider payment ID" value={<span className="font-mono text-xs text-slate-100">{detail?.provider_payment_id ?? "-"}</span>} />
              <DetailRow tone="dark" label="Actual amount" value={detail?.actual_amount == null ? "-" : formatCurrency(detail.actual_amount)} />
              <DetailRow tone="dark" label="Difference" value={detail?.difference == null ? "-" : formatCurrency(detail.difference)} />
              <DetailRow tone="dark" label="Provider status" value={detail?.provider_status ?? "-"} />
              <DetailRow tone="dark" label="Settlement date" value={detail?.settlement_date ?? "-"} />
              <DetailRow tone="dark" label="Exception captured" value={formatDateTime(detail?.created_at)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exception focus</CardTitle>
            <CardDescription>Exception-driven workflow details surfaced for fast action.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  {isMismatch ? <AlertTriangle className="h-4 w-4 text-orange-600" /> : <Clock3 className="h-4 w-4 text-rose-600" />}
                  Exception summary
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {detail?.error ?? "No explicit processor error stored for this exception."}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Mismatch reasons
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(detail?.mismatch_reasons?.length ?? 0) > 0 ? (
                    detail?.mismatch_reasons.map((reason) => (
                      <Badge key={reason} className="border-slate-200 bg-white text-slate-700">
                        {reason}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">No structured reasons captured.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-950">Review note</div>
              <textarea
                className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Example: provider amount excluded a fee adjustment; variance reviewed and accepted."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="mt-4 flex gap-3">
                <Button onClick={() => console.log("Resolved", { paymentId, runId, note })}>Mark resolved</Button>
                <Button variant="secondary" onClick={() => console.log("Escalate", { paymentId, runId, note })}>
                  Escalate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Payment metadata</CardTitle>
            <CardDescription>Audit and retry context from the internal payment record.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Current status" value={payment?.status ?? "-"} />
            <DetailRow label="Provider reference" value={payment?.provider_payment_id ?? "-"} />
            <DetailRow label="Retry count" value={payment?.retry_count ?? 0} />
            <DetailRow
              label="Idempotency key"
              value={<span className="font-mono text-xs">{payment?.idempotency_key ?? "Unavailable"}</span>}
            />
            <DetailRow label="Failure reason" value={payment?.failure_reason ?? "None"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Webhook audit history</CardTitle>
            <CardDescription>Status-adjacent provider events for this payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                No webhook events found.
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">{event.event_type}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(event.received_at)}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    Provider event ID: <span className="font-mono text-xs text-slate-700">{event.provider_event_id}</span>
                  </div>
                  {event.processing_error ? (
                    <div className="mt-2 text-sm text-rose-700">Processing error: {event.processing_error}</div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
