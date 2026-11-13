import "server-only";
import { sunucuIstemcisi } from "./supabase";

/** Panel RPC: oturumdaki kullanıcının jetonuyla; yetki fonksiyonun içinde denetlenir. */
export async function panelRpc<T>(ad: string, arg: Record<string, unknown> = {}): Promise<T> {
  const s = await sunucuIstemcisi();
  const { data, error } = await s.rpc(ad, arg);
  if (error) throw new Error(error.message.replace(/^.*?(panel\.\w+).*$/, "$1"));
  return data as T;
}

export const HATALAR: Record<string, string> = {
  "panel.yetkisiz": "Bu işlem için yetkin yok.",
  "panel.tarihGecersiz": "Son tarih gelecekte olmalı.",
  "panel.kazanimGecersiz": "Kazanım seçimi geçersiz.",
  "panel.ogrenciYok": "Seçilen hedefte öğrenci yok.",
  "panel.veriYok": "Bu sınıf için henüz yeterli çözüm verisi yok.",
  "panel.bulunamadi": "Kayıt bulunamadı.",
};
export const hataMetni = (e: unknown) => HATALAR[e instanceof Error ? e.message : ""] ?? "Bir şeyler ters gitti, tekrar dene.";

export function tarih(iso: string | null | undefined, saat = false): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", saat ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
}
export function onceKac(iso: string | null | undefined): string {
  if (!iso) return "hiç";
  const dk = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (dk < 60) return `${dk} dk önce`;
  if (dk < 1440) return `${Math.floor(dk / 60)} sa önce`;
  return `${Math.floor(dk / 1440)} gün önce`;
}
