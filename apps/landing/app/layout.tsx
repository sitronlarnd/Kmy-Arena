import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "KMY Arena — Dershaneler için oyunlaştırılmış soru platformu",
  description: "Yapay zekânın öğrencinin seviyesine göre ürettiği özgün sorular, düellolar ve klan savaşlarıyla öğrencileriniz her gün soru çözsün. 30 gün ücretsiz pilot.",
};

export default function KokDuzen({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
