// components/TopBar.tsx
// Shared top bar with navigation. Links appear as pages are built.

"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";

export function TopBar() {
  const { email, role, signOut, canRelease } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const links: { href: string; label: string; show: boolean }[] = [
    { href: "/board", label: "Board", show: true },
    { href: "/intake", label: "New ticket", show: true },
    { href: "/release", label: "Release", show: canRelease },
    { href: "/tools", label: "Tools", show: true },
    { href: "/link", label: "Link JC", show: true },
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <a href="/board" className="font-bold text-gray-900 whitespace-nowrap">
            Navratan Pre-Press
          </a>
          <nav className="flex items-center gap-1">
            {links
              .filter((l) => l.show)
              .map((l) => {
                const active = pathname === l.href || pathname.startsWith(l.href + "/");
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    className={`text-sm font-medium rounded-md px-3 py-1.5 transition-colors ${
                      active
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    {l.label}
                  </a>
                );
              })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight hidden sm:block">
            <div className="text-xs text-gray-900 font-medium">{email}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{role}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-200 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}