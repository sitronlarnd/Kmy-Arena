import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  antrenmanSorusuSec,
  ayarlariBirlestir,
  duelloSorusuSec,
  OYUN_AYARLARI,
  ozellikAcikMi,
  ROLLER,
  uretimIhtiyaci,
  VARSAYILAN_ROL_YETKILERI,
  YETKI_KODLARI,
  yetkiVarMi,
  zorlukBandi,
  type HavuzSorusu,
  type RolKodu,
} from "../src/index";
import { t } from "../src/i18n/index";

const soru = (id: string, gosterim: number, duello = 0, durum: HavuzSorusu["durum"] = "dogrulandi"): HavuzSorusu => ({
  id, kazanimId: "k1", zorluk: 5, durum, gosterimSayisi: gosterim, duelloKullanim: duello,
});

describe("Soru havuzu politikası", () => {
  it("zorluk bantları", () => {
    assert.deepEqual([1, 2, 3, 6, 9, 10].map(zorlukBandi), [1, 1, 2, 3, 5, 5]);
  });

  it("öğrenci gördüğü soruyu asla tekrar almaz", () => {
    const adaylar = [soru("a", 10), soru("b", 10)];
    for (let i = 0; i < 50; i++) {
      assert.equal(antrenmanSorusuSec(adaylar, new Set(["a"]))?.id, "b");
    }
    assert.equal(antrenmanSorusuSec(adaylar, new Set(["a", "b"])), null);
  });

  it("antrenman kullanılmış soruları tercih eder, tazeleri düelloya saklar", () => {
    const adaylar = [soru("taze", 0), soru("kullanilmis", 25)];
    for (let i = 0; i < 50; i++) assert.equal(antrenmanSorusuSec(adaylar, new Set())?.id, "kullanilmis");
  });

  it("doğrulanmamış veya emekli soru sunulmaz", () => {
    const adaylar = [soru("r", 1, 0, "reddedildi"), soru("u", 1, 0, "uretildi"), soru("e", 500)];
    assert.equal(antrenmanSorusuSec(adaylar, new Set()), null);
  });

  it("düello yalnızca taze/az kullanılmış ve düelloda kullanılmamış soru seçer", () => {
    const adaylar = [soru("cok", 40), soru("duelloda", 0, 1), soru("az", 2), soru("hic", 0)];
    assert.equal(duelloSorusuSec(adaylar, new Set())?.id, "hic");
    assert.equal(duelloSorusuSec(adaylar, new Set(["hic"]))?.id, "az");
    assert.equal(duelloSorusuSec(adaylar, new Set(["hic", "az"])), null);
  });

  it("üretim yalnızca stok yetmediğinde tetiklenir", () => {
    assert.equal(uretimIhtiyaci({ ogrenciIcinGorulmemis: 30, tazeDuelloStok: 10 }), 0);
    assert.equal(uretimIhtiyaci({ ogrenciIcinGorulmemis: 2, tazeDuelloStok: 10 }), 3);
    assert.equal(uretimIhtiyaci({ ogrenciIcinGorulmemis: 30, tazeDuelloStok: 0 }), 4);
  });
});

describe("Özellik bayrakları", () => {
  const D = "11111111-1111-1111-1111-111111111111";
  it("dershane kaydı > paket > genel > varsayılan", () => {
    assert.equal(ozellikAcikMi("dershaneler_arasi_lig", D, []), false);
    assert.equal(ozellikAcikMi("duello", D, [], { duello: false }), false);
    assert.equal(
      ozellikAcikMi("duello", D, [{ kod: "duello", dershaneId: D, acik: true, yuzde: 100 }], { duello: false }),
      true,
    );
    assert.equal(ozellikAcikMi("asistan", D, [{ kod: "asistan", dershaneId: null, acik: false, yuzde: 100 }]), false);
  });
  it("kademeli yayın kararlıdır ve yüzdeye yakın dağılır", () => {
    const kayit = [{ kod: "topluluk", dershaneId: null, acik: true, yuzde: 30 }];
    let acik = 0;
    for (let i = 0; i < 2000; i++) if (ozellikAcikMi("topluluk", `d-${i}`, kayit)) acik++;
    assert.ok(acik > 450 && acik < 750, `açık=${acik}`);
    assert.equal(ozellikAcikMi("topluluk", "d-5", kayit), ozellikAcikMi("topluluk", "d-5", kayit));
  });
});

describe("RBAC", () => {
  it("sekreter akademik veri göremez, rehber görür", () => {
    assert.equal(yetkiVarMi(["sekreter"], "ogrenci.akademik_oku"), false);
    assert.equal(yetkiVarMi(["rehber_ogretmen"], "ogrenci.akademik_oku"), true);
    assert.equal(yetkiVarMi(["ogrenci"], "rapor.oku"), false);
    assert.equal(yetkiVarMi(["veli"], "veli.rapor_oku"), true);
  });

  it("veritabanı tohumu TS matrisiyle birebir aynı", () => {
    const yol = fileURLToPath(new URL("../../../supabase/migrations/0003_rbac.sql", import.meta.url));
    const sql = readFileSync(yol, "utf8");
    const yetkiBlogu = sql.split("-- @yetkiler-basla")[1]?.split("-- @yetkiler-bitir")[0] ?? "";
    const sqlYetkiler = [...yetkiBlogu.matchAll(/\('([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]).sort();
    assert.deepEqual(sqlYetkiler, [...YETKI_KODLARI].sort());

    const matrisBlogu = sql.split("-- @matris-basla")[1]?.split("-- @matris-bitir")[0] ?? "";
    for (const rol of Object.keys(ROLLER) as RolKodu[]) {
      const satir = new RegExp(`\\('${rol}',\\s*array\\[([^\\]]*)\\]`).exec(matrisBlogu);
      assert.ok(satir, `${rol} matriste yok`);
      const kodlar = [...(satir[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
      assert.deepEqual(kodlar, [...VARSAYILAN_ROL_YETKILERI[rol]].sort(), rol);
    }
  });
});

describe("Ayar birleştirme ve i18n", () => {
  it("panelden gelen kısmi ayar yalnızca verilen alanı değiştirir", () => {
    const yeni = ayarlariBirlestir(OYUN_AYARLARI, { duello: { kupaK: 40 } });
    assert.equal(yeni.duello.kupaK, 40);
    assert.equal(yeni.duello.soruSayisi, 5);
    assert.equal(OYUN_AYARLARI.duello.kupaK, 32);
  });
  it("t() metin getirir", () => {
    assert.equal(t("sekmeler.duello"), "Düello");
  });
});
