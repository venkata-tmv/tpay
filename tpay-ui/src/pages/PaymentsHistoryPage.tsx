import { useState } from "react";
import { Button } from "./../components/ui/button";
import { Input } from "./../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./../components/ui/card";
import { PaymentsAPI } from "./../api/client";

type PaymentDetail = {
  id: string;
  job_id: string;
  invoice_id: string;
  amount: string;
  currency: string;
  status: string;
  provider_payment_id?: string | null;
};

export default function PaymentsHistoryPage() {
  const [paymentId, setPaymentId] = useState("");
  const [items, setItems] = useState<PaymentDetail[]>([]);
  const [msg, setMsg] = useState("");

  async function fetchOne() {
    setMsg("Loading...");
    const p = await PaymentsAPI.getPayment(paymentId);
    setItems([p]);
    setMsg("");
  }

  async function fetchRecent() {
    setMsg("Loading...");
    // If your backend supports query params like ?limit=20, use it here.
    const list = await PaymentsAPI.listPayments("?limit=20");
    setItems(list);
    setMsg("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="w-full md:w-96">
            <div className="text-xs text-gray-600 mb-1">Payment ID</div>
            <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="uuid..." />
          </div>
          <Button onClick={fetchOne} disabled={!paymentId}>
            Get Payment
          </Button>
          <Button variant="outline" onClick={fetchRecent}>
            Load Recent
          </Button>
        </div>

        {msg && <div className="text-sm text-gray-600">{msg}</div>}

        <div className="overflow-auto border border-gray-200 rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Payment</th>
                <th className="text-left p-2">Job</th>
                <th className="text-left p-2">Invoice</th>
                <th className="text-left p-2">Amount</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Provider PI</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2 font-mono text-xs">{p.id}</td>
                  <td className="p-2">{p.job_id}</td>
                  <td className="p-2">{p.invoice_id}</td>
                  <td className="p-2">{p.amount} {p.currency}</td>
                  <td className="p-2">{p.status}</td>
                  <td className="p-2 font-mono text-xs">{p.provider_payment_id ?? "-"}</td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-600" colSpan={6}>
                    No records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
