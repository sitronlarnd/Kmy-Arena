import { mdHtml } from "@/lib/md";
import { sunucuIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Projeksiyon ekranının yokladığı durum (soru metni HTML'e çevrilmiş). */
export async function GET(_i: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sunucuIstemcisi();
  const { data, error } = await s.rpc("panel_canli_ekran", { p_oturum: id });
  if (error) return Response.json({ hata: "yetkisiz" }, { status: 403 });
  const d = data as { soru?: { govde_md: string; siklar: Record<string, string>; dogru: string | null } | null } & Record<string, unknown>;
  const soru = d.soru ? { html: mdHtml(d.soru.govde_md), siklar: Object.entries(d.soru.siklar).map(([h, v]) => ({ h, html: mdHtml(v) })), dogru: d.soru.dogru } : null;
  return Response.json({ ...d, soru }, { headers: { "cache-control": "no-store" } });
}
