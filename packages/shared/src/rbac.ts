/**
 * Rol-yetki matrisi (RBAC). Bu dosya yetki kodlarının TEK kaynağıdır.
 * Veritabanındaki `yetki` ve `rol_yetki` tohumları (supabase/migrations/
 * 0003_rbac.sql) bununla birebir aynı olmalıdır; test/rbac.test.ts bunu denetler.
 * Kurucu, dershane içi rollerin yetkilerini panelden ince ayarlayabilir;
 * buradaki eşleşme yalnızca başlangıç (varsayılan) matrisidir.
 */

export const YETKILER = {
  // Merkez (platform) yetkileri
  "merkez.dershane_yonet": "Dershane, paket ve lisans yönetimi",
  "merkez.ozellik_bayragi": "Özellik bayraklarını açma/kapama",
  "merkez.ai_yonet": "AI Merkezi: model ve görev ayarları",
  "merkez.prompt_yonet": "Prompt stüdyosu ve A/B testleri",
  "merkez.mufredat_yonet": "Müfredat ağacı düzenleme",
  "merkez.ekonomi_yonet": "Oyun ekonomisi ve içerik tanımları",
  "merkez.moderasyon": "Merkez moderasyon",
  "merkez.satis": "Teklif, pilot ve satış hunisi",
  "merkez.finans": "Fatura, ödeme ve bayi komisyonları",
  "merkez.destek": "Destek talepleri ve salt okunur dershane görünümü",
  "merkez.denetim_oku": "Denetim kayıtlarını görme",
  "merkez.sistem": "Sistem, sürüm ve bakım ayarları",
  "bayi.kendi_dershaneleri": "Bayinin kendi getirdiği dershaneler",
  // Dershane yetkileri
  "dershane.ayar": "Dershane ayarları ve marka",
  "dershane.lisans": "Lisans ve faturalar",
  "dershane.rol_ata": "Ekip rolleri atama",
  "sube.yonet": "Şube yönetimi",
  "sinif.yonet": "Sınıf/grup yönetimi",
  "ogrenci.ekle": "Öğrenci ekleme, sınıf değiştirme",
  "ogrenci.kimlik_oku": "Öğrenci kimlik/iletişim bilgisi",
  "ogrenci.akademik_oku": "Öğrenci akademik verisi",
  "ogretmen.yonet": "Öğretmen atama ve yetkileri",
  "ogretmen.takip": "Öğretmen kullanım raporları",
  "veli.davet": "Veli davetleri",
  "odev.yonet": "Ödev ve etkinlik oluşturma",
  "soru.yukle": "Soru ve çözüm yükleme",
  "soru.ai_uret": "AI ile soru ürettirme",
  "moderasyon.yap": "Topluluk ve klan moderasyonu",
  "rapor.oku": "Dershane raporları",
  "rehberlik.oku": "Rehberlik notları ve risk uyarıları",
  "rehberlik.yaz": "Rehberlik notu yazma",
  "deneme.ice_aktar": "Deneme sonucu içe aktarma",
  "odul.yonet": "Ödül ve turnuva yönetimi",
  "destek.talep": "Merkeze destek talebi açma",
  // Öğrenci ve veli
  "soru.coz": "Soru çözme",
  "duello.oyna": "Düello",
  "klan.katil": "Klan",
  "topluluk.yaz": "Topluluk soru-cevap",
  "veli.rapor_oku": "Kendi çocuğunun raporu",
} as const;

export type YetkiKodu = keyof typeof YETKILER;
export const YETKI_KODLARI = Object.keys(YETKILER) as YetkiKodu[];

export const ROLLER = {
  merkez_sahip: { kapsam: "merkez", ad: "Sahip" },
  merkez_icerik: { kapsam: "merkez", ad: "İçerik editörü" },
  merkez_destek: { kapsam: "merkez", ad: "Destek" },
  merkez_satis: { kapsam: "merkez", ad: "Satış" },
  bayi: { kapsam: "merkez", ad: "Bayi" },
  kurucu: { kapsam: "dershane", ad: "Dershane kurucusu" },
  sube_muduru: { kapsam: "sube", ad: "Şube müdürü" },
  rehber_ogretmen: { kapsam: "dershane", ad: "Rehber öğretmen" },
  ogretmen: { kapsam: "dershane", ad: "Öğretmen" },
  sekreter: { kapsam: "sube", ad: "Sekreter / kayıt görevlisi" },
  ogrenci: { kapsam: "dershane", ad: "Öğrenci" },
  veli: { kapsam: "dershane", ad: "Veli" },
} as const;

export type RolKodu = keyof typeof ROLLER;
export type RolKapsami = (typeof ROLLER)[RolKodu]["kapsam"];

const MERKEZ_HEPSI = YETKI_KODLARI.filter((k) => k.startsWith("merkez."));

export const VARSAYILAN_ROL_YETKILERI: Readonly<Record<RolKodu, readonly YetkiKodu[]>> = {
  merkez_sahip: MERKEZ_HEPSI,
  merkez_icerik: ["merkez.mufredat_yonet", "merkez.prompt_yonet", "merkez.ekonomi_yonet"],
  merkez_destek: ["merkez.destek"],
  merkez_satis: ["merkez.satis"],
  bayi: ["bayi.kendi_dershaneleri"],
  kurucu: [
    "dershane.ayar", "dershane.lisans", "dershane.rol_ata", "sube.yonet", "sinif.yonet",
    "ogrenci.ekle", "ogrenci.kimlik_oku", "ogrenci.akademik_oku", "ogretmen.yonet", "ogretmen.takip",
    "veli.davet", "odev.yonet", "moderasyon.yap", "rapor.oku", "rehberlik.oku", "deneme.ice_aktar",
    "odul.yonet", "destek.talep",
  ],
  sube_muduru: [
    "sinif.yonet", "ogrenci.ekle", "ogrenci.kimlik_oku", "ogrenci.akademik_oku", "ogretmen.takip",
    "veli.davet", "odev.yonet", "moderasyon.yap", "rapor.oku", "deneme.ice_aktar", "odul.yonet",
  ],
  rehber_ogretmen: ["ogrenci.kimlik_oku", "ogrenci.akademik_oku", "rehberlik.oku", "rehberlik.yaz", "rapor.oku"],
  // Öğretmen, öğrenci verisine yalnızca ATANDIĞI sınıflar üzerinden erişir
  // (RLS: app.ogretmeni_mi). Dershane geneli akademik okuma yetkisi yoktur.
  ogretmen: ["odev.yonet", "soru.yukle", "soru.ai_uret", "moderasyon.yap"],
  sekreter: ["ogrenci.ekle", "ogrenci.kimlik_oku", "veli.davet"],
  ogrenci: ["soru.coz", "duello.oyna", "klan.katil", "topluluk.yaz"],
  veli: ["veli.rapor_oku"],
};

/** Bir kullanıcının rollerinden birinin istenen yetkiyi verip vermediği. */
export function yetkiVarMi(
  roller: readonly RolKodu[],
  yetki: YetkiKodu,
  matris: Readonly<Record<RolKodu, readonly YetkiKodu[]>> = VARSAYILAN_ROL_YETKILERI,
): boolean {
  return roller.some((r) => matris[r].includes(yetki));
}
