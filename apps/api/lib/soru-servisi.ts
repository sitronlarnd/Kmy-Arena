import "server-only";
import {
  antrenmanZorlugu,
  cevapHesapla,
  guvenilirSure,
  HAVUZ_AYARLARI,
  OYUN_AYARLARI,
  SIKLAR,
  tespitKazanimSirasi,
  tespitThetaGuncelle,
  tespitZorlugu,
  type CevapIstegi,
  type CevapSonucu,
  type CevapYaniti,
  type IpucuYaniti,
  type IstemciSorusu,
  type Sik,
  type SiradakiIstegi,
  type SiradakiYaniti,
  type SoruModu,
  type SoruTipi,
  type Ustalik,
} from "@kmy/shared";
import { after } from "next/server";
import { aiAyarlari, mufredatGetir, oyunAyarlari, type Mufredat, type MufredatKazanimi } from "./ayarlar";
import { arkaPlanIhtiyaci, havuzuDoldur } from "./havuz";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { kmyai, kmyaiErisilebilir } from "./kmyai";
import { katki as klanKatki } from "./klan-servisi";
import { cevapSonrasiOyun } from "./oyun-servisi";
import { servisIstemcisi } from "./supabase";

interface SoruSatiri {
  id: string;
  kazanim_id: string;
  sinav_turu: IstemciSorusu["sinav"];
  soru_tipi: SoruTipi;
  zorluk: number;
  olculmus_zorluk: number | null;
  tahmini_sure_sn: number;
  govde_md: string;
  siklar: Partial<Record<Sik, string>>;
  dogru: Sik;
  cozum_adimlari: string[];
  celdirici_notlari: Partial<Record<Sik, string>>;
  ipuclari: string[];
  kaynak: "ai" | "ogretmen";
}

interface SecimSonucu {
  soru: SoruSatiri | null;
  uzaklik: number | null;
  bant: number;
  bant_stok: number;
}

const BEKLEME_MS = 6000;

function istemciSorusu(s: SoruSatiri, k: MufredatKazanimi, ipucuSayisi = 0): IstemciSorusu {
  return {
    id: s.id,
    kazanimKodu: k.kod,
    kazanim: k.aciklama,
    ders: k.dersAd,
    sinav: s.sinav_turu,
    tip: s.soru_tipi,
    zorluk: Number(s.olculmus_zorluk ?? s.zorluk),
    tahminiSureSn: s.tahmini_sure_sn,
    govdeMd: s.govde_md,
    siklar: s.siklar,
    ipucuSayisi,
    ipucuVar: (s.ipuclari?.length ?? 0) > ipucuSayisi,
    aiUretimi: s.kaynak === "ai",
  };
}

/** Arka planda havuzu doldur (yanıt gönderildikten sonra çalışır). */
function arkaPlandaDoldur(kazanimId: string, bant: number, adet: number): void {
  if (adet <= 0) return;
  after(async () => {
    try {
      await havuzuDoldur(kazanimId, bant, adet, 240_000);
    } catch (h) {
      console.error("arka plan üretimi başarısız", h);
    }
  });
}

async function soruSec(
  k: Kullanici,
  p: { kazanimId: string | null; dersId?: string; hedef: number; baglam: string; hataDefteriId?: string | null; tespitId?: string | null },
): Promise<SecimSonucu> {
  const { data, error } = await servisIstemcisi().rpc("sistem_soru_sec", {
    p_kullanici: k.id,
    p_kazanim: p.kazanimId,
    p_hedef_zorluk: p.hedef,
    p_baglam: p.baglam,
    p_hata_defteri: p.hataDefteriId ?? null,
    p_tespit: p.tespitId ?? null,
    p_emeklilik: HAVUZ_AYARLARI.emeklilikGosterim,
    p_duello_max_gosterim: HAVUZ_AYARLARI.duelloMaxGosterim,
    p_ders: p.dersId ?? null,
  });
  if (error) throw error;
  return data as SecimSonucu;
}

/** Öğrencinin paketine ve sınıfına (LGS / YKS, alan) göre açık dersleri. */
export async function izinliDersler(k: Kullanici): Promise<Set<string>> {
  const { data, error } = await servisIstemcisi().rpc("sistem_ogrenci_dersleri", { p_kullanici: k.id });
  if (error) throw error;
  const set = new Set(((data ?? []) as Array<{ id: string }>).map((d) => d.id));
  if (set.size === 0) throw new IstemciHatasi("soru.paketYok", 403);
  return set;
}

function dersKontrol(izinli: Set<string>, dersId: string): void {
  if (!izinli.has(dersId)) throw new IstemciHatasi("soru.kapsamDisi", 403);
}

/** Antrenmanda kazanım seçimi: verilen kazanım, yoksa dersin en az çalışılmış kazanımlarından biri. */
async function antrenmanKazanimi(k: Kullanici, m: Mufredat, istek: SiradakiIstegi): Promise<MufredatKazanimi> {
  const izinli = await izinliDersler(k);
  if (istek.kazanimKodu) {
    const kz = m.kodla.get(istek.kazanimKodu);
    if (!kz) throw new IstemciHatasi("soru.kazanimYok", 404);
    dersKontrol(izinli, kz.dersId);
    return kz;
  }
  let liste: MufredatKazanimi[] = [];
  if (istek.dersKodu) {
    const d = m.dersKodla.get(istek.dersKodu);
    if (!d) throw new IstemciHatasi("soru.kazanimYok", 404);
    dersKontrol(izinli, d.id);
    liste = m.derseGore.get(d.id) ?? [];
  } else {
    liste = [...m.kazanimlar.values()].filter((x) => izinli.has(x.dersId));
  }
  if (liste.length === 0) throw new IstemciHatasi("soru.kazanimYok", 404);
  const { data } = await servisIstemcisi()
    .from("beceri")
    .select("kazanim_id, cozulen, ustalik")
    .eq("kullanici_id", k.id)
    .in("kazanim_id", liste.map((x) => x.id));
  const cozulen = new Map((data ?? []).map((b) => [b.kazanim_id as string, { n: b.cozulen as number, u: b.ustalik as Ustalik }]));
  // Altın olmayanlar arasından, az çalışılanlara ağırlık vererek seç (müfredat sırasını izler)
  const adaylar = liste.filter((x) => cozulen.get(x.id)?.u !== "altin");
  const havuz = adaylar.length > 0 ? adaylar : liste;
  const agirlik = havuz.map((x, i) => 1 / (1 + (cozulen.get(x.id)?.n ?? 0)) + (i < 3 ? 0.2 : 0));
  const toplam = agirlik.reduce((a, b) => a + b, 0);
  let r = Math.random() * toplam;
  for (let i = 0; i < havuz.length; i++) {
    r -= agirlik[i] ?? 0;
    if (r <= 0) return havuz[i] as MufredatKazanimi;
  }
  return havuz[0] as MufredatKazanimi;
}

async function beceriGetir(kullaniciId: string, kazanimId: string): Promise<{ theta: number; cozulen: number; son10: number[] }> {
  const { data } = await servisIstemcisi()
    .from("beceri")
    .select("theta, cozulen, son10")
    .eq("kullanici_id", kullaniciId)
    .eq("kazanim_id", kazanimId)
    .maybeSingle();
  return {
    theta: data ? Number(data.theta) : OYUN_AYARLARI.beceri.baslangicTheta,
    cozulen: data?.cozulen ?? 0,
    son10: (data?.son10 ?? []) as number[],
  };
}

async function havuzBosYaniti(): Promise<SiradakiYaniti> {
  const ayar = await aiAyarlari();
  if (ayar.yedekMod || !kmyai() || !kmyaiErisilebilir() || ayar.durdurulan.has("soru_uretim")) {
    return { durum: "yedek_mod", mesaj: "soru.yedekMod" };
  }
  return { durum: "hazirlaniyor", tekrarDeneMs: BEKLEME_MS };
}

export async function siradakiSoru(k: Kullanici, istek: SiradakiIstegi): Promise<SiradakiYaniti> {
  const [m, a] = await Promise.all([mufredatGetir(), oyunAyarlari()]);
  const s = servisIstemcisi();
  const mod: SoruModu = istek.mod;

  if (mod === "tekrar") {
    const { data: hd } = await s
      .from("hata_defteri")
      .select("id, kazanim_id, soru:soru_id (zorluk, olculmus_zorluk)")
      .eq("kullanici_id", k.id)
      .eq("durum", "acik")
      .lte("sonraki_tekrar", new Date().toISOString())
      .order("sonraki_tekrar")
      .limit(5);
    for (const h of hd ?? []) {
      const kz = m.kazanimlar.get(h.kazanim_id as string);
      if (!kz) continue;
      const eski = h.soru as unknown as { zorluk: number; olculmus_zorluk: number | null } | null;
      const hedef = Number(eski?.olculmus_zorluk ?? eski?.zorluk ?? 5);
      const r = await soruSec(k, { kazanimId: kz.id, hedef, baglam: "tekrar", hataDefteriId: h.id as string });
      if (r.bant_stok < 2) arkaPlandaDoldur(kz.id, r.bant, arkaPlanIhtiyaci(r.bant_stok));
      if (r.soru) return { durum: "soru", mod, soru: istemciSorusu(r.soru, kz) };
    }
    if ((hd ?? []).length > 0) return havuzBosYaniti();
    return { durum: "tekrar_yok" };
  }

  if (mod === "tespit") {
    const ders = istek.tespitDersKodu ? m.dersKodla.get(istek.tespitDersKodu) : undefined;
    if (!ders) throw new IstemciHatasi("soru.kazanimYok", 404);
    dersKontrol(await izinliDersler(k), ders.id);
    const kazanimlar = m.derseGore.get(ders.id) ?? [];
    let { data: oturum } = await s
      .from("tespit_oturumu")
      .select("id, theta, soru_sayisi, hedef_soru, bitis")
      .eq("kullanici_id", k.id)
      .eq("ders_id", ders.id)
      .order("olusturma", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (oturum?.bitis) return { durum: "tespit_bitti" };
    if (!oturum) {
      const yeni = await s
        .from("tespit_oturumu")
        .insert({ dershane_id: k.dershaneId, kullanici_id: k.id, ders_id: ders.id, hedef_soru: a.tespit.soruSayisi })
        .select("id, theta, soru_sayisi, hedef_soru, bitis")
        .single();
      if (yeni.error) throw yeni.error;
      oturum = yeni.data;
    }
    // Cevaplanmamış açık tespit sorusu varsa onu yeniden ver (yenileme ile atlanamaz)
    const { data: acik } = await s
      .from("soru_gosterim")
      .select("soru_id, ipucu_sayisi")
      .eq("kullanici_id", k.id)
      .eq("tespit_oturumu_id", oturum.id)
      .is("cevaplandi", null)
      .limit(1)
      .maybeSingle();
    const ilerleme = { cevaplanan: oturum.soru_sayisi as number, toplam: oturum.hedef_soru as number };
    if (acik) {
      const { data: sr } = await s.from("soru").select("*").eq("id", acik.soru_id).single();
      const kz = m.kazanimlar.get(sr.kazanim_id);
      if (kz) return { durum: "soru", mod, soru: istemciSorusu(sr as SoruSatiri, kz, acik.ipucu_sayisi), tespit: ilerleme };
    }
    const hedef = tespitZorlugu(Number(oturum.theta), a);
    const sira = tespitKazanimSirasi(oturum.soru_sayisi, kazanimlar.length, oturum.hedef_soru);
    // Seçilen kazanımda soru yoksa sıradakilere bak, en son dersin tamamına
    for (let i = 0; i < Math.min(kazanimlar.length, 4); i++) {
      const kz = kazanimlar[(sira + i) % kazanimlar.length];
      if (!kz) break;
      const r = await soruSec(k, { kazanimId: kz.id, hedef, baglam: "tespit", tespitId: oturum.id });
      if (r.bant_stok < 2) arkaPlandaDoldur(kz.id, r.bant, arkaPlanIhtiyaci(r.bant_stok));
      if (r.soru) return { durum: "soru", mod, soru: istemciSorusu(r.soru, kz), tespit: ilerleme };
    }
    const r = await soruSec(k, { kazanimId: null, dersId: ders.id, hedef, baglam: "tespit", tespitId: oturum.id });
    const kz = r.soru ? m.kazanimlar.get(r.soru.kazanim_id) : undefined;
    if (r.soru && kz) return { durum: "soru", mod, soru: istemciSorusu(r.soru, kz), tespit: ilerleme };
    return havuzBosYaniti();
  }

  // Antrenman
  const kz = await antrenmanKazanimi(k, m, istek);
  const [beceri, ilerleme] = await Promise.all([
    beceriGetir(k.id, kz.id),
    s.from("ogrenci_ilerleme").select("akis_sirasi").eq("kullanici_id", k.id).maybeSingle(),
  ]);
  const hedef = antrenmanZorlugu(beceri.theta, ilerleme.data?.akis_sirasi ?? 0, a);
  const r = await soruSec(k, { kazanimId: kz.id, hedef, baglam: "antrenman" });
  if (r.soru) {
    if ((r.uzaklik ?? 0) > 1.5 || r.bant_stok < HAVUZ_AYARLARI.ogrenciMinStok) {
      arkaPlandaDoldur(kz.id, r.bant, Math.max(2, arkaPlanIhtiyaci(r.bant_stok)));
    }
    return { durum: "soru", mod, soru: istemciSorusu(r.soru, kz) };
  }
  arkaPlandaDoldur(kz.id, r.bant, HAVUZ_AYARLARI.ogrenciMinStok);
  // Kazanım boşsa aynı dersin başka bir kazanımından ver (öğrenci beklemesin)
  if (!istek.kazanimKodu) {
    const yedek = await soruSec(k, { kazanimId: null, dersId: kz.dersId, hedef, baglam: "antrenman" });
    const ykz = yedek.soru ? m.kazanimlar.get(yedek.soru.kazanim_id) : undefined;
    if (yedek.soru && ykz) return { durum: "soru", mod, soru: istemciSorusu(yedek.soru, ykz) };
  }
  return havuzBosYaniti();
}

// ── Cevap ───────────────────────────────────────────────────────────

function sikMi(d: unknown): d is Sik {
  return typeof d === "string" && (SIKLAR as readonly string[]).includes(d);
}

export function cevapIsteginiCoz(g: Record<string, unknown>): CevapIstegi {
  if (typeof g.soruId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.soruId)) throw new IstemciHatasi("ortak.hata");
  const secilen = g.secilen === null || g.secilen === undefined ? null : sikMi(g.secilen) ? g.secilen : undefined;
  if (secilen === undefined) throw new IstemciHatasi("ortak.hata");
  const sureMs = Number(g.sureMs);
  return { soruId: g.soruId, secilen, sureMs: Number.isFinite(sureMs) ? sureMs : -1 };
}

export async function cevapVer(k: Kullanici, istek: CevapIstegi, deneme = 0): Promise<CevapYaniti> {
  const s = servisIstemcisi();
  const [m, a] = await Promise.all([mufredatGetir(), oyunAyarlari()]);
  const { data: g, error } = await s
    .from("soru_gosterim")
    .select("olusturma, cevaplandi, ipucu_sayisi, baglam, tespit_oturumu_id, soru:soru_id (*)")
    .eq("kullanici_id", k.id)
    .eq("soru_id", istek.soruId)
    .maybeSingle();
  if (error) throw error;
  if (!g) throw new IstemciHatasi("soru.gosterilmedi", 404);
  if (g.cevaplandi) throw new IstemciHatasi("soru.zatenCevaplandi", 409);
  const soru = g.soru as unknown as SoruSatiri;
  const kz = m.kazanimlar.get(soru.kazanim_id);
  if (!kz) throw new IstemciHatasi("soru.kazanimYok", 404);
  if (istek.secilen !== null && soru.siklar[istek.secilen] === undefined) throw new IstemciHatasi("ortak.hata");

  const sunucuMs = Date.now() - new Date(g.olusturma as string).getTime();
  const sureMs = guvenilirSure(istek.sureMs, sunucuMs, a);
  const sonuc: CevapSonucu = istek.secilen === null ? "bos" : istek.secilen === soru.dogru ? "dogru" : "yanlis";

  const [beceri, ilerleme, tespit] = await Promise.all([
    beceriGetir(k.id, kz.id),
    s.from("ogrenci_ilerleme").select("seri_dogru").eq("kullanici_id", k.id).maybeSingle(),
    g.tespit_oturumu_id
      ? s.from("tespit_oturumu").select("theta, soru_sayisi").eq("id", g.tespit_oturumu_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const zorluk = Number(soru.olculmus_zorluk ?? soru.zorluk);
  const h = cevapHesapla(
    {
      theta: beceri.theta, cozulen: beceri.cozulen, son10: beceri.son10, zorluk, tahminiSureSn: soru.tahmini_sure_sn,
      seriOnce: ilerleme.data?.seri_dogru ?? 0, ipucuSayisi: g.ipucu_sayisi as number, sonuc, sureMs,
    },
    a,
  );
  const tespitTheta = tespit.data
    ? tespitThetaGuncelle({ theta: Number(tespit.data.theta), cevaplanan: tespit.data.soru_sayisi, zorluk, sonuc }, a)
    : null;

  const { data: sonucDb, error: h2 } = await s.rpc("sistem_cevap_isle", {
    p: {
      kullanici_id: k.id,
      soru_id: soru.id,
      secilen: istek.secilen ?? "",
      dogru_mu: sonuc === "dogru",
      sure_ms: sureMs,
      theta_once: beceri.theta,
      theta_sonra: h.thetaSonra,
      sayildi: h.sayildi,
      beklenen: h.beklenen,
      xp: h.xp,
      altin: h.altin,
      ustalik: h.ustalik,
      ozellik: kz.ozellik,
      tekrar_araliklari_gun: a.tekrar.araliklarGun,
      tespit_theta: tespitTheta,
      zorluk,
    },
  });
  if (h2) {
    if (h2.message.includes("beceri.yarisma") && deneme < 2) return cevapVer(k, istek, deneme + 1);
    if (h2.message.includes("soru.zatenCevaplandi")) throw new IstemciHatasi("soru.zatenCevaplandi", 409);
    throw h2;
  }
  const d = sonucDb as {
    xp_toplam: number; altin_toplam: number; seviye: number; seviye_atladi: boolean; seri: number;
    hata_defteri: CevapYaniti["hataDefteri"]; tespit_bitti: boolean; ustalik_once: Ustalik;
    gunluk: Parameters<typeof cevapSonrasiOyun>[2];
  };
  // Oyun katmanı (görev, rozet) cevabı asla bozmaz: hata olursa loglanır, cevap yine döner.
  let oyun: CevapYaniti["oyun"];
  try {
    oyun = await cevapSonrasiOyun(
      k,
      {
        dogru: sonuc === "dogru", zorluk, kazanimId: kz.id, ipucuSayisi: g.ipucu_sayisi as number, baglam: g.baglam as string,
        hataDefteri: d.hata_defteri, ustalikOnce: d.ustalik_once, ustalikSonra: h.ustalik, ardisik: d.seri,
      },
      d.gunluk,
    );
  } catch (hata) {
    console.error("oyun katmanı işlenemedi", hata);
    oyun = {
      gunlukSoru: d.gunluk?.gunluk_soru ?? 0, gunlukHedef: d.gunluk?.gunluk_hedef ?? 10, hedefTamam: Boolean(d.gunluk?.hedef_tamam),
      seriGun: d.gunluk?.seri_gun ?? 0, seriDurum: d.gunluk?.seri_durum ?? null, tamamlananGorevler: [], yeniRozetler: [],
    };
  }
  // Klan katkısı (görev, boss, savaş) — ayrı korunur, cevabı asla bozmaz
  if (h.sayildi) {
    try {
      const klan = await klanKatki(k, { dogru: sonuc === "dogru", zorluk, beklenen: h.beklenen, kazanimId: kz.id, ozellik: kz.ozellik ?? null });
      if (klan) oyun.klan = { seviye: klan.seviye, seviyeAtladi: klan.seviye_atladi, tamamlananGorevler: klan.tamamlanan_gorevler, boss: klan.boss, savas: klan.savas };
    } catch (hata) {
      console.error("klan katkısı işlenemedi", hata);
    }
  }
  return {
    sonuc,
    dogru: soru.dogru,
    cozumAdimlari: soru.cozum_adimlari ?? [],
    celdiriciNotu: istek.secilen && istek.secilen !== soru.dogru ? (soru.celdirici_notlari?.[istek.secilen] ?? null) : null,
    xp: h.xp,
    altin: h.altin,
    xpToplam: Number(d.xp_toplam),
    altinToplam: d.altin_toplam,
    seviye: d.seviye,
    seviyeAtladi: d.seviye_atladi,
    seri: d.seri,
    thetaOnce: beceri.theta,
    thetaSonra: h.thetaSonra,
    ustalik: h.ustalik,
    sayilmadi: !h.sayildi,
    hataDefteri: d.hata_defteri,
    tespitBitti: d.tespit_bitti,
    oyun,
  };
}

// ── İpucu ve hata bildirimi ─────────────────────────────────────────

export async function ipucuAl(k: Kullanici, soruId: string): Promise<IpucuYaniti> {
  const s = servisIstemcisi();
  const { data: n, error } = await s.rpc("sistem_ipucu_al", { p_kullanici: k.id, p_soru: soruId, p_max: 3 });
  if (error) throw error;
  if (typeof n !== "number" || n < 1) throw new IstemciHatasi("soru.ipucuYok", 409);
  const { data: sr } = await s.from("soru").select("ipuclari").eq("id", soruId).single();
  const ipuclari = (sr?.ipuclari ?? []) as string[];
  const ipucu = ipuclari[n - 1];
  if (!ipucu) throw new IstemciHatasi("soru.ipucuYok", 409);
  return { ipucu, sira: n, kalan: Math.max(0, ipuclari.length - n) };
}

export async function hataBildir(k: Kullanici, soruId: string, aciklama: string | null): Promise<void> {
  const s = servisIstemcisi();
  const { data: g } = await s.from("soru_gosterim").select("soru_id").eq("kullanici_id", k.id).eq("soru_id", soruId).maybeSingle();
  if (!g) throw new IstemciHatasi("soru.gosterilmedi", 404);
  const { error } = await s.from("soru_hata_bildirimi").insert({
    dershane_id: k.dershaneId,
    kullanici_id: k.id,
    soru_id: soruId,
    aciklama: aciklama ? aciklama.slice(0, 500) : null,
  });
  if (error && error.code !== "23505") throw error; // aynı kişinin ikinci bildirimi sessizce yok sayılır
}
