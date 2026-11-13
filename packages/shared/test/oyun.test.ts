import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ESYALAR,
  evrimAsamasi,
  gorevIlerlemesi,
  gorunenSeri,
  gunlukGorevleriSec,
  haftalikGorevler,
  KARAKTERLER,
  ligAdimi,
  ROZETLER,
  rozetIlerlemesi,
  yeniRozetler,
  type GorevOlayi,
  type OyunMetrikleri,
} from "../src/index";

const bos: OyunMetrikleri = {
  toplam_cevap: 0, toplam_dogru: 0, seviye: 1, seri_gun: 0, en_uzun_seri: 0, max_ardisik: 0, sabah_cozum: 0,
  zor_dogru: 0, ipucusuz_dogru: 0, temizlenen_hata: 0, gorev_tamamlanan: 0, haftalik_gorev_tamamlanan: 0,
  lig_yukselme: 0, en_iyi_lig_adim: 1, ozellik_min: 0, bronz_ustu: 0, gumus_ustu: 0, altin: 0, acik_hata: 0,
  tespit_biten: 0, ders_sayisi: 6, tam_set: false, envanter: 0,
};

describe("Katalog", () => {
  it("6 eşit karakter, telifsiz özgün adlar", () => {
    assert.equal(KARAKTERLER.length, 6);
    assert.equal(new Set(KARAKTERLER.map((k) => k.tur)).size, 6);
  });
  it("en az 40 rozet tanımlı ve kodlar benzersiz; 40'ı bu fazda kazanılabilir", () => {
    assert.ok(ROZETLER.length >= 40);
    assert.equal(new Set(ROZETLER.map((r) => r.kod)).size, ROZETLER.length);
    assert.ok(ROZETLER.filter((r) => r.kosul).length >= 40);
  });
  it("mağazada yalnızca kozmetik ve seri dondurucu var, gerçek para yok", () => {
    for (const e of ESYALAR) assert.ok(["kostum", "cerceve", "arka_plan", "duello_efekti", "seri_dondurucu"].includes(e.tur));
    assert.equal(new Set(ESYALAR.map((e) => e.kod)).size, ESYALAR.length);
    assert.equal(ESYALAR.find((e) => e.kod === "seri_dondurucu")?.fiyat, 200);
  });
  it("evrim 10/25/50, lig adımları", () => {
    assert.deepEqual([1, 10, 24, 25, 50].map((s) => evrimAsamasi(s)), [0, 1, 1, 2, 3]);
    assert.equal(ligAdimi(1).ad, "Bronz III");
    assert.equal(ligAdimi(3).ad, "Bronz I");
    assert.equal(ligAdimi(7).ad, "Altın III");
    assert.equal(ligAdimi(18).ad, "Efsane I");
  });
});

describe("Rozetler", () => {
  it("ilk soru ve eşikler", () => {
    assert.deepEqual(yeniRozetler({ ...bos, toplam_cevap: 1 }, new Set()).map((r) => r.kod), ["ilk_soru"]);
    assert.deepEqual(yeniRozetler({ ...bos, toplam_cevap: 1 }, new Set(["ilk_soru"])), []);
    const m = { ...bos, toplam_cevap: 120, toplam_dogru: 60, en_uzun_seri: 7, altin: 1, bronz_ustu: 3, gumus_ustu: 2 };
    const kodlar = yeniRozetler(m, new Set()).map((r) => r.kod);
    for (const k of ["soru_100", "dogru_50", "seri_3", "seri_7", "ilk_bronz", "ilk_gumus", "ilk_altin"]) assert.ok(kodlar.includes(k), k);
    assert.ok(!kodlar.includes("soru_500"));
  });
  it("özel koşullar: sıfır hata, tam set, çok yönlü", () => {
    assert.ok(yeniRozetler({ ...bos, temizlenen_hata: 10, acik_hata: 0 }, new Set()).some((r) => r.kod === "hata_sifir"));
    assert.ok(!yeniRozetler({ ...bos, temizlenen_hata: 10, acik_hata: 1 }, new Set()).some((r) => r.kod === "hata_sifir"));
    assert.ok(yeniRozetler({ ...bos, tam_set: true }, new Set()).some((r) => r.kod === "tam_set"));
    assert.ok(yeniRozetler({ ...bos, ozellik_min: 50 }, new Set()).some((r) => r.kod === "cok_yonlu"));
  });
  it("sonraki fazların rozetleri kazanılamaz", () => {
    const hepsi = { ...bos, toplam_cevap: 1e6, toplam_dogru: 1e6, seviye: 99, en_uzun_seri: 999, max_ardisik: 999, sabah_cozum: 999,
      zor_dogru: 999, ipucusuz_dogru: 999, temizlenen_hata: 999, gorev_tamamlanan: 999, haftalik_gorev_tamamlanan: 99,
      lig_yukselme: 9, en_iyi_lig_adim: 18, ozellik_min: 999, bronz_ustu: 999, gumus_ustu: 999, altin: 999, tespit_biten: 9, tam_set: true, envanter: 99 };
    const kazanilan = new Set(yeniRozetler(hepsi, new Set()).map((r) => r.kod));
    assert.equal(kazanilan.size, ROZETLER.filter((r) => r.kosul).length);
    assert.ok(!kazanilan.has("duello_ilk"));
  });
  it("ilerleme gösterimi", () => {
    const r = ROZETLER.find((x) => x.kod === "soru_100");
    assert.ok(r);
    assert.deepEqual(rozetIlerlemesi(r, { ...bos, toplam_cevap: 37 }), { mevcut: 37, hedef: 100 });
  });
});

describe("Görevler", () => {
  const olay: GorevOlayi = {
    dogru: true, zorluk: 6, kazanimId: "k1", ipucuSayisi: 0, baglam: "antrenman", hataDefteri: null,
    ustalikOnce: "kesfedilmedi", ustalikSonra: "kesfedilmedi", ardisik: 3, gunlukSoru: 7, hedefTamam: false,
  };
  it("KABUL: günlük 3 görevden biri her zaman zayıf konuya yönlendirir", () => {
    for (let t = 0; t < 20; t++) {
      const g = gunlukGorevleriSec({ zayifKazanim: { id: "k9", kod: "M.8.1.3.1" }, vadesiGelenTekrar: 0, kirilanSeri: 0, gunlukHedef: 10 }, () => (t * 0.137) % 1);
      assert.equal(g.length, 3);
      assert.equal(g[0]?.kod, "zayif_konu");
      assert.match(g[0]?.baslik ?? "", /M\.8\.1\.3\.1/);
      assert.equal(new Set(g.map((x) => x.kod)).size, 3);
      assert.ok(!g.some((x) => x.kod === "tekrar_3"), "vadesi gelen tekrar yokken tekrar görevi");
    }
  });
  it("seri kırıldıysa 'seriyi geri kazan' görevi (2 kat soru) eklenir", () => {
    const g = gunlukGorevleriSec({ zayifKazanim: null, vadesiGelenTekrar: 5, kirilanSeri: 6, gunlukHedef: 10 });
    const s = g.find((x) => x.kod === "seri_geri_kazan");
    assert.equal(s?.hedef, 20);
  });
  it("ilerleme ölçütleri", () => {
    const g = (kod: string, ilerleme = 0, parametre: Record<string, unknown> = {}) => ({ gorev_kod: kod, ilerleme, hedef: 10, parametre });
    assert.equal(gorevIlerlemesi(g("soru_10", 2), olay), 3);
    assert.equal(gorevIlerlemesi(g("dogru_8", 2), { ...olay, dogru: false }), null);
    assert.equal(gorevIlerlemesi(g("ardisik_5", 1), olay), 3);
    assert.equal(gorevIlerlemesi(g("ardisik_5", 4), olay), null);
    assert.equal(gorevIlerlemesi(g("zor_3"), { ...olay, zorluk: 4 }), null);
    assert.equal(gorevIlerlemesi(g("zayif_konu", 0, { kazanimId: "k1" }), olay), 1);
    assert.equal(gorevIlerlemesi(g("zayif_konu", 0, { kazanimId: "k2" }), olay), null);
    assert.equal(gorevIlerlemesi(g("h_ustalik_2"), { ...olay, ustalikSonra: "bronz" }), 1);
    assert.equal(gorevIlerlemesi(g("h_hedef_5"), { ...olay, hedefTamam: true }), 1);
    assert.equal(gorevIlerlemesi(g("seri_geri_kazan", 5), olay), 7);
    assert.equal(gorevIlerlemesi(g("soru_10", 10), olay), 10);
  });
  it("haftalık görevler", () => assert.equal(haftalikGorevler().length, 4));
});

describe("Seri gösterimi", () => {
  it("dün tamamlandıysa sürüyor ama tehlikede; dondurucu boşluğu kapatır", () => {
    assert.deepEqual(gorunenSeri({ seriGun: 5, seriSonGun: "2026-11-13", dondurucu: 0, bugun: "2026-11-13" }), { seri: 5, tehlikede: false });
    assert.deepEqual(gorunenSeri({ seriGun: 5, seriSonGun: "2026-11-12", dondurucu: 0, bugun: "2026-11-13" }), { seri: 5, tehlikede: true });
    assert.deepEqual(gorunenSeri({ seriGun: 5, seriSonGun: "2026-11-10", dondurucu: 2, bugun: "2026-11-13" }), { seri: 5, tehlikede: true });
    assert.deepEqual(gorunenSeri({ seriGun: 5, seriSonGun: "2026-11-10", dondurucu: 1, bugun: "2026-11-13" }), { seri: 0, tehlikede: false });
  });
});
