"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { eposta, yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function talepAc(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("destek.talep");
    const konu = String(f.get("konu") ?? "").trim(), metin = String(f.get("metin") ?? "").trim();
    if (konu.length < 3 || !metin) return { hata: "Konu ve açıklama gerekli." };
    const s = await sunucuIstemcisi();
    const { data, error } = await s.from("destek_talep").insert({ dershane_id: k.dershaneId, acan_id: k.kullaniciId, konu: konu.slice(0, 120), oncelik: String(f.get("oncelik") ?? "normal") }).select("id").single();
    if (error) throw new Error(error.message);
    await s.from("destek_mesaj").insert({ talep_id: data.id, yazan_id: k.kullaniciId, metin: metin.slice(0, 4000) });
    if (process.env.SAHIP_EPOSTA) await eposta(process.env.SAHIP_EPOSTA, `Destek talebi: ${konu}`, metin);
    revalidatePath("/dershane/destek");
    return { tamam: "Talebiniz merkeze iletildi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function talepYaz(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("destek.talep");
    const s = await sunucuIstemcisi();
    const id = String(f.get("talep") ?? ""), metin = String(f.get("metin") ?? "").trim();
    if (metin) { const { error } = await s.from("destek_mesaj").insert({ talep_id: id, yazan_id: k.kullaniciId, metin: metin.slice(0, 4000) }); if (error) throw new Error(error.message); }
    if (f.get("kapat") === "on") await s.from("destek_talep").update({ durum: "kapandi" }).eq("id", id);
    else if (metin) await s.from("destek_talep").update({ durum: "acik" }).eq("id", id);
    revalidatePath("/dershane/destek");
    return { tamam: "Gönderildi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
