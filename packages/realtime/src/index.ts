/**
 * Gerçek zamanlı katman soyutlaması.
 *
 * Bugün: Supabase Realtime (Broadcast + Presence).
 * Yarın: 500 eşzamanlı bağlantı sınırı aşılınca ayrı küçük bir sunucu.
 * Geçiş için yalnızca yeni bir `RealtimeSaglayici` / `SunucuYayinci`
 * uygulaması yazılır; oyun kodu bu arayüzlere bağlıdır.
 *
 * Kural: istemciler kanalları yalnızca DİNLER. Cevaplar API'ye (HTTP)
 * gönderilir; kontrol ve puanlama sunucuda yapılır; sonuçları sunucu
 * `SunucuYayinci` ile yayınlar. Böylece cevap anahtarı tur bitmeden
 * hiçbir kanala düşmez ve istemciden gelen "kazandım"a güvenilmez.
 */

export type Abonelik = () => void;

/** İstemci tarafı: kanalı dinler, isteğe bağlı varlık (presence) bildirir. */
export interface RealtimeKanal {
  readonly ad: string;
  dinle<T>(olay: string, geriCagri: (veri: T) => void): Abonelik;
  /** Varlık durumu (ör. "hazır", "bağlı"); düello odasında rakibin bağlı olup olmadığı için */
  varlikBildir(durum: Readonly<Record<string, unknown>>): Promise<void>;
  varliklar(): ReadonlyArray<Readonly<Record<string, unknown>>>;
  kapat(): Promise<void>;
}

export interface RealtimeSaglayici {
  kanal(ad: string): RealtimeKanal;
}

/** Sunucu tarafı: yetkili yayın (service role / özel sunucu anahtarı). */
export interface SunucuYayinci {
  yayinla<T>(kanal: string, olay: string, veri: T): Promise<void>;
}

/** Kanal adları tek yerde. */
export const kanallar = {
  duello: (duelloId: string) => `duello:${duelloId}`,
  eslesme: (kullaniciId: string) => `eslesme:${kullaniciId}`,
  canliYarisma: (dershaneId: string, oturumId: string) => `canli:${dershaneId}:${oturumId}`,
  klanSavasi: (savasId: string) => `klan-savasi:${savasId}`,
  kullanici: (kullaniciId: string) => `kullanici:${kullaniciId}`,
} as const;

/** Düello olayları (Faz 3'te yük tipleriyle genişletilecek). */
export const DUELLO_OLAYLARI = {
  geriSayim: "geri_sayim",
  soru: "soru",
  rakipCevapladi: "rakip_cevapladi",
  turSonu: "tur_sonu",
  duelloSonu: "duello_sonu",
  ping: "ping",
} as const;

// ── Bellek içi uygulama (test ve yerel geliştirme) ──────────────────

type Dinleyici = (veri: unknown) => void;

export class BellekIciRealtime implements RealtimeSaglayici, SunucuYayinci {
  readonly #dinleyiciler = new Map<string, Set<Dinleyici>>();
  readonly #varliklar = new Map<string, Map<symbol, Readonly<Record<string, unknown>>>>();

  kanal(ad: string): RealtimeKanal {
    const kimlik = Symbol(ad);
    const abonelikler: Array<() => void> = [];
    const varliklarHaritasi = (): Map<symbol, Readonly<Record<string, unknown>>> => {
      let h = this.#varliklar.get(ad);
      if (!h) {
        h = new Map();
        this.#varliklar.set(ad, h);
      }
      return h;
    };
    return {
      ad,
      dinle: <T>(olay: string, geriCagri: (veri: T) => void): Abonelik => {
        const anahtar = `${ad}|${olay}`;
        let set = this.#dinleyiciler.get(anahtar);
        if (!set) {
          set = new Set();
          this.#dinleyiciler.set(anahtar, set);
        }
        const d: Dinleyici = (v) => geriCagri(v as T);
        set.add(d);
        const iptal = (): void => void set.delete(d);
        abonelikler.push(iptal);
        return iptal;
      },
      varlikBildir: async (durum) => {
        varliklarHaritasi().set(kimlik, durum);
      },
      varliklar: () => [...varliklarHaritasi().values()],
      kapat: async () => {
        for (const iptal of abonelikler) iptal();
        varliklarHaritasi().delete(kimlik);
      },
    };
  }

  async yayinla<T>(kanal: string, olay: string, veri: T): Promise<void> {
    for (const d of this.#dinleyiciler.get(`${kanal}|${olay}`) ?? []) d(veri);
  }
}

// ── Supabase sunucu yayıncısı (HTTP broadcast, ek bağımlılık yok) ────

export interface SupabaseYayinciSecenekleri {
  supabaseUrl: string;
  /** SUPABASE_SERVICE_ROLE_KEY — yalnızca sunucuda */
  servisAnahtari: string;
  /** Özel (RLS korumalı) kanal mı? Faz 3'te true yapılacak. */
  ozelKanal?: boolean;
  fetch?: typeof fetch;
}

/**
 * Supabase Realtime REST broadcast uç noktası üzerinden yayın yapar.
 * Sunucusuz (Vercel fonksiyonu / Postgres) ortamda kalıcı WebSocket
 * gerekmez.
 */
export class SupabaseSunucuYayinci implements SunucuYayinci {
  readonly #s: Required<Omit<SupabaseYayinciSecenekleri, "fetch">> & { fetch: typeof fetch };

  constructor(s: SupabaseYayinciSecenekleri) {
    this.#s = {
      supabaseUrl: s.supabaseUrl.replace(/\/+$/, ""),
      servisAnahtari: s.servisAnahtari,
      ozelKanal: s.ozelKanal ?? false,
      fetch: s.fetch ?? globalThis.fetch.bind(globalThis),
    };
  }

  async yayinla<T>(kanal: string, olay: string, veri: T): Promise<void> {
    const yanit = await this.#s.fetch(`${this.#s.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: this.#s.servisAnahtari,
        authorization: `Bearer ${this.#s.servisAnahtari}`,
      },
      body: JSON.stringify({
        messages: [{ topic: kanal, event: olay, payload: veri, private: this.#s.ozelKanal }],
      }),
    });
    if (!yanit.ok) throw new Error(`Realtime yayını başarısız: HTTP ${yanit.status}`);
  }
}
