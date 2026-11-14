import type { YetkiKodu } from "@kmy/shared";
import { redirect } from "next/navigation";
import { sunucuIstemcisi } from "./supabase";

export interface YetkiSatiri {
  yetki_kod: YetkiKodu;
  dershane_id: string | null;
  sube_id: string | null;
}

export type Panel = "merkez" | "dershane" | "ogretmen";

/** Her panelin açılması için gereken yetkilerden en az biri. */
const PANEL_YETKILERI: Record<Panel, readonly YetkiKodu[]> = {
  merkez: ["merkez.dershane_yonet", "merkez.ai_yonet", "merkez.destek", "merkez.satis", "merkez.mufredat_yonet"],
  dershane: ["dershane.ayar", "rapor.oku", "ogrenci.ekle", "rehberlik.oku"],
  ogretmen: ["odev.yonet", "soru.yukle"],
};

export async function yetkilerim(): Promise<YetkiSatiri[]> {
  const supabase = await sunucuIstemcisi();
  const { data, error } = await supabase.rpc("yetkilerim");
  if (error) throw new Error(error.message);
  return (data ?? []) as YetkiSatiri[];
}

export function paneleErisebilir(yetkiler: readonly YetkiSatiri[], panel: Panel): boolean {
  const gerekli = PANEL_YETKILERI[panel];
  return yetkiler.some(
    (y) => gerekli.includes(y.yetki_kod) && (panel === "merkez" ? y.dershane_id === null : y.dershane_id !== null),
  );
}

/** Merkez için ek güvenlik: IP izin listesi (isteğe bağlı) ve iki adımlı doğrulama (zorunlu). */
async function merkezGuvenligi(): Promise<"tamam" | "ip" | "kur" | "dogrula"> {
  const izin = (process.env.MERKEZ_IP_IZIN ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  if (izin.length) {
    const { headers } = await import("next/headers");
    const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "";
    if (!izin.includes(ip)) return "ip";
  }
  if (process.env.MERKEZ_IKI_ADIM === "kapali") return "tamam";
  const supabase = await sunucuIstemcisi();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal2") return "tamam";
  return data?.nextLevel === "aal2" ? "dogrula" : "kur";
}

/** Sunucu bileşeninde: yetki yoksa ana sayfaya yönlendirir. */
export async function paneliKoru(panel: Panel): Promise<YetkiSatiri[]> {
  const yetkiler = await yetkilerim();
  if (!paneleErisebilir(yetkiler, panel)) redirect("/?yetkisiz=1");
  if (panel === "merkez") {
    const g = await merkezGuvenligi();
    if (g === "ip") redirect("/?yetkisiz=ip");
    if (g !== "tamam") redirect(`/iki-adim?${g === "kur" ? "kur=1" : ""}`);
  }
  return yetkiler;
}

/**
 * Merkez işlemi için: oturumdaki kullanıcının genel kapsamlı yetkisi yoksa
 * hata fırlatır. Kullanıcı kimliğini döner (denetim kaydı için).
 */
export async function merkezYetkisi(yetki: YetkiKodu): Promise<string> {
  const supabase = await sunucuIstemcisi();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/giris");
  const yetkiler = await yetkilerim();
  if (!yetkiler.some((y) => y.yetki_kod === yetki && y.dershane_id === null)) {
    throw new Error("Bu işlem için yetkin yok.");
  }
  if ((await merkezGuvenligi()) !== "tamam") throw new Error("İki adımlı doğrulama gerekli.");
  return data.user.id;
}
