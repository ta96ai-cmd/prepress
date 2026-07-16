// components/AppGuard.tsx
// Protects prepress pages using BOS roles.
//   not signed in            -> redirect to /login
//   signed in, no prepress access (not full/manager/artist) -> "no access"
//   signed in + access       -> render page inside shell

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { SideBar } from "@/components/SideBar";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, userId, hasAccess } = useAuth();

  useEffect(() => {
    if (!loading && !userId) {
      router.replace("/login");
    }
  }, [loading, userId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!userId) return null;

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-lg p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">No pre-press access</h1>
          <p className="text-sm text-gray-600 mt-2">
            Your account isn&apos;t set up for the pre-press system. Ask an owner to add you.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <SideBar />
      <main className="pp-main pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-8">{children}</div>
      </main>
    </div>
  );
}