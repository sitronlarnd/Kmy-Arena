import { t } from "@kmy/shared/i18n";

/** Faz 0 yer tutucu. Tam tanıtım sayfası ve teklif/pilot formu Faz 7'de. */
export default function Tanitim() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "15vh 24px" }}>
      <p style={{ color: "#8f92ff", fontWeight: 600 }}>{t("uygulama.ad")}</p>
      <h1 style={{ fontSize: "clamp(32px, 6vw, 56px)", lineHeight: 1.1, margin: "8px 0 16px" }}>
        Öğrencileriniz her gün soru çözsün. Siz farkı ölçün.
      </h1>
      <p style={{ fontSize: 18, color: "#b8bad0", maxWidth: 640 }}>
        Yapay zekânın öğrencinin seviyesine göre ürettiği özgün sorular, düellolar ve klan savaşlarıyla soru çözmeyi
        alışkanlığa dönüştüren platform. Öğretmen ve yöneticiye ölçülebilir rapor.
      </p>
      <a
        href="mailto:?subject=KMY%20Arena%2030%20g%C3%BCn%20%C3%BCcretsiz%20pilot"
        style={{ display: "inline-block", marginTop: 24, padding: "14px 22px", borderRadius: 10, background: "#5b5bf0", color: "#fff", textDecoration: "none", fontWeight: 600 }}
      >
        30 gün ücretsiz pilot
      </a>
    </main>
  );
}
