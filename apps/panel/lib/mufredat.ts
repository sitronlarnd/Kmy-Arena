import "server-only";
import { servis } from "./servis";
import type { KazanimSecenek } from "./api";

/** Kazanım seçimi için düz liste (ders adına göre gruplanır). */
export async function kazanimListesi(): Promise<KazanimSecenek[]> {
  const { data } = await servis().from("kazanim").select("id, kod, aciklama, sinav_turu, unite:unite_id(ders:ders_id(id, ad, sira))").order("kod");
  return ((data ?? []) as unknown as { id: string; kod: string; aciklama: string; sinav_turu: string; unite: { ders: { id: string; ad: string } | null } | null }[])
    .map((k) => ({ id: k.id, kod: k.kod, aciklama: k.aciklama, sinav: k.sinav_turu, ders: k.unite?.ders?.ad ?? "?", dersId: k.unite?.ders?.id ?? "" }));
}

export async function dersListesi(): Promise<{ id: string; ad: string; sinav_turu: string }[]> {
  const { data } = await servis().from("ders").select("id, ad, sinav_turu").order("sinav_turu").order("sira");
  return (data ?? []) as { id: string; ad: string; sinav_turu: string }[];
}
