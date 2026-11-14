import "server-only";
import { servisIstemcisi } from "./supabase";

/** Merkezde düzenlenebilen e-posta şablonu: {anahtar} yer tutucuları doldurulur. */
export async function sablon(kod: string, degerler: Record<string, string | number>, varsayilan: { konu: string; govde: string }): Promise<{ konu: string; govde: string }> {
  const { data } = await servisIstemcisi().from("eposta_sablon").select("konu, govde").eq("kod", kod).maybeSingle();
  const doldur = (x: string) => x.replace(/\{(\w+)\}/g, (_, k: string) => String(degerler[k] ?? ""));
  return { konu: doldur((data?.konu as string) ?? varsayilan.konu), govde: doldur((data?.govde as string) ?? varsayilan.govde) };
}
