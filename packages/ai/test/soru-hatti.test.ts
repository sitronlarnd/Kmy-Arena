import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dogruSikSec,
  jsonAyikla,
  kaliteKontrolu,
  KmyaiIstemci,
  ortamdanVarsayilanlar,
  sayisalKontrol,
  SORU_DOGRULAMA_V1,
  SORU_URETIM_V1,
  soruUret,
  uretilenSoruyuCoz,
  type AiCagriKaydi,
  type UretimIstegi,
} from "../src/index";

const istek: UretimIstegi = {
  kazanimKodu: "M.8.1.2.1",
  kazanimAciklama: "Tam sayıların kendileri ile tekrarlı çarpımını üslü ifade olarak yazar.",
  dersKodu: "lgs_matematik",
  dersAd: "Matematik",
  sinifDuzeyi: 8,
  sinav: "LGS",
  hedefZorluk: 3,
  soruTipi: "islem",
  dogruSik: "C",
  oncekiOzetler: ["2 üssü 5 kaçtır?"],
};

const iyiSoru = {
  kazanim_kodu: "M.8.1.2.1",
  ders: "lgs_matematik",
  sinav: "LGS",
  zorluk: 3,
  tahmini_sure_sn: 45,
  soru_tipi: "islem",
  govde_md: "$(-2)^3 \\cdot 3^2$ işleminin sonucu kaçtır?",
  gorsel: null,
  siklar: { A: "$-36$", B: "$36$", C: "$-72$", D: "$72$" },
  dogru: "C",
  cozum_adimlari: ["$(-2)^3 = -8$", "$3^2 = 9$", "$-8 \\cdot 9 = -72$"],
  celdirici_notlari: { D: "Negatif tabanın tek kuvvetinin negatif olduğunu unutur." },
  ipuclari: ["Önce üsleri hesapla.", "Negatif sayının tek kuvveti negatiftir.", "$-8$ ile $9$'u çarp."],
  sayisal_kontrol: { ifade: "(-2)^3 * 3^2", sonuc: "-72" },
};

function sahteIstemci(yanitlar: string[], kayitlar: AiCagriKaydi[] = []): KmyaiIstemci {
  let i = 0;
  return new KmyaiIstemci({
    baseUrl: "https://ornek.test/api/v1",
    apiKey: "test",
    bekle: async () => undefined,
    logla: (k) => void kayitlar.push(k),
    fetch: (async () =>
      new Response(JSON.stringify({ model: "m", choices: [{ message: { content: yanitlar[i++] ?? "" } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }), {
        status: 200,
      })) as typeof fetch,
  });
}

const ayar = ortamdanVarsayilanlar({});
const bag = (yanitlar: string[], kayitlar?: AiCagriKaydi[]) => ({
  istemci: sahteIstemci(yanitlar, kayitlar),
  uretimAyari: ayar.soru_uretim,
  dogrulamaAyari: ayar.soru_dogrulama,
  uretimPromptu: SORU_URETIM_V1,
  dogrulamaPromptu: SORU_DOGRULAMA_V1,
});
const dogrulayici = (cevap: string, ek: Record<string, unknown> = {}) =>
  JSON.stringify({ cozum: "...", cevap, tek_dogru_mu: true, kazanim_uygun: true, sorunlar: [], zorluk_tahmini: 3, ...ek });

describe("JSON ayıklama", () => {
  it("kod bloğu ve çevre metinden JSON'u çıkarır, metindeki } karakterine takılmaz", () => {
    assert.deepEqual(jsonAyikla('İşte:\n```json\n{"a": "x}y", "b": {"c": 1}}\n```'), { a: "x}y", b: { c: 1 } });
  });
});

describe("Kalite filtreleri", () => {
  it("iyi soru geçer", () => {
    assert.deepEqual(kaliteKontrolu(uretilenSoruyuCoz(JSON.stringify(iyiSoru), istek), istek), []);
  });
  it("LGS'de 5 şık, istenmeyen doğru harf, aynı şıklar reddedilir", () => {
    const s = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, dogru: "B", siklar: { ...iyiSoru.siklar, E: "$1$", A: "$36$" } }), istek);
    const n = kaliteKontrolu(s, istek).join(" | ");
    assert.match(n, /şık sayısı/);
    assert.match(n, /istenen C/);
    assert.match(n, /aynı metne/);
  });
  it("olumsuz kök kalın değilse reddedilir, kalınsa geçer", () => {
    const kotu = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, govde_md: "Aşağıdakilerden hangisi $-72$'ye eşit değildir?" }), istek);
    assert.match(kaliteKontrolu(kotu, istek).join(), /olumsuz/);
    const iyi = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, govde_md: "Aşağıdakilerden hangisi $-72$'ye eşit **değildir**?" }), istek);
    assert.doesNotMatch(kaliteKontrolu(iyi, istek).join(), /olumsuz/);
  });
  it("şıklar soru metnine de yazılmışsa reddedilir", () => {
    const s = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, govde_md: "Hangisi doğrudur?\n\nA) $-36$\nB) $36$\nC) $-72$\nD) $72$" }), istek);
    assert.match(kaliteKontrolu(s, istek).join(), /tekrar edilmiş/);
  });
  it("hedeften çok uzak zorluk ve eksik ipucu reddedilir", () => {
    const s = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, zorluk: 8, ipuclari: ["a"] }), istek);
    const n = kaliteKontrolu(s, istek).join();
    assert.match(n, /hedef 3/);
    assert.match(n, /3 ipucu/);
  });
  it("doğru harfler dengeli dağıtılır", () => {
    assert.equal(dogruSikSec("LGS", { A: 5, B: 5, C: 2, D: 5 }), "C");
    assert.ok(["D", "E"].includes(dogruSikSec("TYT", { A: 3, B: 3, C: 3 }, () => 0.9)));
  });
});

describe("Sayısal kontrol (mathjs)", () => {
  it("doğru hesap geçer", () => {
    assert.deepEqual(sayisalKontrol(uretilenSoruyuCoz(JSON.stringify(iyiSoru), istek)), { gecti: true });
  });
  it("yanlış anahtar yakalanır", () => {
    const s = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, sayisal_kontrol: { ifade: "(-2)^3 * 3^2", sonuc: "72" } }), istek);
    assert.equal(sayisalKontrol(s)?.gecti, false);
    const s2 = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, siklar: { ...iyiSoru.siklar, C: "$-70$" } }), istek);
    assert.equal(sayisalKontrol(s2)?.gecti, false);
  });
  it("karşılaştırma ifadesi denetlenmez (doğrulayıcıya bırakılır)", () => {
    const s = uretilenSoruyuCoz(JSON.stringify({ ...iyiSoru, sayisal_kontrol: { ifade: "72 % 8 == 0", sonuc: "1" } }), istek);
    assert.equal(sayisalKontrol(s), null);
  });
  it("Türkçe ondalık ve kesir yazımı", () => {
    const s = uretilenSoruyuCoz(
      JSON.stringify({ ...iyiSoru, siklar: { ...iyiSoru.siklar, C: "$\\frac{1}{4}$" }, sayisal_kontrol: { ifade: "1/4", sonuc: "0,25" } }),
      istek,
    );
    assert.deepEqual(sayisalKontrol(s), { gecti: true });
  });
});

describe("Üretim + doğrulama hattı", () => {
  it("KABUL: doğrulayıcı aynı cevabı bulursa soru doğrulanır; iki çağrı da loglanır, kişisel veri gitmez", async () => {
    const kayitlar: AiCagriKaydi[] = [];
    const r = await soruUret(bag([JSON.stringify(iyiSoru), dogrulayici("C")], kayitlar), istek);
    assert.equal(r.durum, "dogrulandi");
    assert.deepEqual(kayitlar.map((k) => k.amac), ["soru_uretim", "soru_dogrulama"]);
    assert.ok(kayitlar.every((k) => k.kullaniciId === null && k.basarili));
    assert.equal(kayitlar[0]?.promptSurumu, "soru-uretim@1"); // test V1 ile çağırıyor
  });
  it("KABUL: doğrulayıcıyla eşleşmeyen soru reddedilir", async () => {
    const r = await soruUret(bag([JSON.stringify(iyiSoru), dogrulayici("D")]), istek);
    assert.equal(r.durum, "reddedildi");
    assert.ok(r.durum === "reddedildi" && r.asama === "dogrulama" && /D buldu/.test(r.redNedeni));
  });
  it("doğrulayıcı sorun bildirirse veya birden çok doğru şık derse reddedilir", async () => {
    const r1 = await soruUret(bag([JSON.stringify(iyiSoru), dogrulayici("C", { sorunlar: ["yazım hatası"] })]), istek);
    assert.equal(r1.durum, "reddedildi");
    const r2 = await soruUret(bag([JSON.stringify(iyiSoru), dogrulayici("C", { tek_dogru_mu: false })]), istek);
    assert.equal(r2.durum, "reddedildi");
  });
  it("kalite filtresinden geçemeyen soru doğrulayıcıya hiç gitmez", async () => {
    const kayitlar: AiCagriKaydi[] = [];
    const r = await soruUret(bag([JSON.stringify({ ...iyiSoru, dogru: "A" })], kayitlar), istek);
    assert.ok(r.durum === "reddedildi" && r.asama === "kalite");
    assert.equal(kayitlar.length, 1);
  });
  it("bozuk JSON biçim hatası olarak reddedilir", async () => {
    const r = await soruUret(bag(["bu json değil"]), istek);
    assert.ok(r.durum === "reddedildi" && r.asama === "bicim");
  });
  it("cevap anahtarı doğrulayıcıya gönderilmez", async () => {
    let dogrulamaGovdesi = "";
    let n = 0;
    const istemci = new KmyaiIstemci({
      baseUrl: "https://ornek.test",
      apiKey: "k",
      fetch: (async (_u: string, init: RequestInit) => {
        n++;
        if (n === 2) dogrulamaGovdesi = String(init.body);
        const icerik = n === 1 ? JSON.stringify(iyiSoru) : dogrulayici("C");
        return new Response(JSON.stringify({ choices: [{ message: { content: icerik } }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    await soruUret({ ...bag([]), istemci }, istek);
    assert.ok(dogrulamaGovdesi.length > 0);
    assert.doesNotMatch(dogrulamaGovdesi, /celdirici|cozum_adimlari|"dogru"|Doğru şık harfi|-8 \\\\cdot 9/);
  });
});

describe("Doğrulama çıktısı token sınırında kesilirse", () => {
  it("karar alanları tamamsa kesik JSON'dan okunur", async () => {
    const { dogrulamaCiktisiniCoz } = await import("../src/index");
    const kesik = '{\n  "cevap": "C",\n  "tek_dogru_mu": true,\n  "kazanim_uygun": true,\n  "sorunlar": [],\n  "zorluk_tahmini": 4,\n  "cozum": "Önce üsleri hesapla, sonra çarp ve';
    assert.deepEqual(dogrulamaCiktisiniCoz(kesik), { cevap: "C", tekDogruMu: true, kazanimUygun: true, sorunlar: [], zorlukTahmini: 4 });
  });
  it("karar alanı eksikse hata verir (soru reddedilir)", async () => {
    const { dogrulamaCiktisiniCoz } = await import("../src/index");
    assert.throws(() => dogrulamaCiktisiniCoz('{"cozum": "uzun bir çözüm ve sonra kesil'));
  });
});
