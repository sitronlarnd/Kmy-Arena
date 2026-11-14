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
  "panel.rolGecersiz": "Geçersiz rol.",
  "panel.ogrenciGerekli": "Veli kodu bir öğrenciye bağlı olmalı.",
  "panel.epostaKayitli": "Bu e-posta ile zaten bir hesap var.",
  "panel.kullaniciAdiUretilemedi": "Kullanıcı adı üretilemedi, tekrar deneyin.",
  "panel.sinifDolu": "Sınıfta öğrenci varken silinemez; önce arşivleyin veya öğrencileri taşıyın.",
  "panel.dosyaGecersiz": "Dosya okunamadı. Şablondaki sütunları kullanın (Excel .xlsx veya CSV).",
  "giris.lisansDolu": "Lisanstaki öğrenci sınırına ulaşıldı. Merkezle iletişime geçin.",
  "giris.lisansPasif": "Dershane lisansı pasif.",
  "giris.takmaAdAlinmis": "Bu takma ad alınmış.",
  "giris.takmaAdGecersiz": "Takma ad 3-20 harf/rakam olmalı.",
};
export const hataMetni = (e: unknown) => {
  const m = e instanceof Error ? e.message : "";
  return HATALAR[m] ?? HATALAR[m.match(/(panel|giris)\.\w+/)?.[0] ?? ""] ?? "Bir şeyler ters gitti, tekrar dene.";
};

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
