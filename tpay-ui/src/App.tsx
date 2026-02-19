import { NavLink, Route, Routes } from "react-router-dom";
import CollectPaymentPage from "./pages/CollectPaymentPage";
import PaymentsHistoryPage from "./pages/PaymentsHistoryPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import ExceptionDetailPage from "./pages/ExceptionDetailPage";

const linkBase =
  "text-sm font-semibold px-3 py-2 rounded-xl transition";
const active =
  "text-white bg-white/10";
const inactive =
  "text-gray-200 hover:bg-white/10 hover:text-white";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-4 flex items-center gap-6">
          <div className="text-2xl font-bold tracking-tight">TPay</div>
          <nav className="flex gap-2">
            <NavLink to="/" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Payments
            </NavLink>
            <NavLink to="/reconciliation" className={({ isActive }) => `${linkBase} ${isActive ? active : inactive}`}>
              Reconciliation
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-4">
        <Routes>
          <Route path="/" element={<CollectPaymentPage />} />
          <Route path="/history" element={<PaymentsHistoryPage />} />
          <Route path="/reconciliation" element={<ReconciliationPage />} />
          <Route path="/reconciliation/exceptions/:paymentId" element={<ExceptionDetailPage />} />
        </Routes>
      </main>
    </div>
  );
}
