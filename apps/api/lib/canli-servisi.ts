import "server-only";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { bugunIst } from "./oyun-servisi";
import { servisIstemcisi } from "./supabase";

const VARSAYILAN_SAAT = "19:30";
/** Oturum: 5 soru × 60 sn; 10 dk önce "yakında", bittikten 15 dk sonrasına kadar sonuç ekranı. */
const ONCE_MS = 10 * 60_000;
const SURE_MS = 5 * 60_000;
const SONRA_MS = 15 * 60_000;

async function grup(k: Kullanici): Promise<"LGS" | "YKS"> {
  const { data } = await servisIstemcisi().rpc("sistem_ogrenci_dersleri", { p_kullanici: k.id });
  const dersler = (data ?? []) as Array<{ sinav_turu: string }>;
  if (dersler.length === 0) throw new IstemciHatasi("soru.paketYok", 403);
  return dersler.some((d) => d.sinav_turu === "LGS") ? "LGS" : "YKS";
}

export async function canliDurum(k: Kullanici): Promise<Record<string, unknown>> {
  const s = servisIstemcisi();
  const { data: acik } = await s.rpc("sistem_ozellik_acik", { p_kod: "canli_soru_saati", p_dershane: k.dershaneId });
  if (acik !== true) return { durum: "kapali" };
  const g = await grup(k);
  const gun = bugunIst();
  // Bugün (demo için öne alınmış dahil) oturum var mı?
  const { data: var_ } = await s.from("canli_oturum").select("id, baslangic").eq("dershane_id", k.dershaneId).eq("sinav_grubu", g).eq("gun", gun).maybeSingle();
  const { data: dershane } = await s.from("dershane").select("ayarlar").eq("id", k.dershaneId).single();
  const saat = String((dershane?.ayarlar as Record<string, unknown> | null)?.canli_saat ?? VARSAYILAN_SAAT);
  const planli = new Date(`${gun}T${/^\d{2}:\d{2}$/.test(saat) ? saat : VARSAYILAN_SAAT}:00+03:00`).getTime();
  const baslangic = var_ ? new Date(var_.baslangic as string).getTime() : planli;
  const simdi = Date.now();
  if (simdi < baslangic - ONCE_MS) return { durum: "yakinda", baslangic: new Date(baslangic).toISOString(), sunucu_zamani: simdi };
  if (simdi > baslangic + SURE_MS + SONRA_MS) {
    const yarin = new Date(planli + 86_400_000).toISOString();
    return { durum: "yakinda", baslangic: yarin, sunucu_zamani: simdi };
  }
  let id = var_?.id as string | undefined;
  if (!id) {
    const { data, error } = await s.rpc("sistem_canli_olustur", { p_dershane: k.dershaneId, p_grup: g, p_gun: gun, p_baslangic: new Date(planli).toISOString() });
    if (error) {
      if (error.message.includes("canli.soruYok")) return { durum: "kapali", neden: "canli.soruYok" };
      throw error;
    }
    id = data as string;
  }
  const { data: o, error } = await s.rpc("sistem_canli_durum", { p_oturum: id, p_kullanici: k.id });
  if (error) throw error;
  return { durum: "aktif", oturum: o };
}

export async function canliCevap(k: Kullanici, oturum: string, sira: number, secilen: string | null, rtt: number): Promise<unknown> {
  const { data, error } = await servisIstemcisi().rpc("sistem_canli_cevap", {
    p_oturum: oturum, p_kullanici: k.id, p_sira: sira, p_secilen: secilen, p_rtt_ms: Math.max(0, Math.min(5000, Math.round(rtt))),
  });
  if (error) {
    const m = /canli\.\w+/.exec(error.message)?.[0];
    if (m) throw new IstemciHatasi(m, 409);
    throw error;
  }
  return data;
}

/** Demo / dershane isteği: bugünkü oturumu 1 dakika sonra başlat (önceki cevaplar silinir). */
export async function canliHemenBaslat(dershaneId: string): Promise<void> {
  const s = servisIstemcisi();
  const gun = bugunIst();
  const baslangic = new Date(Date.now() + 60_000).toISOString();
  await s.from("canli_oturum").delete().eq("dershane_id", dershaneId).eq("gun", gun);
  for (const g of ["LGS", "YKS"]) {
    const { error } = await s.rpc("sistem_canli_olustur", { p_dershane: dershaneId, p_grup: g, p_gun: gun, p_baslangic: baslangic });
    if (error && !error.message.includes("canli.soruYok")) throw error;
  }
}
