import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentsAPI, WebhooksAPI } from "@/api/client";
import { loadTilledJs } from "@/lib/tilled";

function randomIdem() {
  return `idem_${crypto.randomUUID()}`;
}

export default function CollectPaymentPage() {
  const [jobId, setJobId] = useState("job_demo_1");
  const [invoiceId, setInvoiceId] = useState("inv_demo_1");
  const [amount, setAmount] = useState("10.00");
  const [currency, setCurrency] = useState("USD");
  const [idempotencyKey, setIdempotencyKey] = useState(randomIdem());

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [providerIntentId, setProviderIntentId] = useState<string | null>(null);

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const canPay = useMemo(() => !!paymentId && !!clientSecret, [paymentId, clientSecret]);

  async function createIntent() {
    setError("");
    setStatus("Creating internal intent...");
    const res = await PaymentsAPI.createIntent({
      job_id: jobId,
      invoice_id: invoiceId,
      amount,
      currency,
      idempotency_key: idempotencyKey,
    });
    setPaymentId(res.payment_id);
    setStatus(`Intent created: ${res.payment_id} (status=${res.status})`);
  }

  async function createProviderIntent() {
    if (!paymentId) return;
    setError("");
    setStatus("Creating provider intent...");
    const res = await PaymentsAPI.createProviderIntent(paymentId);

    setProviderIntentId(res.provider_payment_intent_id ?? null);
    setClientSecret(res.client_secret ?? null);

    setStatus(
      `Provider intent created. pi=${res.provider_payment_intent_id ?? ""} status=${res.provider_status ?? ""}`
    );
  }

  async function mountCardForm() {
    if (!clientSecret) return;
    setError("");
    setStatus("Loading Tilled.js form...");

    const cfg = await fetch("http://127.0.0.1:8000/tilled/config").then((r) => r.json());

    const Tilled = await loadTilledJs();
    const tilled = new Tilled(cfg.publishable_key, cfg.account_id);

    const form = tilled.form({ payment_method_type: "card" });

    // Clear any existing
    const mount = document.getElementById("tilled-card-mount");
    if (!mount) return;
    mount.innerHTML = "";

    const card = form.createField("card");
    card.mount("#tilled-card-mount");

    (window as any).__TPAY_TILLED_FORM__ = { tilled, form };
    setStatus("Card form ready.");
  }

  async function confirmPayment() {
    if (!clientSecret) return;
    setError("");
    setStatus("Confirming payment...");

    const stored = (window as any).__TPAY_TILLED_FORM__;
    if (!stored?.form) {
      setError("Card form not mounted yet. Click 'Load Card Form' first.");
      return;
    }

    // confirmPayment signature depends on tilled.js; we use generic call
    // If your previous HTML test uses a slightly different call, paste it and I’ll align.
    const result = await stored.form.confirmPayment(clientSecret);
    setStatus(`Confirm result: ${JSON.stringify(result)}`);
  }

  async function pollStatus() {
    if (!paymentId) return;
    setError("");
    setStatus("Polling backend status...");

    const start = Date.now();
    while (Date.now() - start < 30000) {
      const p = await PaymentsAPI.getPayment(paymentId);
      setStatus(`Payment status: ${p.status}`);
      if (p.status === "succeeded" || p.status === "failed") break;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function viewWebhookEvents() {
    if (!paymentId) return;
    setError("");
    const events = await WebhooksAPI.listEvents(`?limit=10`);
    // If your backend supports filtering by payment_id, switch to:
    // const events = await WebhooksAPI.listEvents(`?payment_id=${paymentId}&limit=10`);
    setStatus(`Latest webhook events: ${JSON.stringify(events, null, 2)}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Collect Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-600 mb-1">Job ID</div>
              <Input value={jobId} onChange={(e) => setJobId(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Invoice ID</div>
              <Input value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Amount</div>
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Currency</div>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <div className="text-xs text-gray-600 mb-1">Idempotency Key</div>
              <div className="flex gap-2">
                <Input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} />
                <Button variant="outline" onClick={() => setIdempotencyKey(randomIdem())}>
                  Generate
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={createIntent}>1) Create Payment Intent</Button>
            <Button variant="secondary" onClick={createProviderIntent} disabled={!paymentId}>
              2) Create Provider Intent
            </Button>
            <Button variant="outline" onClick={mountCardForm} disabled={!clientSecret}>
              3) Load Card Form
            </Button>
            <Button variant="default" onClick={confirmPayment} disabled={!canPay}>
              4) Confirm Payment
            </Button>
            <Button variant="outline" onClick={pollStatus} disabled={!paymentId}>
              Poll Status
            </Button>
            <Button variant="outline" onClick={viewWebhookEvents} disabled={!paymentId}>
              View Webhook Events
            </Button>
          </div>

          <div className="text-sm">
            <div className="text-gray-600">payment_id</div>
            <div className="font-mono text-xs break-all">{paymentId ?? "-"}</div>
            <div className="text-gray-600 mt-2">provider_payment_intent_id</div>
            <div className="font-mono text-xs break-all">{providerIntentId ?? "-"}</div>
            <div className="text-gray-600 mt-2">client_secret</div>
            <div className="font-mono text-xs break-all">{clientSecret ?? "-"}</div>
          </div>

          <div className="rounded-md bg-gray-950 text-gray-100 p-3 text-xs whitespace-pre-wrap">
            {error ? `ERROR: ${error}\n\n` : ""}
            {status}
          </div>

          <div className="rounded-md border border-gray-200 p-3">
            <div className="text-sm font-medium mb-2">Card Form</div>
            <div id="tilled-card-mount" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
