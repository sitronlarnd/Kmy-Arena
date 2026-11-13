import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adilCevapZamani,
  beklenenBasari,
  duelloTurSuresiSn,
  hedefZorluk,
  kFaktoru,
  katilimCarpani,
  klanSavasEtkisi,
  kupaDegisimi,
  netHesapla,
  olculmusZorluk,
  siradakiHedefBasari,
  thetaGuncelle,
  ustalikHesapla,
  xpdenSeviye,
  xpHesapla,
  zorluktanPuana,
  type KalibrasyonCevabi,
} from "../src/index";

/** Tekrarlanabilir sözde rastgele üreteç (mulberry32). */
function tohumlu(tohum: number): () => number {
  let a = tohum;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Elo beceri motoru", () => {
  it("zorluk → puan dönüşümü şartnamedeki gibi", () => {
    assert.equal(zorluktanPuana(1), 800);
    assert.equal(zorluktanPuana(6), 1450);
    assert.equal(zorluktanPuana(10), 1970);
  });

  it("eşit θ ve d için beklenen başarı 0,5", () => {
    assert.equal(beklenenBasari(1000, 1000), 0.5);
  });

  it("K faktörü kademeleri: 40 → 24 → 16", () => {
    assert.equal(kFaktoru(0), 40);
    assert.equal(kFaktoru(19), 40);
    assert.equal(kFaktoru(20), 24);
    assert.equal(kFaktoru(199), 24);
    assert.equal(kFaktoru(200), 16);
  });

  it("çok hızlı (rastgele) cevap beceriyi etkilemez", () => {
    const r = thetaGuncelle({ theta: 1000, cozulen: 0, d: 1000, sonuc: "dogru", sureMs: 5000, tahminiSureMs: 60000 });
    assert.equal(r.sayildi, false);
    assert.equal(r.theta, 1000);
  });

  it("boş cevap S = 0,2 ile hesaplanır", () => {
    const r = thetaGuncelle({ theta: 1000, cozulen: 0, d: 1000, sonuc: "bos", sureMs: 30000, tahminiSureMs: 60000 });
    assert.ok(Math.abs(r.theta - (1000 + 40 * (0.2 - 0.5))) < 1e-9);
  });

  it("KABUL: güçlü öğrencinin θ'sı 30 soruda yükselir, zayıfınki düşer, zorluk buna göre değişir", () => {
    // Başlangıç θ=1200: tespit sınavı sonrası tipik değer. θ=1000'de hedef
    // zorluk zaten tabanda (1) olduğundan aşağı yönde değişim görülemez
    // (bkz. docs/VARSAYIMLAR.md, "Zorluk ölçeği").
    const simuleEt = (gercekYetenek: number, tohum: number) => {
      const rnd = tohumlu(tohum);
      let theta = 1200;
      const ilkZorluk = hedefZorluk(theta, 0);
      for (let i = 0; i < 30; i++) {
        const z = hedefZorluk(theta, i);
        const d = zorluktanPuana(z);
        const dogruMu = rnd() < beklenenBasari(gercekYetenek, d);
        theta = thetaGuncelle({
          theta, cozulen: i, d, sonuc: dogruMu ? "dogru" : "yanlis", sureMs: 40000, tahminiSureMs: 60000,
        }).theta;
      }
      return { theta, ilkZorluk, sonZorluk: hedefZorluk(theta, 0) };
    };
    const guclu = simuleEt(1600, 7);
    const zayif = simuleEt(700, 7);
    assert.ok(guclu.theta > 1350, `güçlü θ=${guclu.theta}`);
    assert.ok(zayif.theta < 1050, `zayıf θ=${zayif.theta}`);
    assert.ok(guclu.sonZorluk > guclu.ilkZorluk);
    assert.ok(zayif.sonZorluk < zayif.ilkZorluk);
  });

  it("akışta her 5 soruda bir meydan okuma (0,45) ve bir güven (0,85) sorusu", () => {
    const hedefler = [0, 1, 2, 3, 4].map((i) => siradakiHedefBasari(i));
    assert.deepEqual(hedefler, [0.7, 0.7, 0.45, 0.7, 0.85]);
    assert.ok(hedefZorluk(1400, 2) > hedefZorluk(1400, 0));
    assert.ok(hedefZorluk(1400, 4) < hedefZorluk(1400, 0));
  });
});

describe("Zorluk kalibrasyonu (havuz kararı)", () => {
  it("20 cevaptan az veriyle kalibrasyon yapmaz", () => {
    assert.equal(olculmusZorluk(Array.from({ length: 19 }, () => ({ theta: 1000, sonuc: "dogru" as const }))), null);
  });

  it("gerçek zorluğu cevap istatistiğinden geri bulur", () => {
    const rnd = tohumlu(42);
    const gercekD = zorluktanPuana(7); // 1580
    const cevaplar: KalibrasyonCevabi[] = Array.from({ length: 400 }, () => {
      const theta = 1000 + rnd() * 800;
      return { theta, sonuc: rnd() < beklenenBasari(theta, gercekD) ? "dogru" : "yanlis" };
    });
    const k = olculmusZorluk(cevaplar);
    assert.ok(k);
    assert.ok(Math.abs(k.d - gercekD) < 60, `ölçülen d=${k.d}`);
    assert.ok(Math.abs(k.zorluk - 7) <= 0.5);
  });
});

describe("Ustalık", () => {
  it("eşikler", () => {
    assert.equal(ustalikHesapla({ theta: 1100, cozulen: 4, son10Dogru: 4 }), "kesfedilmedi");
    assert.equal(ustalikHesapla({ theta: 1000, cozulen: 5, son10Dogru: 3 }), "bronz");
    assert.equal(ustalikHesapla({ theta: 1300, cozulen: 10, son10Dogru: 6 }), "gumus");
    assert.equal(ustalikHesapla({ theta: 1500, cozulen: 12, son10Dogru: 8 }), "altin");
    assert.equal(ustalikHesapla({ theta: 1500, cozulen: 12, son10Dogru: 7 }), "gumus");
  });
});

describe("XP", () => {
  const taban = { zorluk: 5, sureMs: 60000, tahminiSureMs: 60000, seri: 1, ipucuSayisi: 0, beklenen: 0.7 };
  it("taban: 10 × zorluk", () => assert.equal(xpHesapla(taban), 50));
  it("hız çarpanı en fazla 1,3", () => assert.equal(xpHesapla({ ...taban, sureMs: 0 }), 65));
  it("seri çarpanı en fazla 1,5", () => assert.equal(xpHesapla({ ...taban, seri: 50 }), 75));
  it("ipucu çarpanları 0,8 / 0,6 / 0,4", () => {
    assert.deepEqual([1, 2, 3, 9].map((i) => xpHesapla({ ...taban, ipucuSayisi: i })), [40, 30, 20, 20]);
  });
  it("seviyenin çok altındaki soru (E > 0,95) ×0,2", () => assert.equal(xpHesapla({ ...taban, beklenen: 0.97 }), 10));
  it("seviye eğrisi artan", () => {
    assert.equal(xpdenSeviye(0), 1);
    assert.ok(xpdenSeviye(10000) > xpdenSeviye(1000));
  });
});

describe("Sınav, düello, klan", () => {
  it("net: LGS 3 yanlış, YKS 4 yanlış bir doğruyu götürür", () => {
    assert.equal(netHesapla(10, 3, "LGS"), 9);
    assert.equal(netHesapla(10, 4, "TYT"), 9);
  });
  it("Kupa (K=32) eşit güçte ±16", () => {
    assert.equal(kupaDegisimi(1000, 1000, true), 16);
    assert.equal(kupaDegisimi(1000, 1000, false), -16);
  });
  it("adil zamanlama düzeltmesi en fazla 250 ms", () => {
    assert.equal(adilCevapZamani(10000, 100), 9950);
    assert.equal(adilCevapZamani(10000, 2000), 9750);
  });
  it("düello tur süresi 20-120 sn", () => {
    assert.equal(duelloTurSuresiSn(5), 20);
    assert.equal(duelloTurSuresiSn(75), 75);
    assert.equal(duelloTurSuresiSn(500), 120);
  });
  it("klan savaşı etkisi ve katılım çarpanı", () => {
    assert.equal(klanSavasEtkisi(1), 10);
    assert.equal(klanSavasEtkisi(0.4), 16);
    assert.equal(katilimCarpani(0.3), 0.8);
    assert.equal(katilimCarpani(0.6), 1);
    assert.equal(katilimCarpani(0.85), 1.2);
    assert.equal(katilimCarpani(1), 1.3);
  });
});
