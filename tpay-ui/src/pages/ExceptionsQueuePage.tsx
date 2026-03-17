import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock3, Search } from "lucide-react";
import { ReconciliationAPI, type ReconciliationException } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

type QueueItemState = {
  owner: string;
  note: string;
  state: "open" | "reviewed" | "resolved";
  priorityOverride: "auto" | "high" | "medium" | "low";
};

const STORAGE_KEY = "tpay.exceptions.queue.v1";

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value ?? 0));
}

function exceptionPriority(item: ReconciliationException): "high" | "medium" | "low" {
  const diff = Math.abs(Number(item.expected_amount ?? 0) - Number(item.actual_amount ?? 0));
  if ((item.status ?? "").toLowerCase() === "missing" || diff >= 100) return "high";
  if (diff >= 25) return "medium";
  return "low";
}

function effectivePriority(item: ReconciliationException, state: QueueItemState | undefined): "high" | "medium" | "low" {
  if (!state || state.priorityOverride === "auto") return exceptionPriority(item);
  return state.priorityOverride;
}

function priorityTone(priority: "high" | "medium" | "low") {
  if (priority === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function stateTone(state: QueueItemState["state"]) {
  if (state === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "reviewed") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function loadQueueState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {} as Record<string, QueueItemState>;
    return JSON.parse(raw) as Record<string, QueueItemState>;
  } catch {
    return {} as Record<string, QueueItemState>;
  }
}

function stateKey(item: ReconciliationException) {
  return `${item.payment_id}:${item.run_id ?? "latest"}`;
}

export default function ExceptionsQueuePage() {
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | QueueItemState["state"]>("all");
  const [queueState, setQueueState] = useState<Record<string, QueueItemState>>(() => loadQueueState());

  const exceptionsQuery = useQuery({
    queryKey: ["exceptions-queue"],
    queryFn: () => ReconciliationAPI.exceptions("?limit=200"),
  });

  const saveQueueState = (next: Record<string, QueueItemState>) => {
    setQueueState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const rows = useMemo(() => {
    const items = exceptionsQuery.data ?? [];
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const key = stateKey(item);
      const entry = queueState[key];
      const p = effectivePriority(item, entry);
      const state = entry?.state ?? "open";
      if (priorityFilter !== "all" && p !== priorityFilter) return false;
      if (workflowFilter !== "all" && state !== workflowFilter) return false;
      if (!needle) return true;
      return (
        item.payment_id.toLowerCase().includes(needle) ||
        String(item.provider_payment_id ?? "").toLowerCase().includes(needle) ||
        String(item.error ?? "").toLowerCase().includes(needle) ||
        p.includes(needle) ||
        state.includes(needle)
      );
    });
  }, [exceptionsQuery.data, search, priorityFilter, workflowFilter, queueState]);

  const counts = useMemo(() => {
    return rows.reduce(
      (acc, item) => {
        const key = stateKey(item);
        const entry = queueState[key];
        const p = effectivePriority(item, entry);
        const state = entry?.state ?? "open";
        if (p === "high") acc.high += 1;
        if (state === "open") acc.open += 1;
        if (state === "resolved") acc.resolved += 1;
        return acc;
      },
      { high: 0, open: 0, resolved: 0 }
    );
  }, [rows, queueState]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(248,113,113,0.10),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#fff8f6_50%,#f8fbff_100%)]">
        <CardHeader>
          <CardTitle>Exceptions Queue</CardTitle>
          <CardDescription>Priority triage board for mismatch and missing payment exceptions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by payment, external ref, error, priority, or state"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow</div>
            <select
              value={workflowFilter}
              onChange={(e) => setWorkflowFilter(e.target.value as typeof workflowFilter)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="reviewed">Reviewed</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setPriorityFilter("all");
              setWorkflowFilter("all");
            }}
          >
            Reset filters
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-slate-500">High priority</div>
            <div className="mt-2 text-3xl font-semibold text-rose-700">{counts.high}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-slate-500">Open</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{counts.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-slate-500">Resolved</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-700">{counts.resolved}</div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardDescription>Assign, note, and move exceptions through review workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {exceptionsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Loading exceptions...
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No exceptions in queue.
            </div>
          ) : (
            rows.map((item) => {
              const key = stateKey(item);
              const state = queueState[key] ?? {
                owner: "",
                note: "",
                state: "open" as const,
                priorityOverride: "auto" as const,
              };
              const priority = effectivePriority(item, state);
              return (
                <div key={key} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{item.payment_id}</div>
                      <div className="text-sm text-slate-500">
                        Expected {formatCurrency(item.expected_amount)} | Actual {formatCurrency(item.actual_amount)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={priorityTone(priority)}>{priority}</Badge>
                      <Badge className={stateTone(state.state)}>{state.state}</Badge>
                      <Badge className={(item.status ?? "").toLowerCase() === "mismatch" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                        {item.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                    <Input
                      value={state.owner}
                      onChange={(e) =>
                        saveQueueState({
                          ...queueState,
                          [key]: { ...state, owner: e.target.value },
                        })
                      }
                      placeholder="Assign owner (name/email)"
                    />
                    <Input
                      value={state.note}
                      onChange={(e) =>
                        saveQueueState({
                          ...queueState,
                          [key]: { ...state, note: e.target.value },
                        })
                      }
                      placeholder="Add internal note"
                    />
                    <div className="flex flex-wrap gap-2">
                      {state.state !== "open" ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            saveQueueState({
                              ...queueState,
                              [key]: { ...state, state: "open" },
                            })
                          }
                        >
                          Reopen
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={() =>
                          saveQueueState({
                            ...queueState,
                            [key]: { ...state, state: "reviewed" },
                          })
                        }
                      >
                        Reviewed
                      </Button>
                      <Button
                        onClick={() =>
                          saveQueueState({
                            ...queueState,
                            [key]: { ...state, state: "resolved" },
                          })
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">Priority override</span>
                    <select
                      value={state.priorityOverride}
                      onChange={(e) =>
                        saveQueueState({
                          ...queueState,
                          [key]: {
                            ...state,
                            priorityOverride: e.target.value as QueueItemState["priorityOverride"],
                          },
                        })
                      }
                      className="rounded-lg border bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="auto">Auto</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    {state.priorityOverride !== "auto" ? (
                      <span className="text-xs text-slate-500">
                        Auto: {exceptionPriority(item)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-slate-400" />
                      External ref: {item.provider_payment_id ?? "-"} | Internal: {item.internal_status ?? "-"} | External status:{" "}
                      {item.provider_status ?? "-"}
                    </div>
                    <Link
                      to={`/reconciliation/exceptions/${encodeURIComponent(item.payment_id)}${item.run_id ? `?run_id=${encodeURIComponent(item.run_id)}` : ""}`}
                      className="font-semibold text-slate-700 hover:text-slate-950"
                    >
                      Open detail
                    </Link>
                  </div>

                  {item.error ? (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <Clock3 className="mr-2 inline h-4 w-4 text-slate-400" />
                      {item.error}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
