import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useIsAdmin } from "@/hooks/useRole";
import { ArrowLeft, Shield } from "lucide-react";
import { UserDashboardView } from "@/components/admin/UserDashboardView";

export const Route = createFileRoute("/_authenticated/admin/user/$userId")({
  component: AdminUserView,
});

function AdminUserView() {
  const { userId } = Route.useParams();
  const isAdmin = useIsAdmin();

  if (isAdmin === null) return <AppShell title="ইউজার ড্যাশবোর্ড"><div className="p-8 text-slate-500">লোড হচ্ছে…</div></AppShell>;
  if (!isAdmin) {
    return (
      <AppShell title="ইউজার ড্যাশবোর্ড">
        <div className="max-w-xl mx-auto mt-10 brand-card p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--brand-emerald-700)" }} />
          <h2 className="text-xl font-semibold mb-2">অ্যাক্সেস নেই</h2>
          <p className="text-sm text-slate-600">এই পেজটি দেখতে অ্যাডমিন অনুমতি লাগবে।</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="ইউজার ড্যাশবোর্ড"
      actions={
        <Link to="/admin" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm" style={{ borderColor: "var(--brand-line)" }}>
          <ArrowLeft className="w-4 h-4" /> ফিরে যান
        </Link>
      }
    >
      <UserDashboardView userId={userId} />
    </AppShell>
  );
}
