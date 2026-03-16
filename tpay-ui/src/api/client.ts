const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8000";

export type PaymentIntentCreate = {
  job_id: string;
  invoice_id: string;
  amount: string; // keep as string for accuracy
  currency: string; // "USD"
  idempotency_key: string;
};

export type PaymentIntentResponse = {
  payment_id: string;
  status: string;
};

export type StartFromJobRequest = {
  amount?: string;
  currency?: string;
  amount_source?: "total" | "balance";
};

export type StartFromJobResponse = {
  payment_id: string;
  status: string;
  job_id: number;
  invoice_id: number;
  amount: string;
  currency: string;
  idempotency_key: string;
};

export type ProviderIntentResponse = {
  payment_id: string;
  provider_payment_intent_id?: string;
  client_secret?: string;
  provider_status?: string;
};

export type PaymentDetail = {
  id: string;
  job_id: string;
  invoice_id: string;
  amount: string;
  currency: string;
  status: string;
  provider_payment_id?: string | null;
  created_at?: string;
  executed_at?: string | null;
  failure_reason?: string | null;
  retry_count?: number;
  idempotency_key?: string;
};

export type PaymentListResponse = {
  items: PaymentDetail[];
  total: number;
};

export type PaymentSummary = {
  total_volume_today: string;
  total_volume_mtd: string;
  successful_payments_today: number;
  failed_payments_today: number;
  chargebacks_count: number;
  total_payments_mtd: number;
};

export type WebhookEvent = {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payment_id?: string | null;
  received_at?: string;
  processed_at?: string | null;
  processing_error?: string | null;
};

export type WebhookEventListResponse = {
  items: WebhookEvent[];
  total: number;
};

export type ReconciliationException = {
  payment_id: string;
  provider_payment_id?: string | null;
  expected_amount: number;
  actual_amount?: number | null;
  status: string;
  run_id?: string | null;
  internal_status?: string | null;
  provider_status?: string | null;
  error?: string | null;
  created_at?: string | null;
};

export type ReconciliationRunHistoryItem = {
  run_id: string;
  report_date: string;
  status: string;
  created_at: string;
  matched_count: number;
  exception_count: number;
};

export type ReconciliationSummary = {
  last_run_id?: string | null;
  last_report_date?: string | null;
  last_run_at?: string | null;
  matched_count: number;
  exception_count: number;
  missing_count: number;
  mismatch_count: number;
  history: ReconciliationRunHistoryItem[];
};

export type ReconciliationExceptionDetail = {
  payment_id: string;
  run_id: string;
  status: string;
  expected_amount: number;
  actual_amount?: number | null;
  settlement_date?: string | null;
  internal_status?: string | null;
  provider_status?: string | null;
  provider_payment_id?: string | null;
  difference?: number | null;
  error?: string | null;
  mismatch_reasons: string[];
  job_id?: string | null;
  invoice_id?: string | null;
  created_at: string;
  payment_created_at?: string | null;
  payment_executed_at?: string | null;
};

export type ServiceTitanEnvelope<T> = {
  data?: T[];
  hasMore?: boolean;
  totalCount?: number;
};

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.stringify(JSON.parse(detail));
    } catch {}
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

export const PaymentsAPI = {
  createIntent: (payload: PaymentIntentCreate) =>
    apiFetch<PaymentIntentResponse>("/payments/intents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  startFromJob: (jobId: string | number, payload: StartFromJobRequest) =>
    apiFetch<StartFromJobResponse>(`/payments/from-job/${jobId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  createProviderIntent: (paymentId: string) =>
    apiFetch<ProviderIntentResponse>(`/payments/${paymentId}/provider-intent`, {
      method: "POST",
      body: JSON.stringify({ confirm: false }),
    }),

  getPayment: (paymentId: string) =>
    apiFetch<PaymentDetail>(`/payments/${paymentId}`, { method: "GET" }),

  listPayments: (query = "") =>
    apiFetch<PaymentListResponse>(`/payments${query}`, { method: "GET" }),

  summary: () =>
    apiFetch<PaymentSummary>("/payments/summary", { method: "GET" }),
};

export const WebhooksAPI = {
  listEvents: (query = "") =>
    apiFetch<WebhookEventListResponse>(`/webhooks/events${query}`, { method: "GET" }),
};

export const ReconciliationAPI = {
  run: (reportDate: string) =>
    apiFetch<{ run_id: string; report_date: string; status: string }>(
      `/reconciliation/run?report_date=${encodeURIComponent(reportDate)}`,
      {
        method: "POST",
      }
    ),
  summary: () =>
    apiFetch<ReconciliationSummary>("/reconciliation/summary", { method: "GET" }),
  runs: () =>
    apiFetch<ReconciliationRunHistoryItem[]>("/reconciliation/runs", { method: "GET" }),
  exceptions: (query = "") =>
    apiFetch<ReconciliationException[]>(`/reconciliation/exceptions${query}`, { method: "GET" }),
  exceptionDetail: (paymentId: string, runId?: string | null) =>
    apiFetch<ReconciliationExceptionDetail>(
      `/reconciliation/exceptions/${encodeURIComponent(paymentId)}${runId ? `?run_id=${encodeURIComponent(runId)}` : ""}`,
      { method: "GET" }
    ),
};

export const ServiceTitanAPI = {
  getJob: (jobId: string | number) =>
    apiFetch<Record<string, unknown>>(`/servicetitan/jobs/${jobId}`, { method: "GET" }),

  getInvoice: (invoiceId: string | number) =>
    apiFetch<ServiceTitanEnvelope<Record<string, unknown>>>(
      `/servicetitan/invoices/${invoiceId}`,
      { method: "GET" }
    ),

  getCustomer: (customerId: string | number) =>
    apiFetch<ServiceTitanEnvelope<Record<string, unknown>>>(
      `/servicetitan/customers/${customerId}`,
      { method: "GET" }
    ),

  getLocation: (locationId: string | number) =>
    apiFetch<ServiceTitanEnvelope<Record<string, unknown>>>(
      `/servicetitan/locations/${locationId}`,
      { method: "GET" }
    ),

  getBusinessUnit: (businessUnitId: string | number) =>
    apiFetch<ServiceTitanEnvelope<Record<string, unknown>>>(
      `/servicetitan/business-units/${businessUnitId}`,
      { method: "GET" }
    ),
};
