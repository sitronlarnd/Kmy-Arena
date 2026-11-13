"use server";

import { revalidatePath } from "next/cache";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

const DURUMLAR = ["yeni", "gorusuldu", "demo_yapildi", "pilot", "teklif_verildi", "kazanildi", "kaybedildi"];

export async function teklifGuncelle(f: FormData): Promise<void> {
  const k = await merkezYetkisi("merkez.satis");
  const id = String(f.get("id"));
  const durum = String(f.get("durum"));
  const tarih = String(f.get("sonraki") ?? "") || null;
  if (!DURUMLAR.includes(durum)) throw new Error("Geçersiz durum");
  const { error } = await servis().from("teklif").update({ durum, sonraki_adim_tarihi: tarih }).eq("id", id);
  if (error) throw new Error(error.message);
  await denetle(k, "teklif.durum", id, { durum, tarih });
  revalidatePath("/merkez/teklifler");
}

export async function lisansGuncelle(f: FormData): Promise<void> {
  const k = await merkezYetkisi("merkez.dershane_yonet");
  const id = String(f.get("id"));
  const durum = String(f.get("durum"));
  const limit = Math.max(1, Number(f.get("limit")) || 50);
  const bitis = String(f.get("bitis") ?? "") || null;
  if (!["pilot", "aktif", "gecikmis", "askida", "bitti"].includes(durum)) throw new Error("Geçersiz durum");
  const { error } = await servis().from("dershane").update({ lisans_durumu: durum, ogrenci_limiti: limit, lisans_bitis: bitis }).eq("id", id);
  if (error) throw new Error(error.message);
  await denetle(k, "dershane.lisans", id, { durum, limit, bitis });
  revalidatePath("/merkez/dershaneler");
}
