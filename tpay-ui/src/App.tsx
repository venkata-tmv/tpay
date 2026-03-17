import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import CollectPaymentPage from "./pages/CollectPaymentPage";
import DashboardPage from "./pages/DashboardPage";
import PaymentsHistoryPage from "./pages/PaymentsHistoryPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import ExceptionDetailPage from "./pages/ExceptionDetailPage";
import ProfilePage from "./pages/ProfilePage";
import TechnicianStatusPage from "./pages/TechnicianStatusPage";
import TechnicianJobsPage from "./pages/TechnicianJobsPage";
import ExceptionsQueuePage from "./pages/ExceptionsQueuePage";

const linkBase =
  "text-sm font-semibold px-3 py-2 rounded-xl transition";
const active =
  "bg-white !text-slate-950";
const inactive =
  "!text-slate-200 hover:bg-white/10 hover:!text-white";

type UserRole = "merchant" | "technician";
type Session = {
  role: UserRole;
  userEmail: string;
};

const SESSION_KEY = "tpay.session.v1";

function defaultRoute(role: UserRole) {
  return role === "merchant" ? "/dashboard" : "/my-jobs";
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || (parsed.role !== "merchant" && parsed.role !== "technician")) return null;
    return parsed;
  } catch {
    return null;
  }
}

function RoleHomePage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [technicianPassword, setTechnicianPassword] = useState("");
  const [expandedRole, setExpandedRole] = useState<UserRole | null>(null);

  const submitInlineLogin = (role: UserRole, email: string) => {
    onLogin({
      role,
      userEmail: email.trim() || `${role}@tpay.local`,
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-120px)] overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_18%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_85%_14%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#f3f7ff_45%,#f8fafc_100%)]" />
      <div className="pointer-events-none absolute -left-20 top-24 h-56 w-56 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative mx-auto w-full max-w-[1080px]">
        <div className="rounded-[30px] border border-white/70 bg-white/80 p-8 shadow-[0_16px_60px_rgba(15,23,42,0.14)] backdrop-blur md:p-10">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            <Sparkles className="h-4 w-4 text-blue-600" />
            TPay Merchant + Technician Workspace
          </div>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 md:text-5xl">
            Select your role to access the correct TPay workflow.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 md:text-lg">
            Merchant users get payment operations and reconciliation visibility. Technicians get a focused field workflow for fast, accurate collections.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Job-linked workflows
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Secure card collection flow
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              Exception-first reconciliation
            </span>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="group rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef4ff_48%,#f5fbff_100%)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Merchant
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">Merchant Login</div>
              <div className="mt-2 text-sm text-slate-600">Payments, exception triage, and reconciliation command center.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Dashboard
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Exceptions Queue
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedRole((prev) => (prev === "merchant" ? null : "merchant"))}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {expandedRole === "merchant" ? "Hide login fields" : "Continue as Merchant"}
              </button>
              {expandedRole === "merchant" ? (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitInlineLogin("merchant", merchantEmail);
                  }}
                >
                  <input
                    type="email"
                    value={merchantEmail}
                    onChange={(e) => setMerchantEmail(e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="merchant@example.com"
                  />
                  <input
                    type="password"
                    value={merchantPassword}
                    onChange={(e) => setMerchantPassword(e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Password"
                  />
                  <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Sign in as Merchant
                  </button>
                </form>
              ) : null}
            </div>

            <div className="group rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#f7fffd_0%,#eefcf8_50%,#f2fbff_100%)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Wrench className="h-3.5 w-3.5" />
                  Technician
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </div>
              <div className="mt-4 text-2xl font-semibold text-slate-950">Technician Login</div>
              <div className="mt-2 text-sm text-slate-600">Assigned jobs, invoice context, and payment collection workflow.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  My Jobs
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Collect + Status
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedRole((prev) => (prev === "technician" ? null : "technician"))}
                className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {expandedRole === "technician" ? "Hide login fields" : "Continue as Technician"}
              </button>
              {expandedRole === "technician" ? (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitInlineLogin("technician", technicianEmail);
                  }}
                >
                  <input
                    type="email"
                    value={technicianEmail}
                    onChange={(e) => setTechnicianEmail(e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="technician@example.com"
                  />
                  <input
                    type="password"
                    value={technicianPassword}
                    onChange={(e) => setTechnicianPassword(e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Password"
                  />
                  <button type="submit" className="w-full rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                    Sign in as Technician
                  </button>
                </form>
              ) : null}
            </div>
          </div>

          <div className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-4 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Workflow</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Role-based screens</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Operations</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Payment + reconciliation</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Readiness</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">Production-oriented flow</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtectedLayout({ session, onLogout }: { session: Session | null; onLogout: () => void }) {
  if (!session) return <Navigate to="/" replace />;

  const isMerchant = session.role === "merchant";
  const userInitial = session.userEmail.trim().charAt(0).toUpperCase() || "U";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!accountMenuRef.current || !target) return;
      if (!accountMenuRef.current.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#f2f5f8_40%,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link to={defaultRoute(session.role)} className="rounded-2xl bg-white px-3 py-2 text-lg font-semibold tracking-tight !text-slate-950 hover:!text-slate-950">
              TPay
            </Link>
            <div>
              <div className="text-sm font-semibold text-white">
                {isMerchant ? "Merchant Portal" : "Technician Portal"}
              </div>
              <div className="text-xs text-slate-300">HVAC Operations • {session.userEmail}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex flex-wrap gap-2">
              {isMerchant ? (
                <>
                  <NavLink to="/dashboard" end className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Dashboard
                  </NavLink>
                  <NavLink to="/payments" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Payments
                  </NavLink>
                  <NavLink to="/reconciliation" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Reconciliation
                  </NavLink>
                  <NavLink to="/exceptions-queue" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Exceptions Queue
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink to="/my-jobs" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    My Jobs
                  </NavLink>
                  <NavLink to="/collect" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Collect
                  </NavLink>
                  <NavLink to="/tech-status" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
                    Status
                  </NavLink>
                </>
              )}
            </nav>
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">
                  {userInitial}
                </span>
                <span>Account</span>
              </button>
              {isAccountMenuOpen ? (
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">{session.userEmail}</div>
                  <Link
                    to="/profile"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="block px-3 py-2 text-sm font-medium !text-slate-900 hover:bg-slate-50"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onLogout();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm font-medium !text-rose-700 hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function RoleRoute({
  session,
  allowed,
  element,
}: {
  session: Session | null;
  allowed: UserRole[];
  element: ReactNode;
}) {
  if (!session) return <Navigate to="/" replace />;
  if (!allowed.includes(session.role)) return <Navigate to={defaultRoute(session.role)} replace />;
  return element;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const persistSession = (next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };
  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };
  const authedDefault = useMemo(() => (session ? defaultRoute(session.role) : "/"), [session]);

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to={authedDefault} replace /> : <RoleHomePage onLogin={persistSession} />} />

      <Route element={<ProtectedLayout session={session} onLogout={logout} />}>
        <Route
          path="/dashboard"
          element={<RoleRoute session={session} allowed={["merchant"]} element={<DashboardPage />} />}
        />
        <Route
          path="/payments"
          element={<RoleRoute session={session} allowed={["merchant"]} element={<PaymentsHistoryPage />} />}
        />
        <Route
          path="/reconciliation"
          element={<RoleRoute session={session} allowed={["merchant"]} element={<ReconciliationPage />} />}
        />
        <Route
          path="/exceptions-queue"
          element={<RoleRoute session={session} allowed={["merchant"]} element={<ExceptionsQueuePage />} />}
        />
        <Route
          path="/reconciliation/exceptions/:paymentId"
          element={<RoleRoute session={session} allowed={["merchant"]} element={<ExceptionDetailPage />} />}
        />
        <Route
          path="/collect"
          element={<RoleRoute session={session} allowed={["technician"]} element={<CollectPaymentPage />} />}
        />
        <Route
          path="/my-jobs"
          element={<RoleRoute session={session} allowed={["technician"]} element={<TechnicianJobsPage />} />}
        />
        <Route
          path="/tech-status"
          element={<RoleRoute session={session} allowed={["technician"]} element={<TechnicianStatusPage />} />}
        />
        <Route
          path="/profile"
          element={
            <RoleRoute
              session={session}
              allowed={["merchant", "technician"]}
              element={<ProfilePage role={session?.role ?? "technician"} userEmail={session?.userEmail ?? ""} />}
            />
          }
        />
      </Route>

      <Route path="*" element={<Navigate to={authedDefault} replace />} />
    </Routes>
  );
}
