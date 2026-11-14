"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function konuKaydet(g: { kazanimId: string; baslik: string; tur: "video" | "metin" | "baglanti"; yol?: string | null; url?: string | null; metin?: string | null }): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("soru.yukle");
    if (g.baslik.trim().length < 2 || !g.kazanimId) return { hata: "Kazanım ve başlık gerekli." };
    if (g.tur === "video" && !g.yol?.startsWith(`${k.dershaneId}/`)) return { hata: "Önce videoyu yükleyin." };
    if (g.tur === "baglanti" && !/^https:\/\//.test(g.url ?? "")) return { hata: "Bağlantı https:// ile başlamalı." };
    if (g.tur === "metin" && !(g.metin ?? "").trim()) return { hata: "Açıklama yazın." };
    const s = await sunucuIstemcisi();
    const { error } = await s.from("konu_anlatimi").insert({
      dershane_id: k.dershaneId, ogretmen_id: k.kullaniciId, kazanim_id: g.kazanimId, baslik: g.baslik.trim().slice(0, 120), tur: g.tur,
      yol: g.tur === "video" ? g.yol : null, url: g.tur === "baglanti" ? g.url : null, metin: g.tur === "metin" ? (g.metin ?? "").slice(0, 4000) : null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ogretmen/konu");
    return { tamam: "Konu anlatımı eklendi. Bu kazanımda soru çözen öğrenciler çözümün altında görecek." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function konuSil(id: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.from("konu_anlatimi").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/ogretmen/konu");
    return { tamam: "Silindi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
