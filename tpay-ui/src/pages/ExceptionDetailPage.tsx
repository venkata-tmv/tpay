import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./../components/ui/card";
import { Badge } from "./../components/ui/badge";
import { Button } from "./../components/ui/button";

type Detail = {
  status: "MISMATCH" | "MISSING";
  payment_id: string;
  job_id: string;
  invoice_id: string;
  expected_amount: number | null;
  internal_status: string;
  provider_payment_id: string | null;
  provider_amount: number | null;
  provider_status: string | null;
  difference: number | null;
  reconciliation_run_id: string | null;
};

function StatusBadge({ status }: { status: Detail["status"] }) {
  if (status === "MISMATCH") return <Badge className="border-orange-200 bg-orange-50 text-orange-700">STATUS: MISMATCH</Badge>;
  return <Badge className="border-rose-200 bg-rose-50 text-rose-700">STATUS: MISSING</Badge>;
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b py-2 last:border-b-0">
      <div className="text-xs font-semibold text-slate-500">{k}</div>
      <div className="text-sm font-semibold text-slate-900">{v ?? "null"}</div>
    </div>
  );
}

export default function ExceptionDetailPage() {
  const { paymentId } = useParams();
  const [note, setNote] = useState("");

  // ✅ Replace with API fetch: GET /reconciliation/exceptions + GET /payments/{id}
  const detail: Detail = useMemo(() => ({
    status: "MISMATCH",
    payment_id: paymentId ?? "",
    job_id: "JOB-10231",
    invoice_id: "INV-88021",
    expected_amount: 250.75,
    internal_status: "succeeded",
    provider_payment_id: "pi_9....",
    provider_amount: 245.75,
    provider_status: "succeeded",
    difference: -5.0,
    reconciliation_run_id: "recon_20260219_0900",
  }), [paymentId]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-bold text-slate-900">Exception Detail - Review</div>
        <div className="text-sm text-slate-600">
          Loaded from GET <code>/reconciliation/exceptions</code> + payment metadata from <code>/payments</code>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={detail.status} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>INTERNAL RECORD <span className="text-slate-500">(payments)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Row k="payment_id" v={detail.payment_id} />
            <Row k="job_id" v={detail.job_id} />
            <Row k="invoice_id" v={detail.invoice_id} />
            <Row k="expected_amount" v={detail.expected_amount} />
            <Row k="internal_status" v={detail.internal_status} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PROVIDER RECORD <span className="text-slate-500">(Tilled)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Row k="provider_payment_id" v={detail.provider_payment_id} />
            <Row k="provider_amount" v={detail.provider_amount} />
            <Row k="provider_status" v={detail.provider_status} />
            <Row k="difference" v={detail.difference} />
            <Row k="reconciliation_run_id" v={detail.reconciliation_run_id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>REVIEW NOTE</CardTitle>
          <CardDescription>Track what you found and how you resolved it.</CardDescription>
        </CardHeader>
        <CardContent>
          <textarea
            className="w-full min-h-28 rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Example: Provider settlement fee included in amount. Marking as explained variance."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="mt-4 flex gap-3">
            <Button onClick={() => console.log("Mark resolved", { paymentId: detail.payment_id, note })}>
              Mark Resolved
            </Button>
            <Button variant="secondary" onClick={() => console.log("Escalate", { paymentId: detail.payment_id, note })}>
              Escalate
            </Button>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            DB refs: <span className="font-mono">payments, reconciliation_items, reconciliation_runs, webhook_events</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
