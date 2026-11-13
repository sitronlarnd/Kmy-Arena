import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { amblemGecerli, katilimCarpani, klanSeviyesi, metniDenetle, ozellikSeviyesi, klanSavasEtkisi } from "../src";

describe("moderasyon", () => {
  it("masum metinleri geçirir", () => {
    for (const m of ["Kartallar", "Sıkıntı yok, çalışıyoruz", "Matematik canavarları", "Hadi bugün 30 soru!", "götürü usulü", "sıkışık program"]) {
      assert.deepEqual(metniDenetle(m), { temiz: true, sebep: null }, m);
    }
  });
  it("küfürü yakalar (Türkçe karakter, leet, tekrar, ayrık harf)", () => {
    for (const m of ["siktir git", "S1KT1R", "orrrospu", "seni ger1zekalı", "s i k t i r", "amk"]) {
      assert.equal(metniDenetle(m).sebep, "kufur", m);
    }
  });
  it("kişisel bilgi ve bağlantıyı yakalar", () => {
    assert.equal(metniDenetle("numaram 0532 123 45 67").sebep, "kisisel_bilgi");
    assert.equal(metniDenetle("bana yaz ali@ornek.com").sebep, "kisisel_bilgi");
    assert.equal(metniDenetle("insta: ali_123").sebep, "kisisel_bilgi");
    assert.equal(metniDenetle("takip et @ali.veli").sebep, "kisisel_bilgi");
    assert.equal(metniDenetle("şuraya bak www.site.com").sebep, "baglanti");
    assert.notEqual(metniDenetle("discord.gg linki").sebep, null);
  });
});

describe("klan formülleri", () => {
  it("savaş etkisi: zor soru (düşük E) daha değerli", () => {
    assert.equal(klanSavasEtkisi(0.5), 15);
    assert.ok(Math.abs(klanSavasEtkisi(0.9) - 11) < 1e-9);
    assert.ok(klanSavasEtkisi(0.2) > klanSavasEtkisi(0.8));
  });
  it("katılım çarpanı", () => {
    assert.equal(katilimCarpani(0.2), 0.8);
    assert.equal(katilimCarpani(0.6), 1);
    assert.equal(katilimCarpani(0.9), 1.2);
    assert.equal(katilimCarpani(1), 1.3);
  });
  it("klan ve özellik seviyesi SQL ile aynı", () => {
    assert.deepEqual([0, 99, 100, 400, 900].map(klanSeviyesi), [1, 1, 2, 3, 4]);
    assert.deepEqual([0, 9, 10, 40, 90, 10_000].map(ozellikSeviyesi), [1, 1, 2, 3, 4, 10]);
  });
  it("amblem parçaları seviyeyle açılır", () => {
    assert.equal(amblemGecerli({ kalkan: "klasik", simge: "yildiz", renk: "#2E86AB" }), true);
    assert.equal(amblemGecerli({ kalkan: "tacli", simge: "yildiz", renk: "#2E86AB" }, 1), false);
    assert.equal(amblemGecerli({ kalkan: "tacli", simge: "ejder", renk: "#2E86AB" }, 5), true);
    assert.equal(amblemGecerli({ kalkan: "klasik", simge: "yildiz", renk: "#000000" }), false);
  });
});
