import type { ReactNode } from "react";

export const metadata = {
  title: "KMY Arena — Dershaneler için oyunlaştırılmış soru platformu",
  description: "Öğrencileriniz her gün soru çözsün; siz gelişimi ölçün. 30 gün ücretsiz pilot.",
};

export default function KokDuzen({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", background: "#0f1020", color: "#f1f2f6" }}>
        {children}
      </body>
    </html>
  );
}
