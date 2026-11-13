/**
 * KmyaiIstemci — tüm KMYAI çağrılarının geçtiği TEK adaptör.
 *
 * - OpenAI uyumlu chat-completions: POST {KMYAI_BASE_URL}/chat/completions
 * - Her çağrıda zaman aşımı, N yeniden deneme, ardından yedek modele geçiş
 * - Her deneme `logla` ile ai_cagri_log'a yazılır (maliyet takibi)
 * - Giden içerikte bilinen kişisel değer varsa istek GÖNDERİLMEZ
 * - Yalnızca sunucuda çalışır; API anahtarı istemciye asla verilmez
 *
 * KMYAI API biçimi değişirse yalnızca bu dosya değişir.
 */

import type { AiGorevi, GorevAyari } from "./gorevler";
import { yasakliDegerIceriyorMu } from "./kisisel-veri";

export type IcerikParcasi =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface SohbetMesaji {
  role: "system" | "user" | "assistant";
  content: string | IcerikParcasi[];
}

export interface AiCagriKaydi {
  dershaneId: string | null;
  kullaniciId: string | null;
  amac: AiGorevi;
  model: string;
  tokenGiris: number;
  tokenCikis: number;
  sureMs: number;
  basarili: boolean;
  hata: string | null;
  promptSurumu: string | null;
}

export interface CagriIstegi {
  gorev: AiGorevi;
  ayar: GorevAyari;
  mesajlar: readonly SohbetMesaji[];
  jsonBekleniyor?: boolean;
  promptSurumu?: string;
  /** Yalnızca log içindir; KMYAI'ye GÖNDERİLMEZ. */
  baglam: { dershaneId: string | null; kullaniciId: string | null };
  /** Giden metinde geçmemesi gereken değerler (öğrencinin adı, takma adı, e-postası…) */
  yasakliDegerler?: readonly string[];
}

export interface CagriSonucu {
  icerik: string;
  model: string;
  tokenGiris: number;
  tokenCikis: number;
  sureMs: number;
  yedekKullanildi: boolean;
}

export class KisiselVeriHatasi extends Error {
  constructor() {
    super("AI isteğinde kişisel veri tespit edildi; istek gönderilmedi.");
    this.name = "KisiselVeriHatasi";
  }
}

export class KmyaiHatasi extends Error {
  readonly durum: number | null;
  readonly tekrarDenenebilir: boolean;
  /** 429 yanıtındaki Retry-After (ms) */
  readonly tekrarSonraMs: number | null;
  constructor(mesaj: string, durum: number | null, tekrarDenenebilir: boolean, tekrarSonraMs: number | null = null) {
    super(mesaj);
    this.name = "KmyaiHatasi";
    this.durum = durum;
    this.tekrarDenenebilir = tekrarDenenebilir;
    this.tekrarSonraMs = tekrarSonraMs;
  }
}

export interface KmyaiIstemciSecenekleri {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
  logla?: (k: AiCagriKaydi) => void | Promise<void>;
  simdi?: () => number;
  bekle?: (ms: number) => Promise<void>;
}

interface ChatYaniti {
  model?: string;
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function metinParcalari(mesajlar: readonly SohbetMesaji[]): string {
  return mesajlar
    .map((m) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : "")).join(" ")))
    .join("\n");
}

export class KmyaiIstemci {
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #logla: (k: AiCagriKaydi) => void | Promise<void>;
  readonly #simdi: () => number;
  readonly #bekle: (ms: number) => Promise<void>;

  constructor(s: KmyaiIstemciSecenekleri) {
    if (!s.apiKey) throw new Error("KMYAI_API_KEY tanımlı değil (yalnızca sunucu ortam değişkeni).");
    this.#baseUrl = s.baseUrl.replace(/\/+$/, "");
    this.#apiKey = s.apiKey;
    this.#fetch = s.fetch ?? globalThis.fetch.bind(globalThis);
    this.#logla = s.logla ?? (() => undefined);
    this.#simdi = s.simdi ?? Date.now;
    this.#bekle = s.bekle ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async tamamla(istek: CagriIstegi): Promise<CagriSonucu> {
    if (istek.yasakliDegerler && yasakliDegerIceriyorMu(metinParcalari(istek.mesajlar), istek.yasakliDegerler)) {
      throw new KisiselVeriHatasi();
    }
    const { ayar } = istek;
    const plan: Array<{ model: string; yedek: boolean }> = [];
    for (let i = 0; i <= ayar.yenidenDeneme; i++) plan.push({ model: ayar.modelBirincil, yedek: false });
    if (ayar.modelYedek && ayar.modelYedek !== ayar.modelBirincil) plan.push({ model: ayar.modelYedek, yedek: true });

    let sonHata: unknown = null;
    for (let i = 0; i < plan.length; i++) {
      const adim = plan[i];
      if (!adim) break;
      // Aynı modelde tekrar denenemez bir hata aldıysak kalan denemeleri atla.
      if (!adim.yedek && sonHata instanceof KmyaiHatasi && !sonHata.tekrarDenenebilir) continue;
      if (i > 0 && !adim.yedek) {
        // Hız sınırında (429) daha uzun bekle; sunucu Retry-After verdiyse ona uy.
        const hizSiniri = sonHata instanceof KmyaiHatasi && sonHata.durum === 429;
        const onerilen = sonHata instanceof KmyaiHatasi ? sonHata.tekrarSonraMs : null;
        await this.#bekle(hizSiniri ? Math.max(onerilen ?? 0, 5000 * 2 ** (i - 1)) : 3000 * 2 ** (i - 1));
      }
      try {
        return { ...(await this.#tekCagri(istek, adim.model)), yedekKullanildi: adim.yedek };
      } catch (h) {
        sonHata = h;
        if (h instanceof KmyaiHatasi && h.durum === 401) throw h;
      }
    }
    throw sonHata instanceof Error ? sonHata : new KmyaiHatasi("KMYAI çağrısı başarısız", null, false);
  }

  async #tekCagri(istek: CagriIstegi, model: string): Promise<Omit<CagriSonucu, "yedekKullanildi">> {
    const baslangic = this.#simdi();
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), istek.ayar.zamanAsimiMs);
    const kayit = (k: Partial<AiCagriKaydi>): Promise<void> =>
      Promise.resolve(
        this.#logla({
          dershaneId: istek.baglam.dershaneId,
          kullaniciId: istek.baglam.kullaniciId,
          amac: istek.gorev,
          model,
          tokenGiris: 0,
          tokenCikis: 0,
          sureMs: this.#simdi() - baslangic,
          basarili: false,
          hata: null,
          promptSurumu: istek.promptSurumu ?? null,
          ...k,
        }),
      ).catch(() => undefined);

    try {
      const yanit = await this.#fetch(`${this.#baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.#apiKey}` },
        body: JSON.stringify({
          model,
          messages: istek.mesajlar,
          temperature: istek.ayar.sicaklik,
          max_tokens: istek.ayar.maxToken,
          ...(istek.jsonBekleniyor ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: kontrol.signal,
      });
      if (!yanit.ok) {
        const tekrar = yanit.status === 429 || yanit.status >= 500;
        const ra = Number(yanit.headers.get("retry-after"));
        throw new KmyaiHatasi(`KMYAI HTTP ${yanit.status}`, yanit.status, tekrar, Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : null);
      }
      const veri = (await yanit.json()) as ChatYaniti;
      const icerik = veri.choices?.[0]?.message?.content ?? "";
      if (!icerik) throw new KmyaiHatasi("KMYAI boş yanıt döndü", yanit.status, true);
      const sonuc = {
        icerik,
        model: veri.model ?? model,
        tokenGiris: veri.usage?.prompt_tokens ?? 0,
        tokenCikis: veri.usage?.completion_tokens ?? 0,
        sureMs: this.#simdi() - baslangic,
      };
      await kayit({ ...sonuc, model, basarili: true });
      return sonuc;
    } catch (h) {
      const hata =
        h instanceof KmyaiHatasi
          ? h
          : new KmyaiHatasi(kontrol.signal.aborted ? "KMYAI zaman aşımı" : "KMYAI ağ hatası", null, true);
      await kayit({ hata: hata.message });
      throw hata;
    } finally {
      clearTimeout(zamanlayici);
    }
  }
}
