"use server";

import { revalidatePath } from "next/cache";
import type { YetkiKodu } from "@kmy/shared";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { geciciSifre } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

/** Merkez eylemleri: yetki → servis işlemi → denetim kaydı. */
async function m(yetki: YetkiKodu, islem: string, hedef: string, ayrinti: Record<string, unknown>, is: () => Promise<unknown>, yol: string): Promise<KayitSonucu> {
  try {
    const k = await merkezYetkisi(yetki);
    const r = await is();
    await denetle(k, islem, hedef, ayrinti);
    revalidatePath(yol);
    return { tamam: typeof r === "string" && r ? r : "Kaydedildi." };
  } catch (e) { return { hata: e instanceof Error && !e.message.includes(".") ? e.message : hataMetni(e) }; }
}
const ok = async (p: PromiseLike<{ error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Error(r.error.message); };
const v = (f: FormData, k: string, n = 500) => String(f.get(k) ?? "").trim().slice(0, n);

// ── Ekip ──
const MERKEZ_ROLLER = ["merkez_icerik", "merkez_destek", "merkez_satis"];
export async function ekipEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  const ep = v(f, "eposta", 160).toLowerCase(), rol = v(f, "rol", 30);
  return m("merkez.dershane_yonet", "merkez.ekip_ekle", ep, { rol }, async () => {
    if (!MERKEZ_ROLLER.includes(rol) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ep)) throw new Error("Geçerli e-posta ve rol gerekli.");
    const s = servis(), sifre = geciciSifre();
    const { data, error } = await s.auth.admin.createUser({ email: ep, password: sifre, email_confirm: true });
    if (error) throw new Error(/already|registered/i.test(error.message) ? "Bu e-posta ile hesap var." : error.message);
    await ok(s.from("kullanici").insert({ id: data.user.id, tur: "merkez", ad: v(f, "ad", 60) || "Merkez", soyad: v(f, "soyad", 60) || "Ekip", kvkk_onay_tarihi: new Date().toISOString(), sifre_degismeli: true }));
    await ok(s.from("kullanici_rol").insert({ kullanici_id: data.user.id, rol_kod: rol, dershane_id: null }));
    return `Hesap açıldı. Giriş: ${ep} · Geçici şifre: ${sifre} (yalnızca şimdi gösterilir; ilk girişte iki adımlı doğrulama kurulur)`;
  }, "/merkez/ekip");
}
export async function ekipRolKaldir(id: string, rol: string): Promise<KayitSonucu> {
  return m("merkez.dershane_yonet", "merkez.ekip_rol_kaldir", id, { rol }, async () => {
    if (rol === "merkez_sahip") throw new Error("Sahip rolü kaldırılamaz.");
    await ok(servis().from("kullanici_rol").delete().eq("kullanici_id", id).eq("rol_kod", rol).is("dershane_id", null));
  }, "/merkez/ekip");
}

// ── Müfredat ──
export async function kazanimKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  const id = v(f, "id"), kod = v(f, "kod", 30);
  return m("merkez.mufredat_yonet", id ? "mufredat.kazanim_guncelle" : "mufredat.kazanim_ekle", kod || id, {}, async () => {
    const s = servis();
    const onkosul = v(f, "onkosul", 2000).split(/[,\s]+/).filter(Boolean);
    let onIds: string[] = [];
    if (onkosul.length) {
      const { data } = await s.from("kazanim").select("id, kod").in("kod", onkosul);
      if ((data ?? []).length !== onkosul.length) throw new Error("Ön koşul kodlarından biri bulunamadı.");
      onIds = (data ?? []).map((x) => x.id as string);
    }
    let agirlik: Record<string, number> = {};
    try { agirlik = v(f, "agirlik", 1000) ? (JSON.parse(v(f, "agirlik", 1000)) as Record<string, number>) : {}; } catch { throw new Error("Soru tipi ağırlıkları geçerli JSON olmalı, ör. {\"yorum\": 0.4}"); }
    const kayit = { aciklama: v(f, "aciklama", 600), on_kosullar: onIds, soru_tipi_agirliklari: agirlik, panel_duzenleme: true };
    if (kayit.aciklama.length < 5) throw new Error("Açıklama çok kısa.");
    if (id) await ok(s.from("kazanim").update(kayit).eq("id", id));
    else {
      const unite = v(f, "unite");
      const { data: u } = await s.from("unite").select("id, sinif_duzeyi, ders:ders_id(sinav_turu)").eq("id", unite).single();
      if (!u || !/^[A-ZÇĞİÖŞÜ0-9.-]{3,30}$/i.test(kod)) throw new Error("Ünite ve geçerli kazanım kodu gerekli.");
      await ok(s.from("kazanim").insert({ ...kayit, unite_id: unite, kod, sinif_duzeyi: u.sinif_duzeyi, sinav_turu: (u.ders as unknown as { sinav_turu: string }).sinav_turu, sira: 999 }));
    }
  }, "/merkez/mufredat");
}

// ── Ekonomi ──
export async function ekonomiYayinla(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.ekonomi_yonet", "ekonomi.yayinla", "oyun_ayari", {}, async () => {
    let ayar: unknown;
    try { ayar = JSON.parse(v(f, "ayarlar", 20000)); } catch { throw new Error("Ayarlar geçerli JSON olmalı."); }
    if (typeof ayar !== "object" || ayar === null || Array.isArray(ayar)) throw new Error("Ayarlar bir nesne olmalı.");
    const s = servis();
    await ok(s.from("oyun_ayari_surumu").update({ durum: "arsiv" }).eq("durum", "yayinda"));
    await ok(s.from("oyun_ayari_surumu").insert({ ayarlar: ayar, durum: "yayinda", yayin_tarihi: new Date().toISOString() }));
    return "Yeni oyun ayarları yayında (1 dakika içinde tüm uygulamalara yansır).";
  }, "/merkez/ekonomi");
}
export async function esyaAyarla(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  const kod = v(f, "kod", 60);
  return m("merkez.ekonomi_yonet", "ekonomi.esya", kod, {}, async () => {
    const fiyat = v(f, "fiyat") === "" ? null : Number(v(f, "fiyat"));
    await ok(servis().from("esya_ayari").upsert({ kod, fiyat, aktif: f.get("aktif") === "on", yayin_tarihi: v(f, "yayin") ? new Date(`${v(f, "yayin")}T00:00:00+03:00`).toISOString() : null, guncelleme: new Date().toISOString() }));
  }, "/merkez/ekonomi");
}

// ── Takvim ──
export async function takvimEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.ekonomi_yonet", "takvim.ekle", v(f, "ad", 120), {}, async () => {
    const d = f.getAll("dershane").map(String).filter(Boolean);
    await ok(servis().from("platform_etkinlik").insert({
      ad: v(f, "ad", 120), tur: v(f, "tur", 20), baslangic: new Date(`${v(f, "baslangic")}:00+03:00`).toISOString(), bitis: new Date(`${v(f, "bitis")}:00+03:00`).toISOString(),
      dershane_ids: d.length ? d : null, xp_carpan: Number(v(f, "carpan")) || 1, aciklama: v(f, "aciklama", 500) || null,
    }));
  }, "/merkez/takvim");
}
export async function takvimSil(id: string): Promise<KayitSonucu> {
  return m("merkez.ekonomi_yonet", "takvim.sil", id, {}, async () => { await ok(servis().from("platform_etkinlik").delete().eq("id", id)); }, "/merkez/takvim");
}

// ── Moderasyon ──
export async function kelimeEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.moderasyon", "moderasyon.kelime_ekle", v(f, "kelime", 40), {}, async () => {
    const l = v(f, "kelime", 2000).split(/[,\n]+/).map((x) => x.trim().toLocaleLowerCase("tr-TR")).filter((x) => x.length >= 2 && x.length <= 40);
    if (!l.length) throw new Error("Kelime girin.");
    await ok(servis().from("yasakli_kelime").upsert(l.map((kelime) => ({ kelime, dershane_id: v(f, "dershane") || null })), { onConflict: "kelime,dershane_id", ignoreDuplicates: true }));
    return `${l.length} kelime eklendi.`;
  }, "/merkez/moderasyon");
}
export async function kelimeSil(id: number): Promise<KayitSonucu> {
  return m("merkez.moderasyon", "moderasyon.kelime_sil", String(id), {}, async () => { await ok(servis().from("yasakli_kelime").delete().eq("id", id)); }, "/merkez/moderasyon");
}
export async function sikayetKarar(id: string, karar: "incelendi" | "reddedildi"): Promise<KayitSonucu> {
  return m("merkez.moderasyon", "moderasyon.sikayet", id, { karar }, async () => { await ok(servis().from("sikayet").update({ durum: karar }).eq("id", id)); }, "/merkez/moderasyon");
}
export async function kisitla(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  const id = v(f, "kullanici"), gun = Number(v(f, "gun")) || 0, gerekce = v(f, "gerekce", 500);
  return m("merkez.moderasyon", "moderasyon.kisitla", id, { gun, dondur: f.get("dondur") === "on", gerekce }, async () => {
    if (gerekce.length < 5) throw new Error("Gerekçe yazın (kayda geçer).");
    await ok(servis().from("kullanici").update({
      sosyal_kisit_bitis: gun > 0 ? new Date(Date.now() + gun * 86400000).toISOString() : null, puan_donduruldu: f.get("dondur") === "on", kisit_gerekce: gerekce,
    }).eq("id", id).eq("tur", "ogrenci"));
  }, "/merkez/moderasyon");
}

// ── Finans ──
export async function faturaEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.finans", "finans.fatura_ekle", v(f, "dershane"), { donem: v(f, "donem") }, async () => {
    await ok(servis().from("fatura").insert({ dershane_id: v(f, "dershane"), donem: v(f, "donem", 7), tutar: Number(v(f, "tutar")), vade: v(f, "vade", 10), aciklama: v(f, "aciklama", 300) || null }));
  }, "/merkez/finans");
}
export async function faturaOdendi(id: string): Promise<KayitSonucu> {
  return m("merkez.finans", "finans.odendi", id, {}, async () => {
    const s = servis();
    const { data: r, error } = await s.from("fatura").update({ durum: "odendi", odeme_tarihi: new Date().toISOString().slice(0, 10) }).eq("id", id).select("dershane_id").single();
    if (error) throw new Error(error.message);
    // Gecikmiş/askıdaki dershane, başka gecikmiş faturası yoksa aktife döner
    const { count } = await s.from("fatura").select("id", { count: "exact", head: true }).eq("dershane_id", (r?.dershane_id as string) ?? "").eq("durum", "bekliyor").lt("vade", new Date().toISOString().slice(0, 10));
    if (r && !count) await s.from("dershane").update({ lisans_durumu: "aktif" }).eq("id", r.dershane_id as string).in("lisans_durumu", ["gecikmis", "askida"]);
  }, "/merkez/finans");
}
export async function ucretAyarla(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.finans", "finans.ucret", v(f, "dershane"), { ucret: v(f, "ucret") }, async () => {
    await ok(servis().from("dershane").update({ aylik_ucret: v(f, "ucret") === "" ? null : Number(v(f, "ucret")) }).eq("id", v(f, "dershane")));
  }, "/merkez/finans");
}

// ── Destek ──
export async function destekYanit(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  const id = v(f, "talep");
  return m("merkez.destek", "destek.yanit", id, {}, async () => {
    const s = servis();
    const k = await merkezYetkisi("merkez.destek");
    if (v(f, "metin", 4000)) await ok(s.from("destek_mesaj").insert({ talep_id: id, yazan_id: k, merkez: true, metin: v(f, "metin", 4000) }));
    const durum = v(f, "durum", 20) || "yanitlandi";
    const { data: t } = await s.from("destek_talep").select("ilk_yanit").eq("id", id).single();
    await ok(s.from("destek_talep").update({ durum, atanan_id: k, ilk_yanit: t?.ilk_yanit ?? new Date().toISOString(), guncelleme: new Date().toISOString() }).eq("id", id));
  }, `/merkez/destek/${id}`);
}

// ── Duyuru, şablon, sistem ──
export async function merkezDuyuru(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.destek", "duyuru.ekle", v(f, "baslik", 120), {}, async () => {
    const d = f.getAll("dershane").map(String).filter(Boolean);
    await ok(servis().from("merkez_duyuru").insert({ baslik: v(f, "baslik", 120), metin: v(f, "metin", 2000), dershane_ids: d.length ? d : null, bitis: v(f, "bitis") ? new Date(`${v(f, "bitis")}T23:59:00+03:00`).toISOString() : null }));
  }, "/merkez/duyuru");
}
export async function sablonKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.destek", "sablon.guncelle", v(f, "kod", 40), {}, async () => {
    await ok(servis().from("eposta_sablon").update({ konu: v(f, "konu", 200), govde: v(f, "govde", 5000), guncelleme: new Date().toISOString() }).eq("kod", v(f, "kod", 40)));
  }, "/merkez/duyuru");
}
export async function sistemKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.sistem", "sistem.ayar", "uygulama_ayari", {}, async () => {
    if (!/^\d+\.\d+\.\d+$/.test(v(f, "min_surum", 20))) throw new Error("Sürüm biçimi 1.0.0 olmalı.");
    await ok(servis().from("uygulama_ayari").update({ min_surum: v(f, "min_surum", 20), bakim_modu: f.get("bakim") === "on", bakim_mesaji: v(f, "bakim_mesaji", 300) || null, duyuru: v(f, "duyuru", 300) || null, guncelleme: new Date().toISOString() }).eq("id", true));
  }, "/merkez/sistem");
}
export async function modelFiyat(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.ai_yonet", "ai.model_fiyat", v(f, "model", 80), {}, async () => {
    await ok(servis().from("model_fiyat").upsert({ model: v(f, "model", 80), giris_1m: Number(v(f, "giris")) || 0, cikis_1m: Number(v(f, "cikis")) || 0, guncelleme: new Date().toISOString() }));
  }, "/merkez/sistem");
}

// ── Paketler ──
export async function paketKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.dershane_yonet", "paket.kaydet", v(f, "kod", 30), {}, async () => {
    const ozellikler: Record<string, boolean> = {};
    for (const k of f.getAll("ozellik").map(String)) ozellikler[k] = true;
    for (const k of f.getAll("kapali").map(String)) ozellikler[k] = false;
    const kayit = { ad: v(f, "ad", 60), ozellikler, ai_kotasi_token: Number(v(f, "kota")) || 0, ogrenci_basi_fiyat: v(f, "fiyat") === "" ? null : Number(v(f, "fiyat")) };
    const id = v(f, "id");
    if (id) await ok(servis().from("paket").update(kayit).eq("id", id));
    else await ok(servis().from("paket").insert({ ...kayit, kod: v(f, "kod", 30) }));
  }, "/merkez/paketler");
}
export async function dershanePaket(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  return m("merkez.dershane_yonet", "dershane.paket", v(f, "dershane"), { paket: v(f, "paket") }, async () => {
    await ok(servis().from("dershane").update({ paket_id: v(f, "paket") }).eq("id", v(f, "dershane")));
  }, "/merkez/paketler");
}
