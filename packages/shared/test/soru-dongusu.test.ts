import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  beklenenBasari,
  cevapHesapla,
  guvenilirSure,
  OYUN_AYARLARI,
  tespitKazanimSirasi,
  tespitThetaGuncelle,
  tespitZorlugu,
  zorluktanPuana,
  type CevapDurumu,
} from "../src/index";

function tohumlu(tohum: number): () => number {
  let a = tohum;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const taban: CevapDurumu = {
  theta: 1000, cozulen: 0, son10: [], zorluk: 2, tahminiSureSn: 60,
  seriOnce: 0, ipucuSayisi: 0, sonuc: "dogru", sureMs: 40_000,
};

describe("Cevap hesabı", () => {
  it("doğru cevap θ'yı artırır, XP ve Altın verir", () => {
    const h = cevapHesapla(taban);
    assert.ok(h.thetaSonra > 1000);
    assert.ok(h.xp > 0);
    assert.equal(h.altin, OYUN_AYARLARI.altin.dogruCevap);
    assert.equal(h.sayildi, true);
  });
  it("yanlış cevap θ'yı düşürür, ödül yok", () => {
    const h = cevapHesapla({ ...taban, sonuc: "yanlis" });
    assert.ok(h.thetaSonra < 1000);
    assert.equal(h.xp, 0);
    assert.equal(h.altin, 0);
  });
  it("çok hızlı rastgele doğru cevap ne beceriyi ne ödülü etkiler", () => {
    const h = cevapHesapla({ ...taban, sureMs: 3000 });
    assert.equal(h.sayildi, false);
    assert.equal(h.thetaSonra, 1000);
    assert.equal(h.xp, 0);
    assert.equal(h.altin, 0);
  });
  it("ipucu XP'yi azaltır, ceza vermez", () => {
    const ipucusuz = cevapHesapla(taban).xp;
    const ipuclu = cevapHesapla({ ...taban, ipucuSayisi: 2 }).xp;
    assert.ok(ipuclu < ipucusuz && ipuclu > 0);
    assert.equal(cevapHesapla({ ...taban, ipucuSayisi: 3, sonuc: "yanlis" }).xp, 0);
  });
  it("ustalık son 10 cevapla hesaplanır", () => {
    const h = cevapHesapla({ ...taban, theta: 1600, cozulen: 15, son10: [1, 1, 1, 1, 1, 1, 1, 0, 0, 1], zorluk: 9 });
    assert.equal(h.ustalik, "altin");
  });
});

describe("Seviye tespiti", () => {
  it("tespit soruları E ≈ 0,5 olacak zorlukta", () => {
    const z = tespitZorlugu(1450);
    assert.ok(Math.abs(beklenenBasari(1450, zorluktanPuana(z)) - 0.5) < 0.1);
  });
  it("KABUL: 10 soruda gerçek seviyeye yaklaşır (güçlü ve zayıf öğrenci)", () => {
    for (const gercek of [700, 1500, 1800]) {
      let toplamHata = 0;
      for (let tohum = 1; tohum <= 20; tohum++) {
        const r = tohumlu(tohum * 97 + gercek);
        let theta: number = OYUN_AYARLARI.beceri.baslangicTheta;
        for (let n = 0; n < OYUN_AYARLARI.tespit.soruSayisi; n++) {
          const zorluk = tespitZorlugu(theta);
          const dogru = r() < beklenenBasari(gercek, zorluktanPuana(zorluk));
          theta = tespitThetaGuncelle({ theta, cevaplanan: n, zorluk, sonuc: dogru ? "dogru" : "yanlis" });
        }
        toplamHata += Math.abs(theta - gercek);
      }
      const ortalamaHata = toplamHata / 20;
      assert.ok(ortalamaHata < Math.abs(1000 - gercek) * 0.7, `gerçek ${gercek}: ortalama hata ${ortalamaHata}`);
    }
  });
  it("kazanımlara eşit yayılır", () => {
    const sira = Array.from({ length: 10 }, (_, n) => tespitKazanimSirasi(n, 22, 10));
    assert.deepEqual(sira, [0, 2, 4, 6, 8, 11, 13, 15, 17, 19]);
    assert.deepEqual(Array.from({ length: 5 }, (_, n) => tespitKazanimSirasi(n, 3, 5)), [0, 1, 2, 0, 1]);
  });
});

describe("Süre güvenliği", () => {
  it("istemcinin bildirdiği süre sunucu ölçümüne ±2 sn sıkıştırılır", () => {
    assert.equal(guvenilirSure(500, 30_000), 28_000);
    assert.equal(guvenilirSure(31_000, 30_000), 31_000);
    assert.equal(guvenilirSure(-5, 30_000), 30_000);
    assert.equal(guvenilirSure(Number.NaN, 12_000), 12_000);
  });
});
