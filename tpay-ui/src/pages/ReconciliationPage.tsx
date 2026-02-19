import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./../components/ui/card";
import { Badge } from "./../components/ui/badge";
import { Button } from "./../components/ui/button";
import { Input } from "./../components/ui/input";
import { Table, TBody, THead, TD, TH, TR } from "./../components/ui/table";

/**
 * Hook this to your real API calls:
 * - POST /reconciliation/run?report_date=YYYY-MM-DD
 * - GET  /reconciliation/exceptions
 */
type ExceptionRow = {
  payment_id: string;
  provider_payment_id: string | null;
  expected: number | null;
  actual: number | null;
  status: "MISMATCH" | "MISSING";
  source_table: string;
};

function StatusBadge({ status }: { status: ExceptionRow["status"] }) {
  if (status === "MISMATCH") {
    return <Badge className="border-orange-200 bg-orange-50 text-orange-700">MISMATCH</Badge>;
  }
  return <Badge className="border-rose-200 bg-rose-50 text-rose-700">MISSING</Badge>;
}

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "orange" | "rose";
}) {
  const tones: Record<typeof tone, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`min-w-[140px] rounded-xl border px-5 py-3 ${tones[tone]}`}>
      <div className="text-sm font-semibold">
        {label}: <span className="text-base font-bold">{value}</span>
      </div>
    </div>
  );
}


export default function ReconciliationPage() {
  const nav = useNavigate();
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ✅ Replace this with data from GET /reconciliation/exceptions
  const exceptions: ExceptionRow[] = [];

  const counts = useMemo(() => {
    const mismatch = exceptions.filter(e => e.status === "MISMATCH").length;
    const missing = exceptions.filter(e => e.status === "MISSING").length;
    return { mismatch, missing, matched: 0, lastRunId: "recon_YYYYMMDD_HHMM" };
  }, [exceptions]);

  const runRecon = async () => {
    // TODO: call POST /reconciliation/run?report_date=...
    // then refetch exceptions list
    console.log("Run recon for date:", reportDate);
  };

  return (
    <div className="w-full space-y-6 px-8 py-8">
      <div>
        <div className="text-2xl font-bold text-slate-900">Reconciliation Dashboard (Exception-Driven)</div>
        <div className="text-sm text-slate-600">
          Calls: POST <code>/reconciliation/run?report_date={reportDate}</code> and GET <code>/reconciliation/exceptions</code>
        </div>
      </div>

      <Card className="rounded-2xl border border-slate-200 shadow-md">
        <CardContent className="p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-3">
            <StatPill label="Matched" value={counts.matched} tone="green" />
            <StatPill label="Mismatch" value={counts.mismatch} tone="orange" />
            <StatPill label="Missing" value={counts.missing} tone="rose" />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-500">
              Last run_id:{" "}
              <span className="font-mono text-slate-700">{counts.lastRunId}</span>
            </div>

            <div className="w-[160px]">
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>

            <Button className="h-10 px-5" onClick={runRecon}>
              Run Recon
            </Button>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exceptions</CardTitle>
          <CardDescription>Review mismatches/missing items and resolve.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <Table>
              <THead>
                <TR className="bg-slate-50">
                  <TH className="uppercase tracking-wide text-xs text-slate-500">PAYMENT ID</TH>
                  <TH>PROVIDER PAYMENT ID</TH>
                  <TH>EXPECTED</TH>
                  <TH>ACTUAL</TH>
                  <TH>STATUS</TH>
                  <TH>SOURCE TABLE</TH>
                  <TH>ACTION</TH>
                </TR>
              </THead>
              <TBody>
                {exceptions.length === 0 ? (
                  <TR>
                    <TD colSpan={7} className="py-20 text-center">
                      <div className="text-slate-600 font-medium">No exceptions yet</div>
                      <div className="text-sm text-slate-400 mt-1">
                        Run reconciliation to populate this table.
                      </div>
                    </TD>
                  </TR>
                ) : (
                  exceptions.map((row) => (
                    <TR key={row.payment_id}>
                      <TD className="font-mono text-xs">{row.payment_id}</TD>
                      <TD className="font-mono text-xs">{row.provider_payment_id ?? "null"}</TD>
                      <TD>{row.expected ?? "null"}</TD>
                      <TD>{row.actual ?? "null"}</TD>
                      <TD><StatusBadge status={row.status} /></TD>
                      <TD className="text-slate-600">{row.source_table}</TD>
                      <TD>
                        <Button
                          variant="secondary"
                          onClick={() => nav(`/reconciliation/exceptions/${encodeURIComponent(row.payment_id)}`)}
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
