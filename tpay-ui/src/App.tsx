import { Link, NavLink, Route, Routes } from "react-router-dom";
import CollectPaymentPage from "./pages/CollectPaymentPage";
import DashboardPage from "./pages/DashboardPage";
import PaymentsHistoryPage from "./pages/PaymentsHistoryPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import ExceptionDetailPage from "./pages/ExceptionDetailPage";

const linkBase =
  "text-sm font-semibold px-3 py-2 rounded-xl transition";
const active =
  "bg-white !text-slate-950";
const inactive =
  "!text-slate-200 hover:bg-white/10 hover:!text-white";

export default function App() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#f2f5f8_40%,#f8fafc_100%)] text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-800/70 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="rounded-2xl bg-white px-3 py-2 text-lg font-semibold tracking-tight !text-slate-950 hover:!text-slate-950">TPay</Link>
            <div>
              <div className="text-sm font-semibold text-white">Merchant Portal</div>
              <div className="text-xs text-slate-300">HVAC Operations • Placeholder branding</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2">
            <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Dashboard
            </NavLink>
            <NavLink to="/collect" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Collect
            </NavLink>
            <NavLink to="/payments" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Payments
            </NavLink>
            <NavLink to="/reconciliation" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Reconciliation
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] space-y-4 px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/collect" element={<CollectPaymentPage />} />
          <Route path="/payments" element={<PaymentsHistoryPage />} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="/reconciliation/exceptions/:paymentId" element={<ExceptionDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
