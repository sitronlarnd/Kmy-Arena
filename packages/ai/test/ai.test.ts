import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gorevAyariCoz,
  KisiselVeriHatasi,
  kisiselVeriyiTemizle,
  KmyaiIstemci,
  ortamdanVarsayilanlar,
  type AiCagriKaydi,
  type CagriIstegi,
} from "../src/index";

describe("Görev ayarları", () => {
  it("ortam değişkeni yoksa kararlaştırılan Claude modelleri kullanılır", () => {
    const a = ortamdanVarsayilanlar({});
    assert.equal(a.soru_uretim.modelBirincil, "claude-haiku-5-5");
    assert.equal(a.soru_dogrulama.modelBirincil, "claude-haiku-5-5");
    assert.equal(a.asistan.modelBirincil, "claude-sonnet-5-5");
    assert.equal(a.gorsel_okuma.modelBirincil, "claude-sonnet-5-5");
    assert.equal(a.veli_raporu.modelBirincil, "claude-sonnet-5-5");
    assert.equal(a.soru_uretim.modelYedek, "claude-haiku-4-5");
    assert.equal(a.ogretmen_soru_uretim.modelBirincil, "claude-sonnet-5-5");
    assert.equal(a.soru_uretim.zamanAsimiMs, 90000);
    assert.equal(a.asistan.zamanAsimiMs, 30000);
    assert.equal(a.asistan.yenidenDeneme, 2);
  });

  it("ortam değişkeni modeli değiştirir; panel katmanları ortamı ezer (dershane > paket > genel)", () => {
    const a = ortamdanVarsayilanlar({ KMYAI_MODEL_URETICI: "claude-x" });
    assert.equal(a.soru_uretim.modelBirincil, "claude-x");
    const c = gorevAyariCoz(a.soru_uretim, {
      genel: { modelBirincil: "genel-m" },
      paket: { modelBirincil: "paket-m", sicaklik: 0.2 },
      dershane: { modelBirincil: "dershane-m" },
    });
    assert.equal(c.modelBirincil, "dershane-m");
    assert.equal(c.sicaklik, 0.2);
    assert.equal(c.maxToken, a.soru_uretim.maxToken);
  });
});

describe("Kişisel veri filtresi", () => {
  it("e-posta, telefon, TCKN, bağlantı ve kullanıcı adını temizler", () => {
    const r = kisiselVeriyiTemizle(
      "Ben ali@ornek.com, tel 0532 123 45 67, TC 12345678901, insta @ali.yilmaz, site https://x.co/a",
    );
    for (const parca of ["ali@ornek.com", "0532", "12345678901", "@ali.yilmaz", "https://"]) {
      assert.ok(!r.metin.includes(parca), `${parca} kaldı: ${r.metin}`);
    }
    assert.deepEqual(r.bulunanlar.sort(), ["baglanti", "eposta", "kullanici_adi", "tckn", "telefon"].sort());
  });
  it("matematik ifadelerine dokunmaz", () => {
    const m = "x^2 + 3x - 10 = 0 ise x kaçtır? 2024 yılında 150 öğrenci";
    assert.equal(kisiselVeriyiTemizle(m).metin, m);
  });
});

const ayar = { ...ortamdanVarsayilanlar({}).soru_uretim, modelBirincil: "claude-sonnet-5-5", modelYedek: "claude-haiku-4-5", yenidenDeneme: 2 };
const istek = (ek: Partial<CagriIstegi> = {}): CagriIstegi => ({
  gorev: "soru_uretim",
  ayar,
  mesajlar: [{ role: "user", content: "Bir soru üret" }],
  baglam: { dershaneId: "d1", kullaniciId: "u1" },
  ...ek,
});
const basarili = (model: string) =>
  new Response(JSON.stringify({ model, choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), {
    status: 200,
  });

describe("KmyaiIstemci", () => {
  it("doğru uca, Bearer anahtarla, kişisel kimlik göndermeden istek atar ve loglar", async () => {
    const loglar: AiCagriKaydi[] = [];
    let govde = "";
    let url = "";
    let yetki = "";
    const k = new KmyaiIstemci({
      baseUrl: "https://www.kmyai.cloud/api/v1/",
      apiKey: "test-anahtar",
      fetch: async (u, init) => {
        url = String(u);
        govde = String(init?.body);
        yetki = new Headers(init?.headers).get("authorization") ?? "";
        return basarili("claude-sonnet-5-5");
      },
      logla: (l) => void loglar.push(l),
    });
    const r = await k.tamamla(istek());
    assert.equal(url, "https://www.kmyai.cloud/api/v1/chat/completions");
    assert.equal(yetki, "Bearer test-anahtar");
    assert.ok(!govde.includes("u1") && !govde.includes("d1"), "kimlik bilgisi gövdeye girmemeli");
    assert.equal(r.tokenCikis, 20);
    assert.equal(r.yedekKullanildi, false);
    assert.equal(loglar.length, 1);
    assert.equal(loglar[0]?.basarili, true);
    assert.equal(loglar[0]?.kullaniciId, "u1");
  });

  it("2 yeniden denemeden sonra yedek modele geçer", async () => {
    const modeller: string[] = [];
    const loglar: AiCagriKaydi[] = [];
    const k = new KmyaiIstemci({
      baseUrl: "https://x/api/v1",
      apiKey: "a",
      bekle: async () => undefined,
      logla: (l) => void loglar.push(l),
      fetch: async (_u, init) => {
        const m = (JSON.parse(String(init?.body)) as { model: string }).model;
        modeller.push(m);
        return m === "claude-haiku-4-5" ? basarili(m) : new Response("hata", { status: 503 });
      },
    });
    const r = await k.tamamla(istek());
    assert.deepEqual(modeller, ["claude-sonnet-5-5", "claude-sonnet-5-5", "claude-sonnet-5-5", "claude-haiku-4-5"]);
    assert.equal(r.yedekKullanildi, true);
    assert.equal(loglar.filter((l) => !l.basarili).length, 3);
  });

  it("tekrar denenemez 400 hatasında aynı modeli tekrar denemeden yedeğe geçer; 401'de durur", async () => {
    const modeller: string[] = [];
    const k = new KmyaiIstemci({
      baseUrl: "https://x", apiKey: "a", bekle: async () => undefined,
      fetch: async (_u, init) => {
        const m = (JSON.parse(String(init?.body)) as { model: string }).model;
        modeller.push(m);
        return m === "claude-haiku-4-5" ? basarili(m) : new Response("kötü", { status: 400 });
      },
    });
    await k.tamamla(istek());
    assert.deepEqual(modeller, ["claude-sonnet-5-5", "claude-haiku-4-5"]);

    const k2 = new KmyaiIstemci({ baseUrl: "https://x", apiKey: "a", fetch: async () => new Response("", { status: 401 }) });
    await assert.rejects(k2.tamamla(istek()), /401/);
  });

  it("zaman aşımında isteği keser", async () => {
    const k = new KmyaiIstemci({
      baseUrl: "https://x", apiKey: "a", bekle: async () => undefined,
      fetch: (_u, init) =>
        new Promise((_coz, reddet) => init?.signal?.addEventListener("abort", () => reddet(new Error("abort")))),
    });
    await assert.rejects(
      k.tamamla(istek({ ayar: { ...ayar, zamanAsimiMs: 20, yenidenDeneme: 0, modelYedek: ayar.modelBirincil } })),
      /zaman aşımı/,
    );
  });

  it("giden metinde öğrencinin adı varsa istek hiç gönderilmez", async () => {
    let cagrildi = false;
    const k = new KmyaiIstemci({ baseUrl: "https://x", apiKey: "a", fetch: async () => { cagrildi = true; return basarili("m"); } });
    await assert.rejects(
      k.tamamla(istek({ mesajlar: [{ role: "user", content: "Ayşe Kaya bu soruyu anlamadı" }], yasakliDegerler: ["Ayşe", "Kaya"] })),
      KisiselVeriHatasi,
    );
    assert.equal(cagrildi, false);
  });
});

describe("Hız sınırı (429)", () => {
  it("429'da Retry-After kadar bekleyip yeniden dener", async () => {
    const beklemeler: number[] = [];
    let n = 0;
    const istemci = new KmyaiIstemci({
      baseUrl: "https://ornek.test",
      apiKey: "k",
      bekle: async (ms) => void beklemeler.push(ms),
      fetch: (async () => {
        n++;
        if (n === 1) return new Response("{}", { status: 429, headers: { "retry-after": "8" } });
        return new Response(JSON.stringify({ choices: [{ message: { content: "tamam" } }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const r = await istemci.tamamla({
      gorev: "soru_uretim", ayar: ortamdanVarsayilanlar({}).soru_uretim, mesajlar: [{ role: "user", content: "x" }], baglam: { dershaneId: null, kullaniciId: null },
    });
    assert.equal(r.icerik, "tamam");
    assert.deepEqual(beklemeler, [8000]);
  });
});
