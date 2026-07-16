// components/SideBar.tsx
// BOS-style left sidebar: logo + tagline, icon nav, collapse toggle, dark mode,
// change-password, sign out. Replaces the old TopBar.

"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Plus,
  CheckCircle,
  Wrench,
  Link2,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

type NavItem = { href: string; label: string; icon: React.ElementType; show: boolean };

export function SideBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { email, role, canRelease, signOut } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // change password
  const [pwOpen, setPwOpen] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setDrawerOpen(false), [pathname]);

  const links: NavItem[] = [
    { href: "/board", label: "Board", icon: LayoutDashboard, show: true },
    { href: "/intake", label: "New Ticket", icon: Plus, show: true },
    { href: "/release", label: "Release", icon: CheckCircle, show: canRelease },
    { href: "/tools", label: "Tools", icon: Wrench, show: true },
    { href: "/link", label: "Link JC", icon: Link2, show: true },
  ];
  const visible = links.filter((l) => l.show);

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <a href="/board" className="flex flex-col items-start" onClick={() => setDrawerOpen(false)}>
          <span className="text-lg font-bold text-gray-900 dark:text-white">Navratan Pre-Press</span>
          <p className="text-xs text-gray-400 mt-0.5">Pre-Press Ticketing</p>
        </a>
        <button onClick={() => setDrawerOpen(false)} className="md:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setDrawerOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon size={16} />
              {link.label}
            </a>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 dark:border-gray-800 p-3">
        {/* User card */}
        {email && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center text-sm font-semibold shrink-0">
              {email.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-900 dark:text-gray-100 truncate font-medium">{email}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{role}</p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-0.5">
          <button onClick={() => setPwOpen(true)} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
            <KeyRound size={15} /> Change Password
          </button>
          {mounted && (
            <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors">
              {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          )}
          <button onClick={handleSignOut} className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <LogOut size={15} /> Sign Out
          </button>
        </div>

        <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center mt-2">v1.0</p>
      </div>
    </div>
  );

  const MAIN_W = 224;

  return (
    <>
      <style>{`@media(min-width:768px){.pp-main{margin-left:${collapsed ? 0 : MAIN_W}px!important}}`}</style>

      {/* Desktop sidebar */}
      {!collapsed && (
        <aside className="hidden md:flex fixed top-0 left-0 h-screen w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex-col z-10 overflow-y-auto">
          {sidebarContent}
        </aside>
      )}

      {/* Desktop collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="hidden md:flex fixed top-6 z-20 items-center justify-center w-5 h-10 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-r-full shadow-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all"
        style={{ left: collapsed ? 0 : MAIN_W }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-12 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 z-20">
        <button onClick={() => setDrawerOpen(true)} className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          <Menu size={22} />
        </button>
        <span className="ml-3 font-semibold text-gray-800 dark:text-white text-sm">Navratan Pre-Press</span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="md:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setDrawerOpen(false)} />
          <aside className="md:hidden fixed top-0 left-0 h-screen w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Change password modal */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => { setPwOpen(false); setNewPass(""); setConfirmPass(""); setPwMsg(""); }} />
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <h2 className="text-base font-bold text-gray-800 dark:text-white">Change Password</h2>
            <div>
              <label className="block text-xs text-gray-500 mb-1">New Password</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Confirm Password</label>
              <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded px-3 py-2 text-sm" />
            </div>
            {pwMsg && <p className={`text-xs ${pwMsg.includes("Error") || pwMsg.includes("match") ? "text-red-500" : "text-green-600"}`}>{pwMsg}</p>}
            <div className="flex gap-3">
              <button disabled={pwSaving} onClick={async () => {
                if (newPass !== confirmPass) { setPwMsg("Passwords do not match"); return; }
                if (newPass.length < 6) { setPwMsg("Minimum 6 characters"); return; }
                setPwSaving(true); setPwMsg("");
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) setPwMsg("Error: " + error.message);
                else { setPwMsg("Password changed!"); setTimeout(() => { setPwOpen(false); setNewPass(""); setConfirmPass(""); setPwMsg(""); }, 1500); }
                setPwSaving(false);
              }} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {pwSaving ? "Saving..." : "Update Password"}
              </button>
              <button onClick={() => { setPwOpen(false); setNewPass(""); setConfirmPass(""); setPwMsg(""); }}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-800">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}