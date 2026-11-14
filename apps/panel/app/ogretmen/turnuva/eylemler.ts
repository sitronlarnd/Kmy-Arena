"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { apiCagir } from "@/lib/api";
import { hataMetni } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function turnuvaOlustur(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.rpc("panel_turnuva_olustur", {
      p_ad: String(f.get("ad") ?? "").trim().slice(0, 80) || "Sınıf turnuvası", p_sinif: String(f.get("sinif") ?? ""), p_ders: String(f.get("ders") ?? ""),
      p_boyut: Number(f.get("boyut")) || 8, p_ogrenciler: null, p_odul: String(f.get("odul") ?? "") || null,
    });
    if (error) throw new Error(error.message);
    // Maç düellolarını hemen aç (olmazsa 5 dk içinde zamanlanmış iş açar)
    await apiCagir("/api/turnuva/ogretmen-hazirla", {}).catch(() => undefined);
    revalidatePath("/ogretmen/turnuva");
    return { tamam: "Turnuva başladı. Öğrencilere ilk tur maçları için bildirim gider; her maç 24 saat içinde oynanır." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function turnuvaIptal(id: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.rpc("panel_turnuva_iptal", { p_turnuva: id });
    if (error) throw new Error(error.message);
    revalidatePath("/ogretmen/turnuva");
    return { tamam: "Turnuva iptal edildi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
