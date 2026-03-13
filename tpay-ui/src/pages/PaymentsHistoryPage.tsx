import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarClock, RefreshCcw, Search } from "lucide-react";
import { PaymentsAPI, type PaymentDetail, WebhooksAPI, type WebhookEvent } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "../components/ui/table";

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
  switch (status) {
    case "succeeded":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function describeDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) return `${dateFrom} to ${dateTo}`;
  if (dateFrom) return `From ${dateFrom}`;
  if (dateTo) return `Through ${dateTo}`;
  return "Any time";
}

function AuditEvent({ event }: { event: WebhookEvent }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-950">{event.event_type}</div>
        <div className="text-xs text-slate-500">{formatDateTime(event.received_at)}</div>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        Provider event: <span className="font-mono text-xs text-slate-700">{event.provider_event_id}</span>
      </div>
      {event.processing_error ? (
        <div className="mt-2 text-sm text-rose-700">Processing error: {event.processing_error}</div>
      ) : null}
    </div>
  );
}

export default function PaymentsHistoryPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<PaymentDetail | null>(null);

  const params = new URLSearchParams();
  params.set("limit", "50");
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (dateFrom) params.set("created_from", `${dateFrom}T00:00:00`);
  if (dateTo) params.set("created_to", `${dateTo}T23:59:59`);

  const listQuery = useQuery({
    queryKey: ["payments-list", search, status, dateFrom, dateTo],
    queryFn: () => PaymentsAPI.listPayments(`?${params.toString()}`),
  });

  const selectedId = selected?.id;
  const detailQuery = useQuery({
    queryKey: ["payment-detail", selectedId],
    queryFn: () => PaymentsAPI.getPayment(selectedId!),
    enabled: Boolean(selectedId),
  });

  const eventsQuery = useQuery({
    queryKey: ["payment-events", selectedId],
    queryFn: () => WebhooksAPI.listEvents(`?payment_id=${encodeURIComponent(selectedId!)}&limit=20`),
    enabled: Boolean(selectedId),
  });

  const rawItems = listQuery.data?.items ?? [];
  const items = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return rawItems.filter((payment) => {
      if (!payment.created_at) return true;
      const createdMs = new Date(payment.created_at).getTime();
      if (Number.isNaN(createdMs)) return true;
      if (fromMs !== null && createdMs < fromMs) return false;
      if (toMs !== null && createdMs > toMs) return false;
      return true;
    });
  }, [rawItems, dateFrom, dateTo]);

  useEffect(() => {
    if (selected && !items.some((payment) => payment.id === selected.id)) {
      setSelected(null);
    }
  }, [items, selected]);

  const detail = detailQuery.data ?? selected;
  const events = eventsQuery.data?.items ?? [];
  const dateRangeLabel = describeDateRange(dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-white/80 backdrop-blur">
            <CardTitle>Payments</CardTitle>
            <CardDescription>
              Merchant-visible history with filters for date range, status, and invoice or job search.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Date filter:</span> {dateRangeLabel}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Search</div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    placeholder="Payment, invoice, or job"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All statuses</option>
                  <option value="initiated">Initiated</option>
                  <option value="processing">Processing</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reset filters
                </Button>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Date from <span className="normal-case text-slate-400">(optional)</span></div>
                <Input type="date" aria-label="Filter payments from date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Date to <span className="normal-case text-slate-400">(optional)</span></div>
                <Input type="date" aria-label="Filter payments to date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <THead className="bg-slate-50 text-[11px] uppercase tracking-wide">
                  <TR>
                    <TH>Payment ID</TH>
                    <TH>Job</TH>
                    <TH>Invoice</TH>
                    <TH>Amount</TH>
                    <TH>Status</TH>
                    <TH>Date</TH>
                    <TH>Provider ref</TH>
                    <TH>Retry</TH>
                  </TR>
                </THead>
                <TBody>
                  {items.length === 0 ? (
                    <TR>
                      <TD colSpan={8} className="py-14 text-center text-sm text-slate-500">
                        No payments match the current filters.
                      </TD>
                    </TR>
                  ) : (
                    items.map((payment) => (
                      <TR
                        key={payment.id}
                        className="cursor-pointer transition hover:bg-slate-50"
                        onClick={() => setSelected(payment)}
                      >
                        <TD className="font-mono text-xs text-slate-700">{payment.id}</TD>
                        <TD>{payment.job_id}</TD>
                        <TD>{payment.invoice_id}</TD>
                        <TD className="font-semibold text-slate-950">{formatCurrency(payment.amount)}</TD>
                        <TD>
                          <Badge className={statusTone(payment.status)}>{payment.status}</Badge>
                        </TD>
                        <TD>{formatDateTime(payment.created_at)}</TD>
                        <TD className="font-mono text-xs text-slate-700">{payment.provider_payment_id ?? "-"}</TD>
                        <TD>{payment.retry_count ?? 0}</TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Audit / history</CardTitle>
            <CardDescription>
              Click a payment to view created and executed timestamps, current state, and webhook audit events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!detail ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Select a payment from the table to inspect its audit trail.
              </div>
            ) : (
              <>
                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Payment</div>
                      <div className="mt-2 break-all text-lg font-semibold">{detail.id}</div>
                    </div>
                    <Badge className={statusTone(detail.status)}>{detail.status}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white/10 p-4">
                      <div className="text-xs text-slate-300">Created</div>
                      <div className="mt-1 text-sm font-medium">{formatDateTime(detail.created_at)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/10 p-4">
                      <div className="text-xs text-slate-300">Executed</div>
                      <div className="mt-1 text-sm font-medium">{formatDateTime(detail.executed_at)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Invoice / job</div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{detail.invoice_id}</div>
                    <div className="text-sm text-slate-500">Job {detail.job_id}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">Provider reference</div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">{detail.provider_payment_id ?? "Not attached"}</div>
                    <div className="text-sm text-slate-500">Retries: {detail.retry_count ?? 0}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">Status events</div>
                    <CalendarClock className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span>Payment created</span>
                      <span className="text-slate-500">{formatDateTime(detail.created_at)}</span>
                    </div>
                    {detail.executed_at ? (
                      <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                        <span>Payment executed</span>
                        <span className="text-slate-500">{formatDateTime(detail.executed_at)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                      <span>Current status</span>
                      <span className="font-semibold text-slate-950">{detail.status}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-950">Webhook audit</div>
                    <ArrowUpRight className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="mt-3 space-y-3">
                    {events.length === 0 ? (
                      <div className="text-sm text-slate-500">No webhook events found for this payment.</div>
                    ) : (
                      events.map((event) => <AuditEvent key={event.id} event={event} />)
                    )}
                  </div>
                </div>

                <details className="rounded-2xl border border-slate-200 p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-950">
                    Technical metadata
                  </summary>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <div>
                      Idempotency key: <span className="font-mono text-xs text-slate-700">{detail.idempotency_key ?? "Unavailable"}</span>
                    </div>
                    <div>
                      Failure reason: {detail.failure_reason ?? "None"}
                    </div>
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
