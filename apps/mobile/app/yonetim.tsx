import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, ClipboardList, ExternalLink, School, Users } from "lucide-react-native";
import { Linking, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { HesapAyarlari } from "@/bilesenler/HesapAyarlari";
import { Bolum, Cubuk, Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { supabase } from "@/lib/supabase";
import { OYUN, useTema } from "@/lib/tema";

interface Ozet { ogrenci: number; aktif_bugun: number; aktif_hafta: number; soru_hafta: number; dk_hafta: number; aktif_ogretmen: number; ogretmen: number; bekleyen_odev: number; riskli: number }
interface Sinif { id: string; ad: string; sube: string | null; ogrenci: number; aktif7: number; soru7: number }
interface Rehberlik { riskliler: { id: string; ad: string; puan: number; nedenler: string[] }[] }

const PANEL = process.env.EXPO_PUBLIC_PANEL_URL ?? "https://panel-ten-green.vercel.app";

/** Personel (kurucu, şube müdürü, rehber, öğretmen) için mobil özet: ayrıntılı işler panelde. */
export default function Yonetim() {
  const tema = useTema();
  const ozet = useQuery({ queryKey: ["y-ozet"], queryFn: async () => { const r = await supabase.rpc("panel_dershane_ozet"); return r.error ? null : (r.data as Ozet); } }).data;
  const siniflar = useQuery({ queryKey: ["y-sinif"], queryFn: async () => ((await supabase.rpc("panel_siniflarim")).data ?? []) as Sinif[] }).data ?? [];
  const rehberlik = useQuery({ queryKey: ["y-rehber"], queryFn: async () => { const r = await supabase.rpc("panel_rehberlik"); return r.error ? null : (r.data as Rehberlik); } }).data;
  const kutu = (ikon: typeof Users, renk: string, deger: string | number, etiket: string) => (
    <Kart stil={{ flex: 1, minWidth: 150 }}>
      <IkonKutu ikon={ikon} renk={renk} boyut={36} />
      <Metin tur="sayi">{deger}</Metin>
      <Metin tur="kucuk" soluk>{etiket}</Metin>
    </Kart>
  );
  return (
    <Ekran baslik={t("yonetim.baslik")} altBaslik={t("yonetim.aciklama")}>
      {ozet && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {kutu(Users, tema.vurgu, `${ozet.aktif_hafta}/${ozet.ogrenci}`, t("yonetim.haftalikAktif"))}
          {kutu(BarChart3, OYUN.xp, ozet.soru_hafta, t("yonetim.haftalikSoru"))}
          {kutu(ClipboardList, OYUN.altin, ozet.bekleyen_odev, t("yonetim.bekleyenOdev"))}
          {kutu(AlertTriangle, tema.yanlis, ozet.riskli, t("yonetim.riskli"))}
        </View>
      )}
      {rehberlik && rehberlik.riskliler.length > 0 && (
        <Kart>
          <Bolum baslik={t("yonetim.dikkat")} ikon={AlertTriangle} />
          {rehberlik.riskliler.slice(0, 6).map((r) => (
            <View key={r.id} style={{ gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Metin stil={{ flex: 1 }}>{r.ad}</Metin>
                <Etiket metin={String(r.puan)} renk={r.puan >= 60 ? tema.yanlis : OYUN.altin} />
              </View>
              <Metin tur="kucuk" soluk>{r.nedenler.slice(0, 2).join(" · ")}</Metin>
            </View>
          ))}
        </Kart>
      )}
      {siniflar.length > 0 && (
        <Kart>
          <Bolum baslik={t("yonetim.siniflar")} ikon={School} />
          {siniflar.map((c) => (
            <View key={c.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Metin stil={{ flex: 1 }}>{c.ad}{c.sube ? ` · ${c.sube}` : ""}</Metin>
                <Metin tur="kucuk" soluk>{t("yonetim.sinifOzet", { aktif: c.aktif7, toplam: c.ogrenci, soru: c.soru7 })}</Metin>
              </View>
              <Cubuk oran={c.ogrenci ? c.aktif7 / c.ogrenci : 0} />
            </View>
          ))}
        </Kart>
      )}
      {PANEL ? <Dugme ikon={ExternalLink} baslik={t("yonetim.paneliAc")} onPress={() => void Linking.openURL(PANEL)} /> : <Metin tur="kucuk" soluk>{t("yonetim.panelNot")}</Metin>}
      <HesapAyarlari />
    </Ekran>
  );
}
