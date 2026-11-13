import "server-only";
import { KmyaiHatasi, KmyaiIstemci, type AiCagriKaydi } from "@kmy/ai";
import { ortam } from "./ortam";
import { servisIstemcisi } from "./supabase";

let istemci: KmyaiIstemci | null = null;

/** Sunucu örneği başına eşzamanlı KMYAI isteği sınırı (hız sınırına takılmamak için). */
const ESZAMANLI = 4;
let aktif = 0;
const kuyruk: Array<() => void> = [];

async function sinirliFetch(girdi: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (aktif >= ESZAMANLI) await new Promise<void>((r) => kuyruk.push(r));
  aktif++;
  try {
    return await fetch(girdi, init);
  } finally {
    aktif--;
    kuyruk.shift()?.();
  }
}

/** Tek KMYAI adaptörü; her deneme ai_cagri_log'a yazılır. Anahtar yoksa null. */
export function kmyai(): KmyaiIstemci | null {
  if (istemci) return istemci;
  const e = ortam();
  if (!e.KMYAI_API_KEY) return null;
  istemci = new KmyaiIstemci({
    baseUrl: e.KMYAI_BASE_URL,
    apiKey: e.KMYAI_API_KEY,
    fetch: sinirliFetch,
    logla: async (k: AiCagriKaydi) => {
      const { error } = await servisIstemcisi().from("ai_cagri_log").insert({
        dershane_id: k.dershaneId,
        kullanici_id: k.kullaniciId,
        amac: k.amac,
        model: k.model,
        token_giris: k.tokenGiris,
        token_cikis: k.tokenCikis,
        sure_ms: k.sureMs,
        basarili: k.basarili,
        hata: k.hata,
        prompt_surumu: k.promptSurumu,
      });
      if (error) console.error("ai_cagri_log yazılamadı", error.message);
      devreKaydet(k.basarili, k.hata);
    },
  });
  return istemci;
}

// ── Basit devre kesici: KMYAI art arda erişilemezse kısa süre denemeyi bırak ──
let ardisikHata = 0;
let acikKadar = 0;

function devreKaydet(basarili: boolean, hata: string | null): void {
  if (basarili) {
    ardisikHata = 0;
    return;
  }
  // Yalnızca erişim hataları sayılır (biçim/kalite reddi ve hız sınırı değil)
  if (hata && /zaman aşımı|ağ hatası|HTTP 5\d\d/.test(hata)) {
    ardisikHata++;
    if (ardisikHata >= 4) acikKadar = Date.now() + 120_000;
  }
}

export function kmyaiErisilebilir(): boolean {
  return Date.now() >= acikKadar;
}

export function erisimHatasiMi(h: unknown): boolean {
  return h instanceof KmyaiHatasi && (h.durum === null || h.durum >= 500 || h.durum === 429);
}
