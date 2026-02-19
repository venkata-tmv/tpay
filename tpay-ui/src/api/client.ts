const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

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
};

export type WebhookEvent = {
  provider_event_id: string;
  event_type: string;
  payment_id?: string | null;
  created_at?: string;
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

  createProviderIntent: (paymentId: string) =>
    apiFetch<ProviderIntentResponse>(`/payments/${paymentId}/provider-intent`, {
      method: "POST",
      body: JSON.stringify({ confirm: false }),
    }),

  getPayment: (paymentId: string) =>
    apiFetch<PaymentDetail>(`/payments/${paymentId}`, { method: "GET" }),

  listPayments: (query: string) =>
    apiFetch<PaymentDetail[]>(`/payments${query}`, { method: "GET" }),
};

export const WebhooksAPI = {
  listEvents: (query: string) =>
    apiFetch<WebhookEvent[]>(`/webhooks/events${query}`, { method: "GET" }),
};

export const ReconciliationAPI = {
  run: (reportDate: string) =>
    apiFetch<any>(`/reconciliation/run?report_date=${encodeURIComponent(reportDate)}`, {
      method: "POST",
    }),
  exceptions: (query: string) =>
    apiFetch<any[]>(`/reconciliation/exceptions${query}`, { method: "GET" }),
};
