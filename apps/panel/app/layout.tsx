import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "KMY Arena — Yönetim" };

export default function KokDuzen({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
