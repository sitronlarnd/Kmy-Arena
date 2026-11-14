import { canliCevap, canliDurum, canliHemenBaslat, canliOturumDurumu, canliPin } from "@/lib/canli-servisi";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula, merkezYetkisiVar, ogrenciGetir } from "@/lib/kimlik";
import { ortam } from "@/lib/ortam";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** Canlı Soru Saati: durum · cevap {oturum, sira, secilen, rttMs} · baslat {dershaneId} (demo: 1 dk sonra) */
export async function POST(istek: Request, baglam: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await baglam.params;
    const g = await govdeOku(istek);
    if (islem === "baslat") {
      const gizli = ortam().CRON_SECRET;
      let dershane = typeof g.dershaneId === "string" ? g.dershaneId : null;
      if (!(gizli && istek.headers.get("authorization") === `Bearer ${gizli}`)) {
        const kim = await kimlikDogrula(istek);
        const s = servisIstemcisi();
        const { data: ku } = await s.from("kullanici").select("dershane_id").eq("id", kim.id).single();
        const { data: rol } = await s.from("kullanici_rol").select("rol_kod").eq("kullanici_id", kim.id).eq("dershane_id", ku?.dershane_id ?? "").in("rol_kod", ["kurucu", "sube_muduru", "ogretmen"]);
        const merkez = await merkezYetkisiVar(kim.id, "merkez.dershane_yonet");
        if (!merkez && !(rol ?? []).length) throw new IstemciHatasi("panel.yetkisiz", 403);
        if (!merkez || !dershane) dershane = (ku?.dershane_id as string | null) ?? dershane;
      }
      if (!dershane || !/^[0-9a-f-]{36}$/i.test(dershane)) throw new IstemciHatasi("ortak.hata", 400);
      await canliHemenBaslat(dershane);
      return json({ tamam: true });
    }
    const k = await ogrenciGetir(istek);
    if (islem === "durum") return json(await canliDurum(k));
    if (islem === "pin") return json(await canliPin(k, String(g.pin ?? "")));
    if (islem === "oturum") return json(await canliOturumDurumu(k, String(g.oturum ?? "")));
    if (islem === "cevap") {
      const secilen = typeof g.secilen === "string" && /^[A-E]$/.test(g.secilen) ? g.secilen : null;
      return json(await canliCevap(k, String(g.oturum ?? ""), Number(g.sira), secilen, Number(g.rttMs) || 0));
    }
    throw new IstemciHatasi("ortak.hata", 404);
  });
}
