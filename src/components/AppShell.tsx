import { ReactNode, useState, useRef, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Bell, ChevronDown, LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "@tanstack/react-router";

export function AppShell({ title, actions, children }: { title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) { setMenuOpen(false); setBellOpen(false); }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const name = (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "আপনি";

  const doSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: "oklch(0.97 0.005 250)" }}>
      <Sidebar />
      <main className="flex-1 p-6 overflow-y-auto h-screen">
        <div className="flex items-center justify-between mb-6" ref={ref}>
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          <div className="flex items-center gap-3">
            {actions}
            <div className="relative">
              <button onClick={() => { setBellOpen(o => !o); setMenuOpen(false); }} className="relative p-2 bg-white rounded-lg border border-slate-200 hover:bg-slate-50">
                <Bell className="w-4 h-4 text-slate-600" />
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-12 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50">
                  <div className="text-sm font-medium text-slate-700 mb-2">নোটিফিকেশন</div>
                  <div className="text-xs text-slate-500 py-6 text-center">কোনো নতুন নোটিফিকেশন নেই</div>
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setMenuOpen(o => !o); setBellOpen(false); }} className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border border-slate-200 hover:bg-slate-50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm">{name}</span>
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                    <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                  </div>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <UserIcon className="w-4 h-4" /> প্রোফাইল
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md">
                    <SettingsIcon className="w-4 h-4" /> সেটিংস
                  </Link>
                  <button onClick={doSignOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-md">
                    <LogOut className="w-4 h-4" /> সাইন আউট
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}