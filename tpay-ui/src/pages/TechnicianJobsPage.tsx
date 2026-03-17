import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, Search } from "lucide-react";
import { ServiceTitanAPI } from "../api/client";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function nestedString(record: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const parts = path.split(".");
    let current: unknown = record;
    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in (current as Record<string, unknown>))) {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current === undefined || current === null) continue;
    const text = String(current).trim();
    if (text) return text;
  }
  return "";
}

function recordFromEnvelope(payload: Record<string, unknown> | undefined) {
  if (!payload) return null;
  const data = payload.data;
  if (Array.isArray(data)) return (data[0] ?? null) as Record<string, unknown> | null;
  const keys = ["items", "results", "records", "customers", "locations"] as const;
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return (value[0] ?? null) as Record<string, unknown> | null;
  }
  return payload;
}

function extractJobRows(payload: Record<string, unknown> | undefined) {
  if (!payload) return [] as Record<string, unknown>[];
  const candidates = ["data", "items", "results", "records"];
  for (const key of candidates) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
    }
  }
  if (Array.isArray(payload.jobs)) {
    return payload.jobs.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null);
  }
  return [];
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("complete")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized.includes("cancel")) return "border-rose-200 bg-rose-50 text-rose-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function formatDateTime(value?: string) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  // ServiceTitan sometimes uses sentinel dates for "not scheduled yet".
  if (d.getFullYear() <= 1901) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export default function TechnicianJobsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const jobsQuery = useQuery({
    queryKey: ["technician-my-jobs", statusFilter],
    queryFn: () =>
      ServiceTitanAPI.listJobs(
        `?page=1&pageSize=50&includeTotal=true${statusFilter === "all" ? "" : `&jobStatus=${encodeURIComponent(statusFilter)}`}`
      ),
  });

  const jobs = useMemo(() => {
    const rows = extractJobRows(jobsQuery.data as Record<string, unknown> | undefined);
    return rows
      .map((job) => {
        const id = firstString(job, ["id", "jobId"]);
        return {
          id,
          number: firstString(job, ["number", "jobNumber"]),
          status: firstString(job, ["jobStatus", "status", "statusName"]) || "unknown",
          appointmentStatus: nestedString(job, ["appointmentStatus", "appointment.status", "appointmentStatusName"]),
          customerName:
            nestedString(job, ["customer.name", "customer.displayName", "customerName"]) ||
            firstString(job, ["customer", "customerLabel"]),
          customerId: nestedString(job, ["customer.id", "customerId"]),
          locationName:
            nestedString(job, ["location.name", "location.displayName", "locationName", "locationDisplayName"]) ||
            firstString(job, ["location", "locationLabel"]),
          locationId: nestedString(job, ["location.id", "locationId"]),
          invoiceId: nestedString(job, ["invoice.id", "invoiceId", "invoiceIds.0", "invoices.0.id"]),
          businessUnit: nestedString(job, ["businessUnit.name", "businessUnitName", "businessUnitDisplayName"]),
          workType: nestedString(job, ["jobType.name", "summary", "description", "campaign.name"]),
          startTime: nestedString(job, ["startTime", "createdOn", "createdAt"]),
        };
      })
      .filter((job) => job.id);
  }, [jobsQuery.data]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return jobs;
    return jobs.filter((job) => {
      return (
        job.id.toLowerCase().includes(needle) ||
        job.number.toLowerCase().includes(needle) ||
        job.customerName.toLowerCase().includes(needle) ||
        job.locationName.toLowerCase().includes(needle) ||
        job.status.toLowerCase().includes(needle)
      );
    });
  }, [jobs, search]);
  const jobsForDetailLookup = filtered.slice(0, 20);
  const detailQueries = useQueries({
    queries: jobsForDetailLookup.map((job) => ({
      queryKey: ["technician-job-detail-row", job.id],
      queryFn: () => ServiceTitanAPI.getJob(job.id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  const detailByJobId = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>();
    detailQueries.forEach((q, idx) => {
      const jobId = jobsForDetailLookup[idx]?.id;
      if (!jobId || !q.data || typeof q.data !== "object") return;
      map.set(jobId, q.data as Record<string, unknown>);
    });
    return map;
  }, [detailQueries, jobsForDetailLookup]);

  const customerIdsToLookup = useMemo(() => {
    const ids = new Set<string>();
    jobsForDetailLookup.forEach((job) => {
      const detail = detailByJobId.get(job.id);
      const customerName =
        job.customerName ||
        nestedString(detail ?? {}, ["customer.name", "customer.displayName", "customerName"]);
      if (customerName) return;
      const customerId =
        job.customerId ||
        nestedString(detail ?? {}, ["customer.id", "customerId"]);
      if (customerId) ids.add(customerId);
    });
    return Array.from(ids);
  }, [jobsForDetailLookup, detailByJobId]);

  const customerQueries = useQueries({
    queries: customerIdsToLookup.map((customerId) => ({
      queryKey: ["technician-customer-name", customerId],
      queryFn: () => ServiceTitanAPI.getCustomer(customerId),
      staleTime: 10 * 60 * 1000,
    })),
  });
  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    customerQueries.forEach((q, idx) => {
      const id = customerIdsToLookup[idx];
      if (!id || !q.data || typeof q.data !== "object") return;
      const record = recordFromEnvelope(q.data as Record<string, unknown>);
      const name =
        nestedString(record ?? {}, ["name", "displayName", "firstName"]) ||
        firstString(record ?? {}, ["name", "displayName", "firstName"]);
      if (name) map.set(id, name);
    });
    return map;
  }, [customerQueries, customerIdsToLookup]);

  const locationIdsToLookup = useMemo(() => {
    const ids = new Set<string>();
    jobsForDetailLookup.forEach((job) => {
      const detail = detailByJobId.get(job.id);
      const locationName =
        job.locationName ||
        nestedString(detail ?? {}, ["location.name", "location.displayName", "locationName", "locationDisplayName"]);
      if (locationName) return;
      const locationId =
        job.locationId ||
        nestedString(detail ?? {}, ["location.id", "locationId"]);
      if (locationId) ids.add(locationId);
    });
    return Array.from(ids);
  }, [jobsForDetailLookup, detailByJobId]);

  const locationQueries = useQueries({
    queries: locationIdsToLookup.map((locationId) => ({
      queryKey: ["technician-location-name", locationId],
      queryFn: () => ServiceTitanAPI.getLocation(locationId),
      staleTime: 10 * 60 * 1000,
    })),
  });
  const locationNameById = useMemo(() => {
    const map = new Map<string, string>();
    locationQueries.forEach((q, idx) => {
      const id = locationIdsToLookup[idx];
      if (!id || !q.data || typeof q.data !== "object") return;
      const record = recordFromEnvelope(q.data as Record<string, unknown>);
      const name =
        nestedString(record ?? {}, ["name", "displayName", "locationName"]) ||
        firstString(record ?? {}, ["name", "displayName", "locationName"]);
      if (name) map.set(id, name);
    });
    return map;
  }, [locationQueries, locationIdsToLookup]);

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_30%),linear-gradient(135deg,#ffffff_0%,#f6fffb_50%,#f8fafc_100%)]">
        <CardHeader>
          <CardTitle>My Jobs</CardTitle>
          <CardDescription>Assigned jobs with quick jump into payment collection.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search job ID, customer, location, or status"
            />
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Job status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="Completed">Completed</option>
              <option value="Dispatched">Dispatched</option>
              <option value="InProgress">In Progress</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Job List</CardTitle>
          <CardDescription>Use “Collect payment” to open the collect flow with prefilled job ID.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobsQuery.isLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Loading jobs...
            </div>
          ) : jobsQuery.isError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
              Unable to load jobs. Check external job connection.
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              No jobs found.
            </div>
          ) : (
            filtered.map((job) => (
              <div key={job.id} className="rounded-2xl border border-slate-200 p-4">
                {(() => {
                  const detail = detailByJobId.get(job.id);
                  const detailCustomerId = nestedString(detail ?? {}, ["customer.id", "customerId"]);
                  const detailLocationId = nestedString(detail ?? {}, ["location.id", "locationId"]);
                  const customerId = job.customerId || detailCustomerId;
                  const locationId = job.locationId || detailLocationId;
                  const customerName =
                    job.customerName ||
                    nestedString(detail ?? {}, ["customer.name", "customer.displayName", "customerName"]) ||
                    (customerId ? customerNameById.get(customerId) ?? "" : "");
                  const locationName =
                    job.locationName ||
                    nestedString(detail ?? {}, ["location.name", "location.displayName", "locationName", "locationDisplayName"]) ||
                    (locationId ? locationNameById.get(locationId) ?? "" : "");
                  const workType =
                    job.workType ||
                    nestedString(detail ?? {}, ["jobType.name", "summary", "description", "campaign.name"]);
                  const invoiceId =
                    job.invoiceId ||
                    nestedString(detail ?? {}, ["invoice.id", "invoiceId", "invoiceIds.0", "invoices.0.id"]);
                  const businessUnit =
                    job.businessUnit ||
                    nestedString(detail ?? {}, ["businessUnit.name", "businessUnitName", "businessUnitDisplayName"]);

                  return (
                    <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <BriefcaseBusiness className="h-4 w-4 text-slate-500" />
                    Job {job.id}
                    {job.number ? <span className="text-slate-500">({job.number})</span> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusTone(job.status)}>{job.status}</Badge>
                    <Link
                      to={`/collect?jobId=${encodeURIComponent(job.id)}`}
                      className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold !text-white hover:bg-blue-700 hover:!text-white"
                    >
                      Collect payment
                    </Link>
                  </div>
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Customer: {customerName || (customerId ? `ID ${customerId}` : "Not provided")} | Location:{" "}
                  {locationName || (locationId ? `ID ${locationId}` : "Not provided")}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Appointment: {job.appointmentStatus || "Not provided"} | {formatDateTime(job.startTime)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Work type: {workType || "Not provided"} | Invoice: {invoiceId || "Not linked"} | BU:{" "}
                  {businessUnit || "Not provided"}
                </div>
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
