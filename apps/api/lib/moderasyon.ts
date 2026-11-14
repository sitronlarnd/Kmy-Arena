import "server-only";
import { normallestir } from "@kmy/shared";
import { IstemciHatasi } from "./http";
import { servisIstemcisi } from "./supabase";

/** Merkezin eklediği yasaklı kelimeler (genel + dershaneye özel), 5 dk önbellek. */
const onbellek = new Map<string, { t: number; l: string[] }>();

export async function ekKelimeDenetle(metin: string, dershaneId: string): Promise<void> {
  let o = onbellek.get(dershaneId);
  if (!o || Date.now() - o.t > 300_000) {
    const { data } = await servisIstemcisi().rpc("sistem_yasakli_kelimeler", { p_dershane: dershaneId });
    o = { t: Date.now(), l: ((data ?? []) as string[]).map((x) => normallestir(x)).filter(Boolean) };
    onbellek.set(dershaneId, o);
  }
  const n = normallestir(metin);
  if (o.l.some((k) => n.includes(k))) throw new IstemciHatasi("klan.filtre_kufur", 422);
}
