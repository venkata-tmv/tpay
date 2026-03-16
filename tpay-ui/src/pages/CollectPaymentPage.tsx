import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard, FileText, Link2, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PaymentsAPI, ServiceTitanAPI } from "../api/client";
import { loadTilledJs } from "../lib/tilled";

type MountedTilled = {
  tilled?: { confirmPayment?: (clientSecret: string, payload?: unknown) => Promise<unknown> };
  form?: { confirmPayment?: (clientSecret: string) => Promise<unknown> };
};

type AmountMode = "total" | "balance" | "custom";

type CompletionInfo = {
  status: string;
  paymentId: string;
  providerPaymentId?: string | null;
  invoiceId?: string | null;
  amount?: string | null;
  finishedAt: string;
};

const IN_PROGRESS_STATUSES = new Set(["initiated", "processing"]);

function formatCurrency(value: string | number | undefined | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function coerceServiceTitanRecord(payload: Record<string, unknown> | undefined) {
  if (!payload) return null;
  const data = payload.data;
  if (Array.isArray(data)) {
    return (data[0] ?? null) as Record<string, unknown> | null;
  }

  // Only unwrap explicit list envelopes; do not guess from arbitrary arrays on rich objects (like jobs).
  const envelopeArrayKeys = ["items", "results", "records", "businessUnits", "locations", "customers"] as const;
  for (const key of envelopeArrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return (value[0] ?? null) as Record<string, unknown> | null;
    }
  }

  return payload;
}

function getDeepValue(record: Record<string, unknown> | null, path: string) {
  if (!record) return undefined;
  const segments = path.split(".");
  let current: unknown = record;

  for (const key of segments) {
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  if (current === undefined || current === null) return undefined;
  const text = String(current).trim();
  return text.length > 0 ? text : undefined;
}

function firstNonEmpty(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = getDeepValue(record, key);
    if (value) return value;
  }
  return undefined;
}

function firstNonIdLike(record: Record<string, unknown> | null, keys: string[]) {
  for (const key of keys) {
    const value = getDeepValue(record, key);
    if (!value) continue;
    if (!/^\d+$/.test(value)) return value;
  }
  return undefined;
}

function displayValue(value: unknown, fallback = "-") {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function formatNameWithId(name: unknown, id: unknown) {
  const shownName = displayValue(name, "");
  const shownId = displayValue(id, "");
  if (shownName && shownId) return `${shownName} (ID: ${shownId})`;
  if (shownName) return shownName;
  if (shownId) return shownId;
  return "-";
}

function formatLocationAddress(record: Record<string, unknown> | null) {
  const line1 = firstNonEmpty(record, ["address.street", "address.street1", "address.line1", "street", "street1"]);
  const line2 = firstNonEmpty(record, ["address.street2", "address.line2", "street2"]);
  const city = firstNonEmpty(record, ["address.city", "city"]);
  const state = firstNonEmpty(record, ["address.state", "state", "address.province", "province"]);
  const postal = firstNonEmpty(record, ["address.zip", "address.postalCode", "zip", "postalCode"]);

  const street = [line1, line2].filter(Boolean).join(" ").trim();
  const locality = [city, state, postal].filter(Boolean).join(", ").trim();
  const combined = [street, locality].filter(Boolean).join(" | ").trim();
  return combined.length > 0 ? combined : undefined;
}

function FieldRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="text-right font-medium text-slate-900">{displayValue(value)}</div>
    </div>
  );
}

function clearCardMounts() {
  const numberMount = document.getElementById("tilled-card-number");
  const expiryMount = document.getElementById("tilled-card-expiry");
  const cvvMount = document.getElementById("tilled-card-cvv");

  if (numberMount) numberMount.innerHTML = "";
  if (expiryMount) expiryMount.innerHTML = "";
  if (cvvMount) cvvMount.innerHTML = "";

  (window as Window & { __TPAY_TILLED_FORM__?: MountedTilled }).__TPAY_TILLED_FORM__ = undefined;
}

export default function CollectPaymentPage() {
  const [jobId, setJobId] = useState("");
  const [amountMode, setAmountMode] = useState<AmountMode>("total");
  const [customAmount, setCustomAmount] = useState("");

  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [providerIntentId, setProviderIntentId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const [cardholderName, setCardholderName] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");

  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [completionInfo, setCompletionInfo] = useState<CompletionInfo | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isWaitingForWebhook, setIsWaitingForWebhook] = useState(false);
  const [latestPaymentStatus, setLatestPaymentStatus] = useState<string | null>(null);

  const trimmedJobId = jobId.trim();
  const canStart = Number.isFinite(Number(trimmedJobId)) && Number(trimmedJobId) > 0;
  const needsCustomAmount = amountMode === "custom";
  const canPrepare = canStart && (!needsCustomAmount || customAmount.trim().length > 0) && !isWaitingForWebhook;
  const canConfirm = useMemo(
    () => !!clientSecret && !isPreparing && !isConfirming && !isWaitingForWebhook,
    [clientSecret, isPreparing, isConfirming, isWaitingForWebhook]
  );

  const parsedJobId = Number(trimmedJobId);
  const parsedInvoiceId = Number(invoiceId ?? 0);

  const jobQuery = useQuery({
    queryKey: ["servicetitan-job", parsedJobId],
    queryFn: () => ServiceTitanAPI.getJob(parsedJobId),
    enabled: Number.isFinite(parsedJobId) && parsedJobId > 0,
  });

  const invoiceQuery = useQuery({
    queryKey: ["servicetitan-invoice", parsedInvoiceId],
    queryFn: () => ServiceTitanAPI.getInvoice(parsedInvoiceId),
    enabled: Number.isFinite(parsedInvoiceId) && parsedInvoiceId > 0,
  });

  const paymentQuery = useQuery({
    queryKey: ["payment-after-collect", paymentId],
    queryFn: () => PaymentsAPI.getPayment(paymentId!),
    enabled: Boolean(paymentId),
  });

  async function waitForWebhookStatus(paymentIdForStatus: string) {
    setIsWaitingForWebhook(true);
    setStatus("Payment in progress. Waiting for webhook status update...");

    try {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        const updated = await PaymentsAPI.getPayment(paymentIdForStatus);
        const currentStatus = updated.status?.toLowerCase?.() ?? "unknown";
        setLatestPaymentStatus(currentStatus);

        if (!IN_PROGRESS_STATUSES.has(currentStatus)) {
          setCompletionInfo({
            status: currentStatus,
            paymentId: updated.id,
            providerPaymentId: updated.provider_payment_id ?? null,
            invoiceId: updated.invoice_id ?? invoiceId,
            amount: updated.amount,
            finishedAt: new Date().toISOString(),
          });
          setStatus(`Payment ${currentStatus}.`);
          clearCardMounts();
          setClientSecret(null);
          return;
        }

        await sleep(2000);
      }

      setStatus("Payment is still processing. Waiting for webhook confirmation.");
    } finally {
      setIsWaitingForWebhook(false);
    }
  }

  async function mountCardForm(secret: string) {
    const cfg = await fetch("http://127.0.0.1:8000/tilled/config").then((r) => r.json());
    const Tilled = await loadTilledJs();
    const tilled = new Tilled(cfg.publishable_key, cfg.account_id, { sandbox: cfg.sandbox });
    const form = await tilled.form({ payment_method_type: "card" });

    const numberMount = document.getElementById("tilled-card-number");
    const expiryMount = document.getElementById("tilled-card-expiry");
    const cvvMount = document.getElementById("tilled-card-cvv");
    if (!numberMount || !expiryMount || !cvvMount) {
      throw new Error("Card field containers are missing.");
    }

    numberMount.innerHTML = "";
    expiryMount.innerHTML = "";
    cvvMount.innerHTML = "";

    form.createField("cardNumber").inject("#tilled-card-number");
    form.createField("cardExpiry").inject("#tilled-card-expiry");
    form.createField("cardCvv").inject("#tilled-card-cvv");
    await form.build();

    (window as Window & { __TPAY_TILLED_FORM__?: MountedTilled }).__TPAY_TILLED_FORM__ = { tilled, form };
    setClientSecret(secret);
  }

  async function preparePaymentFlow() {
    if (!canPrepare) return;

    setError("");
    setCompletionInfo(null);
    setStatus("Preparing payment flow from job.");
    setIsPreparing(true);

    setClientSecret(null);
    setProviderIntentId(null);
    setLatestPaymentStatus(null);

    try {
      const payload = {
        currency: "USD",
        amount_source: amountMode === "balance" ? "balance" : "total",
        amount: amountMode === "custom" ? customAmount.trim() : undefined,
      } as const;

      const start = await PaymentsAPI.startFromJob(trimmedJobId, payload);

      setPaymentId(start.payment_id);
      setInvoiceId(String(start.invoice_id));
      setIdempotencyKey(start.idempotency_key);
      setLatestPaymentStatus(start.status);
      setStatus("Internal payment created. Creating provider intent.");

      const provider = await PaymentsAPI.createProviderIntent(start.payment_id);
      const secret = provider.client_secret;
      if (!secret) {
        throw new Error("Provider intent was created but no client_secret was returned.");
      }

      setProviderIntentId(provider.provider_payment_intent_id ?? null);
      setStatus("Provider intent created. Loading card form.");

      await mountCardForm(secret);
      setStatus("Card form ready. Enter card details and submit payment.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to prepare payment flow.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function confirmPayment() {
    if (!clientSecret || !paymentId) return;

    setError("");
    setStatus("Confirming payment.");
    setIsConfirming(true);

    const stored = (window as Window & { __TPAY_TILLED_FORM__?: MountedTilled }).__TPAY_TILLED_FORM__;

    if (!stored?.tilled && !stored?.form) {
      setError("Card form is not mounted. Click 'Load job and start payment' first.");
      setIsConfirming(false);
      return;
    }

    try {
      let result: unknown;

      if (stored?.tilled?.confirmPayment) {
        result = await stored.tilled.confirmPayment(clientSecret, {
          payment_method: {
            type: "card",
            billing_details: {
              name: cardholderName,
              address: {
                zip,
                country,
              },
            },
          },
        });
      } else if (stored?.form?.confirmPayment) {
        result = await stored.form.confirmPayment(clientSecret);
      } else {
        throw new Error("No compatible confirmPayment method found in Tilled SDK object.");
      }

      const resultObj = (typeof result === "object" && result !== null ? result : {}) as Record<string, unknown>;
      const resultError =
        displayValue(resultObj.error, "") ||
        displayValue(resultObj.last_payment_error, "") ||
        displayValue(resultObj.message, "");
      if (resultError) {
        throw new Error(resultError);
      }

      await waitForWebhookStatus(paymentId);
    } catch (err) {
      if (err instanceof Error) {
        setError(`Payment confirmation failed: ${err.message}`);
      } else {
        setError("Payment confirmation failed.");
      }
      setIsWaitingForWebhook(false);
    } finally {
      setIsConfirming(false);
    }
  }

  const jobRecord = coerceServiceTitanRecord(jobQuery.data as Record<string, unknown> | undefined);
  const invoiceRecord = coerceServiceTitanRecord(invoiceQuery.data as unknown as Record<string, unknown> | undefined);

  const customerId = firstNonEmpty(jobRecord, ["customer.id", "customerId"]);
  const parsedCustomerId = Number(customerId ?? 0);
  const customerQuery = useQuery({
    queryKey: ["servicetitan-customer", parsedCustomerId],
    queryFn: () => ServiceTitanAPI.getCustomer(parsedCustomerId),
    enabled: Number.isFinite(parsedCustomerId) && parsedCustomerId > 0,
  });
  const customerRecord = coerceServiceTitanRecord(customerQuery.data as unknown as Record<string, unknown> | undefined);

  const customerName =
    firstNonEmpty(customerRecord, ["name", "displayName", "firstName"]) ??
    firstNonEmpty(jobRecord, ["customer.name", "customerName", "customer.displayName"]);

  const technicianName = firstNonEmpty(jobRecord, ["technician.name", "technicianName", "assignedTechnician.name"]);
  const technicianId = firstNonEmpty(jobRecord, ["technician.id", "technicianId", "assignedTechnician.id"]);
  const locationId =
    firstNonEmpty(jobRecord, ["location.id", "locationId"]) ??
    firstNonEmpty(invoiceRecord, ["location.id", "locationId"]);
  const parsedLocationId = Number(locationId ?? 0);
  const locationQuery = useQuery({
    queryKey: ["servicetitan-location", parsedLocationId],
    queryFn: () => ServiceTitanAPI.getLocation(parsedLocationId),
    enabled: Number.isFinite(parsedLocationId) && parsedLocationId > 0,
  });
  const locationRecord = coerceServiceTitanRecord(locationQuery.data as unknown as Record<string, unknown> | undefined);
  const locationAddress = formatLocationAddress(locationRecord);
  const locationNameFromRecord =
    firstNonEmpty(locationRecord, ["displayName", "locationName", "location.displayName", "location.name", "name"]) ??
    firstNonEmpty(jobRecord, ["location.name", "locationName", "locationDisplayName"]) ??
    firstNonEmpty(invoiceRecord, ["location.name", "locationName", "locationDisplayName"]);
  const normalizedCustomerName = displayValue(customerName, "").toLowerCase();
  const normalizedLocationName = displayValue(locationNameFromRecord, "").toLowerCase();
  const locationName =
    locationAddress && normalizedLocationName && normalizedLocationName === normalizedCustomerName
      ? locationAddress
      : locationNameFromRecord ?? locationAddress;
  const businessUnitId =
    firstNonEmpty(jobRecord, ["businessUnit.id", "businessUnitId"]) ??
    firstNonEmpty(invoiceRecord, ["businessUnit.id", "businessUnitId"]) ??
    firstNonEmpty(locationRecord, ["businessUnit.id", "businessUnitId", "businessUnitIds.0", "businessUnits.0.id"]);
  const parsedBusinessUnitId = Number(businessUnitId ?? 0);
  const businessUnitQuery = useQuery({
    queryKey: ["servicetitan-business-unit", parsedBusinessUnitId],
    queryFn: () => ServiceTitanAPI.getBusinessUnit(parsedBusinessUnitId),
    enabled: Number.isFinite(parsedBusinessUnitId) && parsedBusinessUnitId > 0,
  });
  const businessUnitRecord = coerceServiceTitanRecord(
    businessUnitQuery.data as unknown as Record<string, unknown> | undefined
  );
  const businessUnitName =
    firstNonIdLike(businessUnitRecord, [
      "name",
      "displayName",
      "officialName",
      "shortName",
      "businessUnitName",
      "businessUnitDisplayName",
      "businessUnit.name",
    ]) ??
    firstNonIdLike(jobRecord, [
      "businessUnit.name",
      "businessUnitName",
      "businessUnitDisplayName",
      "businessUnit",
    ]) ??
    firstNonIdLike(invoiceRecord, [
      "businessUnit.name",
      "businessUnitName",
      "businessUnitDisplayName",
      "businessUnit",
    ]) ??
    firstNonIdLike(locationRecord, [
      "businessUnit.name",
      "businessUnitName",
      "businessUnitDisplayName",
      "businessUnits.0.name",
    ]);

  const jobInfo = {
    id: firstNonEmpty(jobRecord, ["id", "jobId", "job_id"]) ?? trimmedJobId,
    status: firstNonEmpty(jobRecord, ["jobStatus", "status", "statusName"]),
    appointment: firstNonEmpty(jobRecord, ["appointmentStatus", "appointment.status", "appointment_status"]),
    customer: formatNameWithId(customerName, customerId),
    technician: formatNameWithId(technicianName, technicianId),
    businessUnit: displayValue(businessUnitName ?? businessUnitId),
    location: displayValue(locationName),
  };

  const invoiceInfo = {
    id: firstNonEmpty(invoiceRecord, ["id", "invoiceId", "invoice_id"]) ?? invoiceId,
    number: firstNonEmpty(invoiceRecord, ["invoiceNumber", "number", "invoiceNo", "displayNumber"]),
    total: firstNonEmpty(invoiceRecord, ["total", "invoiceTotal", "amount"]),
    balance: firstNonEmpty(invoiceRecord, ["balance", "balanceDue", "amountDue"]),
    tax: firstNonEmpty(invoiceRecord, ["tax", "taxAmount"]),
    dueDate: firstNonEmpty(invoiceRecord, ["dueDate", "due_on", "due"]),
    createdOn: firstNonEmpty(invoiceRecord, ["createdOn", "createdAt", "created_at"]),
  };

  const shownStatus = latestPaymentStatus ?? paymentQuery.data?.status;
  const showCardEntry = Boolean(clientSecret || isPreparing || isConfirming || isWaitingForWebhook);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.18),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#f7fbff_45%,#fdf8ef_100%)]">
          <CardHeader>
            <CardTitle>Collect payment</CardTitle>
            <CardDescription>
              Technician enters job ID, picks amount type, we prepare payment automatically, then submit on confirm.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span className="rounded-full bg-white px-3 py-1.5">Technician enters job</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="rounded-full bg-white px-3 py-1.5">TPay prepares payment</span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
              <span className="rounded-full bg-white px-3 py-1.5">Confirm card payment</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">ServiceTitan job ID</div>
                <Input
                  value={jobId}
                  onChange={(e) => setJobId(e.target.value)}
                  placeholder="e.g. 2631227623"
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Amount type</div>
                <select
                  value={amountMode}
                  onChange={(e) => setAmountMode(e.target.value as AmountMode)}
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="total">Invoice total</option>
                  <option value="balance">Invoice balance</option>
                  <option value="custom">Custom amount</option>
                </select>
              </div>

              {amountMode === "custom" ? (
                <div className="md:col-span-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Custom amount</div>
                  <Input
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="e.g. 59.99"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={preparePaymentFlow} disabled={!canPrepare || isPreparing}>
                {isPreparing ? "Preparing..." : "Load job and start payment"}
              </Button>
            </div>

            {showCardEntry ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                  <CreditCard className="h-4 w-4 text-slate-500" />
                  Tilled card entry
                </div>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Cardholder name</div>
                    <Input
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      placeholder="e.g. Joe Doe"
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">ZIP</div>
                    <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="e.g. 80021" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Country</div>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value.toUpperCase())}
                      placeholder="e.g. US"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-slate-500">Card number</div>
                    <div id="tilled-card-number" className="h-12 rounded-xl border border-slate-200 px-3" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-slate-500">Expiry</div>
                      <div id="tilled-card-expiry" className="h-12 rounded-xl border border-slate-200 px-3" />
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-slate-500">CVV</div>
                      <div id="tilled-card-cvv" className="h-12 rounded-xl border border-slate-200 px-3" />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button onClick={confirmPayment} disabled={!canConfirm}>
                    {isConfirming ? "Confirming..." : "Confirm payment"}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="rounded-3xl bg-slate-950 p-4 text-xs text-slate-100 space-y-2">
              {isWaitingForWebhook ? (
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                  <span>Payment in progress. Waiting for webhook status...</span>
                </div>
              ) : null}
              {completionInfo ? (
                <div className="rounded-xl border border-emerald-300/30 bg-emerald-400/10 p-3 text-emerald-100">
                  <div className="font-semibold">Payment {completionInfo.status}</div>
                  <div>Payment ID: {completionInfo.paymentId}</div>
                  <div>Provider Payment: {displayValue(completionInfo.providerPaymentId)}</div>
                  <div>Invoice ID: {displayValue(completionInfo.invoiceId)}</div>
                  <div>Amount: {formatCurrency(completionInfo.amount)}</div>
                  <div>Completed at: {formatDateTime(completionInfo.finishedAt)}</div>
                </div>
              ) : null}
              {error ? <div className="whitespace-pre-wrap">ERROR: {error}</div> : null}
              <div className="whitespace-pre-wrap">{status || "No action yet."}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked records</CardTitle>
            <CardDescription>Useful job, invoice, and payment context for the technician.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <FileText className="h-4 w-4 text-slate-500" />
                ServiceTitan job
              </div>
              <div className="space-y-2">
                <FieldRow label="Job ID" value={jobInfo.id} />
                <FieldRow label="Status" value={jobInfo.status} />
                <FieldRow label="Appointment" value={jobInfo.appointment} />
                <FieldRow label="Customer" value={jobInfo.customer} />
                <FieldRow label="Technician" value={jobInfo.technician} />
                <FieldRow label="Business unit" value={jobInfo.businessUnit} />
                <FieldRow label="Location" value={jobInfo.location} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <Link2 className="h-4 w-4 text-slate-500" />
                ServiceTitan invoice
              </div>
              <div className="space-y-2">
                <FieldRow label="Invoice ID" value={invoiceInfo.id} />
                <FieldRow label="Invoice number" value={invoiceInfo.number} />
                <FieldRow label="Total" value={invoiceInfo.total} />
                <FieldRow label="Balance" value={invoiceInfo.balance} />
                <FieldRow label="Tax" value={invoiceInfo.tax} />
                <FieldRow label="Due date" value={invoiceInfo.dueDate} />
                <FieldRow label="Created on" value={invoiceInfo.createdOn} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                TPay payment
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div>Payment ID: {displayValue(paymentId)}</div>
                <div>Provider intent: {displayValue(providerIntentId)}</div>
                <div>Status: {displayValue(shownStatus, "Not created")}</div>
                <div>Amount: {formatCurrency(paymentQuery.data?.amount)}</div>
                <div>Idempotency key: {displayValue(idempotencyKey)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
