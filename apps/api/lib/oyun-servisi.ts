import "server-only";
import {
  ESYALAR,
  esyaBul,
  gorevIlerlemesi,
  gorunenSeri,
  gunlukGorevleriSec,
  haftalikGorevler,
  KARAKTERLER,
  OYUN_AYARLARI,
  ROZETLER,
  yeniRozetler,
  type CevapOyunSonucu,
  type GorevOlayi,
  type OyunDurumu,
  type OyunGorevi,
  type OyunMetrikleri,
  type UretilenGorev,
} from "@kmy/shared";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { servisIstemcisi } from "./supabase";

/** Europe/Istanbul tarihi (YYYY-MM-DD). */
export function bugunIst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date());
}

export function haftaBasi(gun: string): string {
  const d = new Date(`${gun}T00:00:00Z`);
  const fark = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - fark);
  return d.toISOString().slice(0, 10);
}

interface GorevSatiri {
  id: string;
  gorev_kod: string;
  tur: "gunluk" | "haftalik";
  baslik: string;
  hedef: number;
  ilerleme: number;
  parametre: Record<string, unknown>;
  odul_xp: number;
  odul_altin: number;
  tamamlandi: string | null;
  donem: string;
}

async function ilerlemeSatiri(k: Kullanici) {
  const s = servisIstemcisi();
  await s.from("ogrenci_ilerleme").upsert({ kullanici_id: k.id, dershane_id: k.dershaneId }, { onConflict: "kullanici_id", ignoreDuplicates: true });
  const { data, error } = await s.from("ogrenci_ilerleme").select("*").eq("kullanici_id", k.id).single();
  if (error) throw error;
  return data as Record<string, unknown> & {
    xp: number; altin: number; seviye: number; seri_gun: number; seri_son_gun: string | null; seri_dondurucu: number;
    en_uzun_seri: number; gunluk_gun: string | null; gunluk_soru: number; gunluk_hedef: number; lig_adim: number;
    hafta: string | null; haftalik_xp: number; onceki_seri: number; seri_kirilma_gunu: string | null; ozellik_puanlari: Record<string, number>;
  };
}

/** En zayıf kazanım: çalışılmışlar arasında θ en düşük; yoksa kapsamdaki ilk kazanım. */
async function zayifKazanim(k: Kullanici): Promise<{ id: string; kod: string } | null> {
  const s = servisIstemcisi();
  const { data: dersler } = await s.rpc("sistem_ogrenci_dersleri", { p_kullanici: k.id });
  const dersIdleri = ((dersler ?? []) as Array<{ id: string }>).map((d) => d.id);
  if (dersIdleri.length === 0) return null;
  const { data: b } = await s
    .from("beceri")
    .select("theta, kazanim:kazanim_id (id, kod, unite:unite_id (ders_id))")
    .eq("kullanici_id", k.id)
    .gt("cozulen", 0)
    .order("theta")
    .limit(30);
  for (const r of (b ?? []) as unknown as Array<{ kazanim: { id: string; kod: string; unite: { ders_id: string } } }>) {
    if (dersIdleri.includes(r.kazanim.unite.ders_id)) return { id: r.kazanim.id, kod: r.kazanim.kod };
  }
  const { data: ilk } = await s
    .from("kazanim")
    .select("id, kod, sira, unite:unite_id!inner (ders_id, sira)")
    .in("unite.ders_id", dersIdleri)
    .limit(1);
  const x = (ilk ?? [])[0] as { id: string; kod: string } | undefined;
  return x ? { id: x.id, kod: x.kod } : null;
}

async function gorevEkle(k: Kullanici, gorevler: UretilenGorev[], donem: string): Promise<void> {
  if (gorevler.length === 0) return;
  const { error } = await servisIstemcisi()
    .from("kullanici_gorev")
    .upsert(
      gorevler.map((g) => ({
        dershane_id: k.dershaneId, kullanici_id: k.id, gorev_kod: g.kod, tur: g.tur, donem, baslik: g.baslik,
        hedef: g.hedef, parametre: g.parametre, odul_xp: g.xp, odul_altin: g.altin,
      })),
      { onConflict: "kullanici_id,gorev_kod,donem", ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Bugünün ve bu haftanın görevlerini (yoksa) oluşturur ve döner. */
export async function gorevleriHazirla(k: Kullanici, ilerleme?: Awaited<ReturnType<typeof ilerlemeSatiri>>): Promise<GorevSatiri[]> {
  const s = servisIstemcisi();
  const bugun = bugunIst();
  const hafta = haftaBasi(bugun);
  const { data } = await s
    .from("kullanici_gorev")
    .select("id, gorev_kod, tur, baslik, hedef, ilerleme, parametre, odul_xp, odul_altin, tamamlandi, donem")
    .eq("kullanici_id", k.id)
    .in("donem", [bugun, hafta]);
  let liste = (data ?? []) as GorevSatiri[];
  const gunluk = liste.filter((g) => g.tur === "gunluk" && g.donem === bugun);
  const haftalik = liste.filter((g) => g.tur === "haftalik" && g.donem === hafta);
  const i = ilerleme ?? (await ilerlemeSatiri(k));
  const kirilan = i.seri_kirilma_gunu === bugun ? i.onceki_seri : 0;
  let degisti = false;
  if (gunluk.length === 0) {
    const [zayif, tekrar] = await Promise.all([
      zayifKazanim(k),
      s.from("hata_defteri").select("id", { count: "exact", head: true }).eq("kullanici_id", k.id).eq("durum", "acik").lte("sonraki_tekrar", new Date().toISOString()),
    ]);
    await gorevEkle(k, gunlukGorevleriSec({ zayifKazanim: zayif, vadesiGelenTekrar: tekrar.count ?? 0, kirilanSeri: kirilan, gunlukHedef: i.gunluk_hedef }), bugun);
    degisti = true;
  } else if (kirilan >= 2 && !gunluk.some((g) => g.gorev_kod === "seri_geri_kazan")) {
    // Seri gün içinde kırıldıysa "seriyi geri kazan" sonradan eklenir
    await gorevEkle(k, gunlukGorevleriSec({ zayifKazanim: null, vadesiGelenTekrar: 0, kirilanSeri: kirilan, gunlukHedef: i.gunluk_hedef }).filter((g) => g.kod === "seri_geri_kazan"), bugun);
    degisti = true;
  }
  if (haftalik.length === 0) {
    await gorevEkle(k, haftalikGorevler(), hafta);
    degisti = true;
  }
  if (degisti) {
    const { data: yeni } = await s
      .from("kullanici_gorev")
      .select("id, gorev_kod, tur, baslik, hedef, ilerleme, parametre, odul_xp, odul_altin, tamamlandi, donem")
      .eq("kullanici_id", k.id)
      .in("donem", [bugun, hafta]);
    liste = (yeni ?? []) as GorevSatiri[];
  }
  return liste.filter((g) => (g.tur === "gunluk" ? g.donem === bugun : g.donem === hafta));
}

function gorevGorunumu(g: GorevSatiri): OyunGorevi {
  return {
    id: g.id, kod: g.gorev_kod, tur: g.tur, baslik: g.baslik, hedef: g.hedef, ilerleme: g.ilerleme,
    xp: g.odul_xp, altin: g.odul_altin, tamamlandi: Boolean(g.tamamlandi),
  };
}

export async function oyunDurumu(k: Kullanici): Promise<OyunDurumu> {
  const s = servisIstemcisi();
  const i = await ilerlemeSatiri(k);
  const [gorevler, karakter, rozet, envanter] = await Promise.all([
    gorevleriHazirla(k, i),
    s.from("karakter").select("tur, kostum, cerceve, arka_plan, duello_efekti, unvan").eq("kullanici_id", k.id).maybeSingle(),
    s.from("kullanici_rozet").select("rozet_kod").eq("kullanici_id", k.id),
    s.from("envanter").select("esya_kod").eq("kullanici_id", k.id),
  ]);
  const bugun = bugunIst();
  const seri = gorunenSeri({ seriGun: i.seri_gun, seriSonGun: i.seri_son_gun, dondurucu: i.seri_dondurucu, bugun });
  return {
    karakter: karakter.data ?? null,
    xp: Number(i.xp),
    altin: i.altin,
    seviye: i.seviye,
    seri: seri.seri,
    seriTehlikede: seri.tehlikede,
    enUzunSeri: i.en_uzun_seri,
    dondurucu: i.seri_dondurucu,
    gunlukSoru: i.gunluk_gun === bugun ? i.gunluk_soru : 0,
    gunlukHedef: i.gunluk_hedef,
    ligAdim: i.lig_adim,
    haftalikXp: i.hafta === haftaBasi(bugun) ? i.haftalik_xp : 0,
    gorevler: gorevler.sort((a, b) => (a.tur === b.tur ? 0 : a.tur === "gunluk" ? -1 : 1)).map(gorevGorunumu),
    rozetler: (rozet.data ?? []).map((r) => r.rozet_kod as string),
    envanter: (envanter.data ?? []).map((r) => r.esya_kod as string),
    ozellikler: i.ozellik_puanlari ?? {},
  };
}

/** Rozet kontrolü: metrikleri okur, yeni kazanılanları verir; rozetle gelen eşyayı envantere ekler. */
export async function rozetleriKontrolEt(k: Kullanici): Promise<string[]> {
  const s = servisIstemcisi();
  const [m, sahip] = await Promise.all([
    s.rpc("sistem_oyun_metrikleri", { p_kullanici: k.id }),
    s.from("kullanici_rozet").select("rozet_kod").eq("kullanici_id", k.id),
  ]);
  if (m.error) throw m.error;
  const yeni = yeniRozetler(m.data as OyunMetrikleri, new Set((sahip.data ?? []).map((r) => r.rozet_kod as string)));
  if (yeni.length === 0) return [];
  const { data, error } = await s.rpc("sistem_rozet_ver", { p_kullanici: k.id, p_rozetler: yeni.map((r) => ({ kod: r.kod, altin: r.altin })) });
  if (error) throw error;
  const verilen = (data ?? []) as string[];
  const hediyeler = ESYALAR.filter((e) => e.rozetle && verilen.includes(e.rozetle));
  if (hediyeler.length > 0) {
    await s.from("envanter").upsert(hediyeler.map((e) => ({ kullanici_id: k.id, esya_kod: e.kod, dershane_id: k.dershaneId })), { onConflict: "kullanici_id,esya_kod", ignoreDuplicates: true });
  }
  return verilen;
}

/** Cevaptan sonra: günlük/haftalık görev ilerlemesi ve rozetler. */
export async function cevapSonrasiOyun(
  k: Kullanici,
  olay: Omit<GorevOlayi, "gunlukSoru" | "hedefTamam">,
  gunluk: { gunluk_soru: number; gunluk_hedef: number; hedef_tamam: boolean; seri_gun: number; seri_durum: CevapOyunSonucu["seriDurum"] } | null,
): Promise<CevapOyunSonucu> {
  const tamOlay: GorevOlayi = { ...olay, gunlukSoru: gunluk?.gunluk_soru ?? 0, hedefTamam: Boolean(gunluk?.hedef_tamam) };
  const gorevler = await gorevleriHazirla(k);
  const guncellemeler = gorevler
    .filter((g) => !g.tamamlandi)
    .map((g) => ({ id: g.id, ilerleme: gorevIlerlemesi(g, tamOlay) }))
    .filter((x): x is { id: string; ilerleme: number } => x.ilerleme !== null);
  let tamamlanan: CevapOyunSonucu["tamamlananGorevler"] = [];
  if (guncellemeler.length > 0) {
    const { data, error } = await servisIstemcisi().rpc("sistem_gorev_ilerlet", { p_kullanici: k.id, p_guncellemeler: guncellemeler });
    if (error) throw error;
    tamamlanan = (data ?? []) as CevapOyunSonucu["tamamlananGorevler"];
  }
  const rozetler = await rozetleriKontrolEt(k);
  return {
    gunlukSoru: gunluk?.gunluk_soru ?? 0,
    gunlukHedef: gunluk?.gunluk_hedef ?? OYUN_AYARLARI.seri.gunlukHedefSoru,
    hedefTamam: Boolean(gunluk?.hedef_tamam),
    seriGun: gunluk?.seri_gun ?? 0,
    seriDurum: gunluk?.seri_durum ?? null,
    tamamlananGorevler: tamamlanan,
    yeniRozetler: rozetler,
  };
}

// ── Karakter ve mağaza ──────────────────────────────────────────────

export async function karakterSec(k: Kullanici, tur: string): Promise<void> {
  if (!KARAKTERLER.some((x) => x.tur === tur)) throw new IstemciHatasi("ortak.hata");
  const { error } = await servisIstemcisi()
    .from("karakter")
    .upsert({ kullanici_id: k.id, dershane_id: k.dershaneId, tur }, { onConflict: "kullanici_id" });
  if (error) throw error;
}

export async function satinAl(k: Kullanici, kod: string): Promise<{ altin: number; yeniRozetler: string[] }> {
  const e = esyaBul(kod);
  if (!e || e.rozetle) throw new IstemciHatasi("magaza.satilmaz");
  const i = await ilerlemeSatiri(k);
  if (e.minSeviye && i.seviye < e.minSeviye) throw new IstemciHatasi("magaza.seviyeYetersiz");
  const { data, error } = await servisIstemcisi().rpc("sistem_satin_al", {
    p_kullanici: k.id, p_kod: e.kod, p_fiyat: e.fiyat, p_dondurucu: e.tur === "seri_dondurucu", p_max_dondurucu: OYUN_AYARLARI.altin.seriDondurucuMax,
  });
  if (error) {
    const m = /magaza\.\w+/.exec(error.message)?.[0];
    if (m) throw new IstemciHatasi(m, 409);
    throw error;
  }
  return { altin: data as number, yeniRozetler: await rozetleriKontrolEt(k) };
}

const KUSANILIR = new Set(["kostum", "cerceve", "arka_plan", "duello_efekti", "unvan"]);

/** Kozmetik veya unvan kuşan (null → çıkar). Sahiplik sunucuda doğrulanır. */
export async function kusan(k: Kullanici, tur: string, kod: string | null): Promise<void> {
  if (!KUSANILIR.has(tur)) throw new IstemciHatasi("ortak.hata");
  const s = servisIstemcisi();
  if (kod !== null) {
    if (tur === "unvan") {
      const rozet = ROZETLER.find((r) => r.unvan === kod);
      const { data } = rozet ? await s.from("kullanici_rozet").select("rozet_kod").eq("kullanici_id", k.id).eq("rozet_kod", rozet.kod).maybeSingle() : { data: null };
      if (!data) throw new IstemciHatasi("magaza.sahipDegil", 403);
    } else {
      const e = esyaBul(kod);
      if (!e || e.tur !== tur) throw new IstemciHatasi("ortak.hata");
      const { data } = await s.from("envanter").select("esya_kod").eq("kullanici_id", k.id).eq("esya_kod", kod).maybeSingle();
      if (!data) throw new IstemciHatasi("magaza.sahipDegil", 403);
    }
  }
  const { data: kar } = await s.from("karakter").select("kullanici_id").eq("kullanici_id", k.id).maybeSingle();
  if (!kar) throw new IstemciHatasi("karakter.secilmedi", 409);
  const { error } = await s.from("karakter").update({ [tur]: kod }).eq("kullanici_id", k.id);
  if (error) throw error;
}
