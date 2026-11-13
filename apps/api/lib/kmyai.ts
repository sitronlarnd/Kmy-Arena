import "server-only";
import { KmyaiHatasi, KmyaiIstemci, type AiCagriKaydi } from "@kmy/ai";
import { ortam } from "./ortam";
import { servisIstemcisi } from "./supabase";

let istemci: KmyaiIstemci | null = null;

/** Sunucu örneği başına eşzamanlı KMYAI isteği: 1 (KMYAI/CLIProxy'yi yormamak için). */
const ESZAMANLI = 1;
/** Platform geneli sırada bu kadardan uzun bekleme gerekiyorsa istek atılmaz (hata). */
const MAX_BEKLEME_MS = 120_000;

/** Platform geneli sıra (veritabanı): istekler arasında en az ai_istek_araligi_ms. */
async function siraBekle(): Promise<void> {
  const { data, error } = await servisIstemcisi().rpc("sistem_ai_sira");
  if (error) throw new KmyaiHatasi(`hız sırası alınamadı: ${error.message}`, null, false);
  const ms = Number(data) || 0;
  if (ms > MAX_BEKLEME_MS) throw new KmyaiHatasi("KMYAI sırası dolu", 429, false);
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}
let aktif = 0;
const kuyruk: Array<() => void> = [];

async function sinirliFetch(girdi: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (aktif >= ESZAMANLI) await new Promise<void>((r) => kuyruk.push(r));
  aktif++;
  try {
    await siraBekle();
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
  if (hata && /zaman aşımı|ağ hatası|HTTP 5\d\d|HTTP 429/.test(hata)) {
    ardisikHata++;
    // 2 ardışık erişim/hız hatasında 5 dakika KMYAI'ye hiç istek gitmez
    if (ardisikHata >= 2) acikKadar = Date.now() + 300_000;
  }
}

export function kmyaiErisilebilir(): boolean {
  return Date.now() >= acikKadar;
}

export function erisimHatasiMi(h: unknown): boolean {
  return h instanceof KmyaiHatasi && (h.durum === null || h.durum >= 500 || h.durum === 429);
}
