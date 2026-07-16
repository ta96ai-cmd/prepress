// src/app/page.tsx
// Root route — just forwards into the app. The board is home.
// AppGuard on /board handles the signed-out → /login redirect.

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/board");
}