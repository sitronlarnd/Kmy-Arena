import "server-only";
import { randomInt } from "node:crypto";
import { servis } from "./servis";
import { sunucuIstemcisi } from "./supabase";

/** Kullanıcı adıyla giriş yapanların e-posta alanı (mobil girişte kullanıcı adı yazılırsa eklenir). */
export const OGRENCI_ALANI = "ogrenci.kmyarena.app";

export interface PanelKimlik { dershaneId: string; kullaniciId: string; tum: boolean; subeler: string[] }

/** Oturumdaki kullanıcının kendi dershanesinde yetkisi yoksa hata fırlatır. */
export async function yetkiIste(yetki: string, sube: string | null = null): Promise<PanelKimlik> {
  const s = await sunucuIstemcisi();
  const { data, error } = await s.rpc("panel_yetki", { p_yetki: yetki, p_sube: sube });
  const d = data as { var: boolean; tum: boolean; subeler: string[]; dershane_id: string | null; kullanici_id: string | null } | null;
  if (error || !d?.var || !d.dershane_id || !d.kullanici_id) throw new Error("panel.yetkisiz");
  return { dershaneId: d.dershane_id, kullaniciId: d.kullanici_id, tum: d.tum, subeler: d.subeler ?? [] };
}

const KELIMELER = ["Kartal", "Yildiz", "Simsek", "Roket", "Bulut", "Deniz", "Orman", "Gunes", "Kutup", "Atlas", "Pusula", "Zirve", "Ruzgar", "Elmas", "Kaplan", "Sahin"];
/** Okunaklı geçici şifre (ör. Pusula4827); ilk girişte değiştirilmesi zorunludur. */
export function geciciSifre(): string {
  return `${KELIMELER[randomInt(KELIMELER.length)]}${randomInt(1000, 10000)}`;
}

const TR: Record<string, string> = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
export function asciiAd(x: string): string {
  return x.replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c] ?? c).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface YeniHesap {
  eposta?: string | null;
  ad: string; soyad: string; rol: string;
  dershaneId: string; subeId: string | null; sinifId: string | null;
  dogumYili?: number | null;
}
export interface AcilanHesap { id: string; ad: string; soyad: string; giris: string; sifre: string; takma: string | null }

/**
 * Auth hesabını açar ve profili kurar. E-posta yoksa (öğrenci) benzersiz bir
 * kullanıcı adı üretilir: ayse.yilmaz42 → ayse.yilmaz42@ogrenci.kmyarena.app
 */
export async function hesapAc(h: YeniHesap): Promise<AcilanHesap> {
  const s = servis();
  const sifre = geciciSifre();
  const ogrenci = h.rol === "ogrenci";
  const taban = `${asciiAd(h.ad).slice(0, 10) || "ogrenci"}.${asciiAd(h.soyad).slice(0, 10) || "kmy"}`;
  for (let deneme = 0; deneme < 6; deneme++) {
    const kadi = h.eposta ? null : `${taban}${randomInt(10, deneme < 3 ? 100 : 10000)}`;
    const eposta = (h.eposta ?? `${kadi}@${OGRENCI_ALANI}`).trim().toLowerCase();
    const { data, error } = await s.auth.admin.createUser({ email: eposta, password: sifre, email_confirm: true });
    if (error) {
      if (!h.eposta && /already|registered|exists/i.test(error.message)) continue;
      throw new Error(/already|registered|exists/i.test(error.message) ? "panel.epostaKayitli" : error.message);
    }
    const takma = ogrenci ? (kadi ?? taban).replace(/[^a-z0-9_.]/g, "").slice(0, 20) : null;
    const { error: e2 } = await s.rpc("sistem_hesap_kur", {
      p_uid: data.user.id, p_dershane: h.dershaneId, p_sube: h.subeId, p_sinif: h.sinifId, p_rol: h.rol,
      p_ad: h.ad, p_soyad: h.soyad, p_takma_ad: takma, p_dogum_yili: h.dogumYili ?? null, p_sifre_degismeli: true,
    });
    if (e2) {
      await s.auth.admin.deleteUser(data.user.id);
      if (e2.message.includes("takmaAdAlinmis") && !h.eposta) continue;
      throw new Error(e2.message.match(/(panel|giris)\.\w+/)?.[0] ?? e2.message);
    }
    return { id: data.user.id, ad: h.ad, soyad: h.soyad, giris: kadi ?? eposta, sifre, takma };
  }
  throw new Error("panel.kullaniciAdiUretilemedi");
}

/** Geçici şifreyi yeniler (unutulan şifre, kaybolan giriş kartı). */
export async function sifreSifirla(kullaniciId: string): Promise<string> {
  const sifre = geciciSifre();
  const s = servis();
  const { error } = await s.auth.admin.updateUserById(kullaniciId, { password: sifre });
  if (error) throw new Error(error.message);
  await s.from("kullanici").update({ sifre_degismeli: true }).eq("id", kullaniciId);
  return sifre;
}

/** Resend ile e-posta (anahtar yoksa atlanır). */
export async function eposta(kime: string, konu: string, metin: string): Promise<boolean> {
  const anahtar = process.env.RESEND_API_KEY;
  if (!anahtar) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${anahtar}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EPOSTA_GONDEREN ?? "KMY Arena <bildirim@kmyai.cloud>", to: [kime], subject: konu, text: metin }),
  }).catch(() => null);
  return Boolean(r?.ok);
}

export const PANEL_ADRESI = process.env.NEXT_PUBLIC_PANEL_URL ?? "https://panel-ten-green.vercel.app";

/** Hoş geldin e-postası (Merkez › E-posta şablonları'ndaki "hos_geldin" şablonu). */
export async function hosGeldinMetni(ad: string, giris: string, sifre: string, rolAdi: string, dershane: string): Promise<{ konu: string; govde: string }> {
  const { data } = await servis().from("eposta_sablon").select("konu, govde").eq("kod", "hos_geldin").maybeSingle();
  const d: Record<string, string> = { ad, giris, sifre, rol: rolAdi, dershane, panel: PANEL_ADRESI ? `Panel: ${PANEL_ADRESI}` : "" };
  const doldur = (x: string) => x.replace(/\{(\w+)\}/g, (_, k: string) => d[k] ?? "");
  return {
    konu: doldur((data?.konu as string) ?? "KMY Arena hesabınız açıldı"),
    govde: doldur((data?.govde as string) ?? `Merhaba ${ad},\n\n${dershane} için KMY Arena ${rolAdi} hesabınız açıldı.\n\nGiriş: ${giris}\nGeçici şifre: ${sifre}\n\nİlk girişte şifrenizi değiştirmeniz istenecek.`),
  };
}
