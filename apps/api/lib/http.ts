import "server-only";
import { NextResponse } from "next/server";

/**
 * Mobil web farklı alan adından çağırır. Kimlik çerezle değil Authorization
 * başlığıyla taşındığı için tüm kökenlere izin vermek güvenlidir.
 */
export const CORS_BASLIKLARI = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
} as const;

export function json(veri: unknown, durum = 200): NextResponse {
  return NextResponse.json(veri, { status: durum, headers: { ...CORS_BASLIKLARI, "cache-control": "no-store" } });
}

export function onUcus(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_BASLIKLARI });
}

/** İstemciye gösterilebilir hata: i18n anahtarı + HTTP durumu. */
export class IstemciHatasi extends Error {
  readonly durum: number;
  constructor(anahtar: string, durum = 400) {
    super(anahtar);
    this.durum = durum;
  }
}

export async function govdeOku(istek: Request): Promise<Record<string, unknown>> {
  try {
    const v: unknown = await istek.json();
    return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Route gövdesini sarar: IstemciHatasi → 4xx, diğerleri → 500 (ayrıntı loga). */
export async function guvenli(is: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await is();
  } catch (h) {
    if (h instanceof IstemciHatasi) return json({ hata: h.message }, h.durum);
    console.error("API hatası", h);
    return json({ hata: "ortak.hata" }, 500);
  }
}
