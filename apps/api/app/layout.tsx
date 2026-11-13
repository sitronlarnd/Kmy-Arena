import type { ReactNode } from "react";

export const metadata = { title: "KMY Arena API" };

export default function KokDuzen({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
