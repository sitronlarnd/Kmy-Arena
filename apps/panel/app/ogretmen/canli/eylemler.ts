"use server";

import { redirect } from "next/navigation";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { hataMetni } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";

async function baslat(arg: Record<string, unknown>): Promise<KayitSonucu> {
  let id: string;
  try {
    const s = await sunucuIstemcisi();
    const { data, error } = await s.rpc("panel_canli_baslat", arg);
    if (error) throw new Error(error.message);
    id = (data as { id: string }).id;
  } catch (e) {
    return { hata: e instanceof Error && e.message.includes("panel.soruYok") ? "Bu derste yeterli soru yok (en az 3)." : hataMetni(e) };
  }
  redirect(`/ogretmen/canli/${id}`);
}

export async function canliBaslat(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return baslat({ p_sinif: String(f.get("sinif") ?? ""), p_ders: String(f.get("ders") ?? ""), p_adet: Number(f.get("adet")) || 10, p_sure: Number(f.get("sure")) || 40, p_sorular: null, p_ad: String(f.get("ad") ?? "") || null });
}

export async function canliBaslatArsiv(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return baslat({ p_sinif: String(f.get("sinif") ?? ""), p_ders: null, p_adet: null, p_sure: Number(f.get("sure")) || 40, p_sorular: String(f.get("sorular") ?? "").split(",").filter(Boolean), p_ad: null });
}
