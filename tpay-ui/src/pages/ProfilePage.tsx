import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";

type UserRole = "merchant" | "technician";

type CommonProfile = {
  fullName: string;
  phone: string;
  notifyEmail: boolean;
  notifySms: boolean;
};

type MerchantProfile = CommonProfile & {
  businessName: string;
  timezone: string;
  reconRunTime: string;
  mismatchAlertThreshold: string;
};

type TechnicianProfile = CommonProfile & {
  technicianId: string;
  businessUnit: string;
  location: string;
  preferredReceiptMethod: "sms" | "email" | "none";
};

function profileStorageKey(role: UserRole, email: string) {
  return `tpay.profile.${role}.${email.toLowerCase()}`;
}

function defaultCommon(email: string): CommonProfile {
  return {
    fullName: email.split("@")[0] || "",
    phone: "",
    notifyEmail: true,
    notifySms: false,
  };
}

function defaultMerchant(email: string): MerchantProfile {
  return {
    ...defaultCommon(email),
    businessName: "HVAC Operations",
    timezone: "America/New_York",
    reconRunTime: "06:00",
    mismatchAlertThreshold: "10.00",
  };
}

function defaultTechnician(email: string): TechnicianProfile {
  return {
    ...defaultCommon(email),
    technicianId: "",
    businessUnit: "",
    location: "",
    preferredReceiptMethod: "sms",
  };
}

export default function ProfilePage({ role, userEmail }: { role: UserRole; userEmail: string }) {
  const storageKey = useMemo(() => profileStorageKey(role, userEmail), [role, userEmail]);
  const [saveNotice, setSaveNotice] = useState("");

  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile>(() => {
    if (role !== "merchant") return defaultMerchant(userEmail);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultMerchant(userEmail);
      return { ...defaultMerchant(userEmail), ...(JSON.parse(raw) as MerchantProfile) };
    } catch {
      return defaultMerchant(userEmail);
    }
  });

  const [technicianProfile, setTechnicianProfile] = useState<TechnicianProfile>(() => {
    if (role !== "technician") return defaultTechnician(userEmail);
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultTechnician(userEmail);
      return { ...defaultTechnician(userEmail), ...(JSON.parse(raw) as TechnicianProfile) };
    } catch {
      return defaultTechnician(userEmail);
    }
  });

  const common = role === "merchant" ? merchantProfile : technicianProfile;

  const saveProfile = () => {
    const payload = role === "merchant" ? merchantProfile : technicianProfile;
    localStorage.setItem(storageKey, JSON.stringify(payload));
    setSaveNotice("Profile saved");
    window.setTimeout(() => setSaveNotice(""), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(135deg,#ffffff_0%,#f8fbff_55%,#f8fafc_100%)]">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="border-slate-200 bg-slate-50 text-slate-700">{role === "merchant" ? "Merchant" : "Technician"}</Badge>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700">Role-based profile</Badge>
          </div>
          <CardTitle className="mt-2">Profile & Preferences</CardTitle>
          <CardDescription>Identity, notifications, and role-specific defaults used in this portal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-950">Identity</div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Role</div>
              <Input value={role} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              <Input value={userEmail} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Full name</div>
              <Input
                value={common.fullName}
                onChange={(e) =>
                  role === "merchant"
                    ? setMerchantProfile((prev) => ({ ...prev, fullName: e.target.value }))
                    : setTechnicianProfile((prev) => ({ ...prev, fullName: e.target.value }))
                }
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
              <Input
                value={common.phone}
                onChange={(e) =>
                  role === "merchant"
                    ? setMerchantProfile((prev) => ({ ...prev, phone: e.target.value }))
                    : setTechnicianProfile((prev) => ({ ...prev, phone: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="text-sm font-semibold text-slate-950">Notifications</div>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
              Email alerts
              <input
                type="checkbox"
                checked={common.notifyEmail}
                onChange={(e) =>
                  role === "merchant"
                    ? setMerchantProfile((prev) => ({ ...prev, notifyEmail: e.target.checked }))
                    : setTechnicianProfile((prev) => ({ ...prev, notifyEmail: e.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
              SMS alerts
              <input
                type="checkbox"
                checked={common.notifySms}
                onChange={(e) =>
                  role === "merchant"
                    ? setMerchantProfile((prev) => ({ ...prev, notifySms: e.target.checked }))
                    : setTechnicianProfile((prev) => ({ ...prev, notifySms: e.target.checked }))
                }
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {role === "merchant" ? (
        <Card>
          <CardHeader>
            <CardTitle>Merchant Settings</CardTitle>
            <CardDescription>Business and reconciliation preferences for office users.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Business name</div>
              <Input
                value={merchantProfile.businessName}
                onChange={(e) => setMerchantProfile((prev) => ({ ...prev, businessName: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Timezone</div>
              <Input
                value={merchantProfile.timezone}
                onChange={(e) => setMerchantProfile((prev) => ({ ...prev, timezone: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Reconciliation run time</div>
              <Input
                type="time"
                value={merchantProfile.reconRunTime}
                onChange={(e) => setMerchantProfile((prev) => ({ ...prev, reconRunTime: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Mismatch alert threshold ($)</div>
              <Input
                value={merchantProfile.mismatchAlertThreshold}
                onChange={(e) => setMerchantProfile((prev) => ({ ...prev, mismatchAlertThreshold: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Technician Settings</CardTitle>
            <CardDescription>Field profile and collection defaults for technician users.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Technician ID</div>
              <Input
                value={technicianProfile.technicianId}
                onChange={(e) => setTechnicianProfile((prev) => ({ ...prev, technicianId: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Business unit</div>
              <Input
                value={technicianProfile.businessUnit}
                onChange={(e) => setTechnicianProfile((prev) => ({ ...prev, businessUnit: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Location</div>
              <Input
                value={technicianProfile.location}
                onChange={(e) => setTechnicianProfile((prev) => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred receipt</div>
              <select
                value={technicianProfile.preferredReceiptMethod}
                onChange={(e) =>
                  setTechnicianProfile((prev) => ({
                    ...prev,
                    preferredReceiptMethod: e.target.value as TechnicianProfile["preferredReceiptMethod"],
                  }))
                }
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="none">None</option>
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={saveProfile}>Save profile</Button>
        {saveNotice ? <div className="text-sm font-semibold text-emerald-700">{saveNotice}</div> : null}
      </div>
    </div>
  );
}
