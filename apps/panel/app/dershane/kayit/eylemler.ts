"use server";

import { revalidatePath } from "next/cache";
import { yetkiIste, hesapAc, sifreSifirla, eposta, hosGeldinMetni, type AcilanHesap } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";
import { tabloOku } from "@/lib/tablo-oku";

export interface KayitSonucu { tamam?: string; hata?: string; hesaplar?: AcilanHesap[]; kodlar?: { ad: string; soyad: string; kod: string }[]; hatalar?: string[] }

const metin = (f: FormData, k: string, max = 80) => String(f.get(k) ?? "").trim().slice(0, max);
const yil = (x: string) => { const n = Number(x); return Number.isInteger(n) && n >= 1990 && n <= 2025 ? n : null; };

async function sinifBilgisi(sinifId: string): Promise<{ id: string; sube_id: string; dershane_id: string } | null> {
  const { data } = await servis().from("sinif").select("id, sube_id, dershane_id").eq("id", sinifId).maybeSingle();
  return data;
}

// ── Şube ve sınıflar (RLS: sube.yonet / sinif.yonet) ──

export async function subeKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("sube.yonet");
    const ad = metin(f, "ad"), sehir = metin(f, "sehir", 60) || null, id = metin(f, "id");
    if (ad.length < 2) return { hata: "Şube adı gerekli." };
    const s = await sunucuIstemcisi();
    const { error } = id
      ? await s.from("sube").update({ ad, sehir }).eq("id", id)
      : await s.from("sube").insert({ dershane_id: k.dershaneId, ad, sehir });
    if (error) return { hata: error.code === "23505" ? "Bu adla bir şube zaten var." : hataMetni(error) };
    revalidatePath("/dershane/yapi");
    return { tamam: id ? "Şube güncellendi." : "Şube eklendi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function sinifKaydet(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const sube = metin(f, "sube");
    const k = await yetkiIste("sinif.yonet", sube || null);
    const ad = metin(f, "ad", 40), sinav = metin(f, "sinav", 4), seviye = Number(f.get("seviye")), alan = metin(f, "alan", 4) || null, id = metin(f, "id");
    if (ad.length < 1 || !sube || !["LGS", "TYT", "AYT", "YDT"].includes(sinav) || !(seviye >= 5 && seviye <= 13)) return { hata: "Sınıf bilgilerini kontrol edin." };
    const kayit = { ad, sube_id: sube, sinav_turu: sinav, seviye, yks_alani: sinav === "LGS" ? null : alan };
    const s = await sunucuIstemcisi();
    const { error } = id ? await s.from("sinif").update(kayit).eq("id", id) : await s.from("sinif").insert({ ...kayit, dershane_id: k.dershaneId });
    if (error) return { hata: error.code === "23505" ? "Bu şubede aynı adlı sınıf var." : hataMetni(error) };
    revalidatePath("/dershane/yapi");
    return { tamam: id ? "Sınıf güncellendi." : "Sınıf eklendi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function sinifArsiv(id: string, arsiv: boolean): Promise<KayitSonucu> {
  try {
    const b = await sinifBilgisi(id);
    if (!b) return { hata: hataMetni(new Error("panel.bulunamadi")) };
    await yetkiIste("sinif.yonet", b.sube_id);
    const s = await sunucuIstemcisi();
    if (!arsiv) {
      const { error } = await s.from("sinif").update({ arsiv: false }).eq("id", id);
      if (error) throw error;
    } else {
      const { count } = await servis().from("sinif_uyelik").select("id", { count: "exact", head: true }).eq("sinif_id", id).eq("rol", "ogrenci");
      const { error } = count ? await s.from("sinif").update({ arsiv: true }).eq("id", id) : await s.from("sinif").delete().eq("id", id);
      if (error) throw error;
    }
    revalidatePath("/dershane/yapi");
    return { tamam: arsiv ? "Sınıf arşivlendi / silindi." : "Sınıf arşivden çıkarıldı." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

// ── Davet kodları ──

export async function davetOlustur(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const rol = metin(f, "rol", 30);
    const { data, error } = await s.rpc("panel_davet_olustur", {
      p_rol: rol, p_sube: metin(f, "sube") || null, p_sinif: metin(f, "sinif") || null,
      p_max: Number(f.get("max")) || 1, p_gun: Number(f.get("gun")) || 30, p_ogrenci: null,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dershane/kayit");
    return { tamam: `Davet kodu: ${String(data)}` };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function davetPasif(kod: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.from("davet_kodu").update({ aktif: false }).eq("kod", kod);
    if (error) throw error;
    revalidatePath("/dershane/kayit");
    return { tamam: "Kod kapatıldı." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

// ── Öğrenci hesapları ──

export async function ogrenciEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const sinif = await sinifBilgisi(metin(f, "sinif"));
    if (!sinif) return { hata: "Sınıf seçin." };
    const k = await yetkiIste("ogrenci.ekle", sinif.sube_id);
    if (sinif.dershane_id !== k.dershaneId) return { hata: hataMetni(new Error("panel.yetkisiz")) };
    const ad = metin(f, "ad"), soyad = metin(f, "soyad");
    if (!ad || !soyad) return { hata: "Ad ve soyad gerekli." };
    const h = await hesapAc({ ad, soyad, rol: "ogrenci", dershaneId: k.dershaneId, subeId: sinif.sube_id, sinifId: sinif.id, dogumYili: yil(metin(f, "dogum")), eposta: metin(f, "eposta", 160) || null });
    revalidatePath("/dershane/ogrenciler");
    return { tamam: "Öğrenci hesabı açıldı.", hesaplar: [h] };
  } catch (e) { return { hata: hataMetni(e) }; }
}

/** Excel/CSV ile toplu öğrenci: Ad, Soyad, Sınıf, (Şube), (Doğum yılı), (E-posta). */
export async function topluYukle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const dosya = f.get("dosya");
    if (!(dosya instanceof File) || dosya.size === 0) return { hata: "Dosya seçin." };
    if (dosya.size > 2_000_000) return { hata: "Dosya en fazla 2 MB olabilir." };
    const k = await yetkiIste("ogrenci.ekle");
    const satirlar = (await tabloOku(dosya)).filter((r) => r.ad || r.soyad);
    if (satirlar.length === 0) return { hata: hataMetni(new Error("panel.dosyaGecersiz")) };
    if (satirlar.length > 500) return { hata: "Tek seferde en fazla 500 öğrenci yüklenebilir." };
    const { data: siniflar } = await servis().from("sinif").select("id, ad, sube_id, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false);
    const l = (siniflar ?? []) as unknown as { id: string; ad: string; sube_id: string; sube: { ad: string } | null }[];
    const norm = (x: string) => x.toLocaleLowerCase("tr-TR").replace(/[\s\-/]/g, "");
    const hesaplar: AcilanHesap[] = [], hatalar: string[] = [];
    for (const [i, r] of satirlar.entries()) {
      const sat = `Satır ${i + 2}`;
      const ad = (r.ad ?? "").slice(0, 60), soyad = (r.soyad ?? "").slice(0, 60);
      const sinifAdi = r.sinif ?? r.grup ?? "", subeAdi = r.sube ?? "";
      if (!ad || !soyad || !sinifAdi) { hatalar.push(`${sat}: ad, soyad ve sınıf gerekli`); continue; }
      const adaylar = l.filter((s) => norm(s.ad) === norm(sinifAdi) && (!subeAdi || norm(s.sube?.ad ?? "") === norm(subeAdi)));
      if (adaylar.length !== 1) { hatalar.push(`${sat} (${ad} ${soyad}): "${sinifAdi}" sınıfı ${adaylar.length ? "birden fazla şubede var, Şube sütununu doldurun" : "bulunamadı"}`); continue; }
      const sinif = adaylar[0];
      if (!sinif) continue;
      try {
        await yetkiIste("ogrenci.ekle", sinif.sube_id);
        const h = await hesapAc({ ad, soyad, rol: "ogrenci", dershaneId: k.dershaneId, subeId: sinif.sube_id, sinifId: sinif.id, dogumYili: yil(r.dogumyili ?? r.dogum ?? ""), eposta: (r.eposta ?? r.email ?? "") || null });
        const no = (r.ogrencino ?? r.numara ?? r.no ?? "").trim().slice(0, 20);
        if (no) await servis().from("kullanici").update({ ogrenci_no: no }).eq("id", h.id);
        hesaplar.push(h);
      } catch (e) {
        hatalar.push(`${sat} (${ad} ${soyad}): ${hataMetni(e)}`);
        if (e instanceof Error && e.message.includes("lisansDolu")) break;
      }
    }
    revalidatePath("/dershane/ogrenciler");
    return { tamam: `${hesaplar.length} öğrenci hesabı açıldı${hatalar.length ? `, ${hatalar.length} satır atlandı` : ""}.`, hesaplar, hatalar };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function sinifDegistir(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const ogrenci = metin(f, "ogrenci"); const yeni = await sinifBilgisi(metin(f, "sinif"));
    if (!yeni) return { hata: "Sınıf seçin." };
    await yetkiIste("ogrenci.ekle", yeni.sube_id);
    const s = await sunucuIstemcisi();
    const { error: e1 } = await s.from("sinif_uyelik").delete().eq("kullanici_id", ogrenci).eq("rol", "ogrenci");
    if (e1) throw e1;
    const { error: e2 } = await s.from("sinif_uyelik").insert({ dershane_id: yeni.dershane_id, sinif_id: yeni.id, kullanici_id: ogrenci, rol: "ogrenci" });
    if (e2) throw e2;
    await servis().from("kullanici").update({ sube_id: yeni.sube_id }).eq("id", ogrenci).eq("dershane_id", yeni.dershane_id);
    revalidatePath(`/dershane/ogrenci/${ogrenci}`);
    return { tamam: "Sınıf değiştirildi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

async function dershaneOgrencisi(id: string, yetki: string) {
  const { data } = await servis().from("kullanici").select("id, ad, soyad, dershane_id, sube_id, tur").eq("id", id).maybeSingle();
  if (!data) throw new Error("panel.bulunamadi");
  const k = await yetkiIste(yetki, data.sube_id as string | null);
  if (data.dershane_id !== k.dershaneId) throw new Error("panel.yetkisiz");
  return { ...data, k };
}

export async function sifreYenile(id: string): Promise<KayitSonucu> {
  try {
    const o = await dershaneOgrencisi(id, "ogrenci.ekle");
    const { data: u } = await servis().auth.admin.getUserById(id);
    const sifre = await sifreSifirla(id);
    const em = u.user?.email ?? "";
    return { tamam: "Yeni geçici şifre üretildi.", hesaplar: [{ id, ad: o.ad as string, soyad: o.soyad as string, giris: em.replace(/@ogrenci\.kmyarena\.app$/, ""), sifre, takma: null }] };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function hesapKapat(id: string): Promise<KayitSonucu> {
  try {
    const o = await dershaneOgrencisi(id, "ogrenci.ekle");
    await servis().from("kullanici").update({ silinme_talebi: new Date().toISOString() }).eq("id", id);
    await servis().from("denetim_log").insert({ dershane_id: o.dershane_id, kullanici_id: o.k.kullaniciId, islem: "hesap.kapatildi", hedef: id });
    revalidatePath("/dershane/ogrenciler");
    return { tamam: "Hesap kapatıldı; 30 gün sonra kalıcı olarak silinir." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function hesapAc2(id: string): Promise<KayitSonucu> {
  try {
    const o = await dershaneOgrencisi(id, "ogrenci.ekle");
    await servis().from("kullanici").update({ silinme_talebi: null }).eq("id", id);
    await servis().from("denetim_log").insert({ dershane_id: o.dershane_id, kullanici_id: o.k.kullaniciId, islem: "hesap.geri_acildi", hedef: id });
    revalidatePath(`/dershane/ogrenci/${id}`);
    return { tamam: "Hesap yeniden açıldı." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

// ── Veliler ──

export async function veliKodu(ogrenci: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { data, error } = await s.rpc("panel_davet_olustur", { p_rol: "veli", p_ogrenci: ogrenci, p_gun: 60 });
    if (error) throw new Error(error.message);
    return { tamam: `Veli kodu: ${String(data)} (60 gün geçerli)` };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function veliKodlari(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { data, error } = await s.rpc("panel_veli_kodlari", { p_sinif: metin(f, "sinif") });
    if (error) throw new Error(error.message);
    const kodlar = (data ?? []) as { ad: string; soyad: string; kod: string }[];
    return { tamam: kodlar.length ? `${kodlar.length} öğrenci için veli kodu hazır.` : "Bu sınıfta velisi bağlanmamış öğrenci yok.", kodlar };
  } catch (e) { return { hata: hataMetni(e) }; }
}

// ── Personel ──

const PERSONEL_ROLLERI: Record<string, string> = { ogretmen: "Öğretmen", rehber_ogretmen: "Rehber öğretmen", sube_muduru: "Şube müdürü", sekreter: "Sekreter / kayıt", kurucu: "Kurucu ortak" };

export async function personelEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const rol = metin(f, "rol", 30), sube = metin(f, "sube") || null;
    if (!PERSONEL_ROLLERI[rol]) return { hata: "Rol seçin." };
    if ((rol === "sube_muduru" || rol === "sekreter") && !sube) return { hata: "Bu rol için şube seçin." };
    let k;
    try { k = await yetkiIste(rol === "ogretmen" ? "ogretmen.yonet" : "dershane.rol_ata"); }
    catch { k = await yetkiIste("dershane.rol_ata"); }
    const ad = metin(f, "ad"), soyad = metin(f, "soyad"), ep = metin(f, "eposta", 160).toLowerCase();
    if (!ad || !soyad || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ep)) return { hata: "Ad, soyad ve geçerli e-posta gerekli." };
    const h = await hesapAc({ ad, soyad, rol, dershaneId: k.dershaneId, subeId: sube, sinifId: null, eposta: ep });
    const { data: d } = await servis().from("dershane").select("ad").eq("id", k.dershaneId).single();
    const gitti = await eposta(ep, "KMY Arena hesabınız açıldı", hosGeldinMetni(ad, ep, h.sifre, PERSONEL_ROLLERI[rol] ?? rol, (d?.ad as string) ?? ""));
    revalidatePath("/dershane/ekip");
    return { tamam: `${PERSONEL_ROLLERI[rol]} hesabı açıldı${gitti ? " ve giriş bilgileri e-postayla gönderildi" : ""}.`, hesaplar: [h] };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function rolDegistir(kullanici: string, rol: string, ekle: boolean, sube: string | null): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("dershane.rol_ata");
    const s = await sunucuIstemcisi();
    if (ekle) {
      const { error } = await s.from("kullanici_rol").insert({ kullanici_id: kullanici, rol_kod: rol, dershane_id: k.dershaneId, sube_id: sube });
      if (error && error.code !== "23505") throw error;
    } else {
      if (kullanici === k.kullaniciId && rol === "kurucu") return { hata: "Kendi kurucu rolünüzü kaldıramazsınız." };
      const { error } = await s.from("kullanici_rol").delete().eq("kullanici_id", kullanici).eq("rol_kod", rol).eq("dershane_id", k.dershaneId);
      if (error) throw error;
    }
    revalidatePath("/dershane/ekip");
    return { tamam: "Rol güncellendi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

/** Rol yetki matrisini dershaneye özel ince ayar (ilk değişiklikte varsayılan matris kopyalanır). */
export async function yetkiAyarla(rol: string, yetki: string, acik: boolean): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("dershane.rol_ata");
    if (rol === "kurucu" && yetki === "dershane.rol_ata" && !acik) return { hata: "Kurucunun rol atama yetkisi kapatılamaz." };
    const s = await sunucuIstemcisi();
    const { count } = await s.from("rol_yetki").select("id", { count: "exact", head: true }).eq("dershane_id", k.dershaneId).eq("rol_kod", rol);
    if (!count) {
      const { data: v } = await s.from("rol_yetki").select("yetki_kod").is("dershane_id", null).eq("rol_kod", rol);
      const kopya = (v ?? []).map((x) => ({ dershane_id: k.dershaneId, rol_kod: rol, yetki_kod: x.yetki_kod as string }));
      if (kopya.length) { const { error } = await s.from("rol_yetki").insert(kopya); if (error) throw error; }
    }
    const { error } = acik
      ? await s.from("rol_yetki").upsert({ dershane_id: k.dershaneId, rol_kod: rol, yetki_kod: yetki }, { onConflict: "dershane_id,rol_kod,yetki_kod", ignoreDuplicates: true })
      : await s.from("rol_yetki").delete().eq("dershane_id", k.dershaneId).eq("rol_kod", rol).eq("yetki_kod", yetki);
    if (error) throw error;
    revalidatePath("/dershane/ekip");
    return { tamam: "Yetki güncellendi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function ogretmenAta(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const ogretmen = metin(f, "ogretmen"); const sinif = await sinifBilgisi(metin(f, "sinif"));
    if (!sinif) return { hata: "Sınıf seçin." };
    try { await yetkiIste("ogretmen.yonet"); } catch { await yetkiIste("dershane.rol_ata"); }
    const dersler = f.getAll("ders").map(String).filter(Boolean);
    // Öğretmen ataması ogrenci.ekle RLS'ine takılmasın diye servis ile (yetki yukarıda denetlendi)
    const { data: o } = await servis().from("kullanici").select("dershane_id").eq("id", ogretmen).maybeSingle();
    if (o?.dershane_id !== sinif.dershane_id) return { hata: hataMetni(new Error("panel.yetkisiz")) };
    const { error } = await servis().from("sinif_uyelik").upsert(
      { dershane_id: sinif.dershane_id, sinif_id: sinif.id, kullanici_id: ogretmen, rol: "ogretmen", ders_ids: dersler.length ? dersler : null },
      { onConflict: "sinif_id,kullanici_id" });
    if (error) throw error;
    revalidatePath("/dershane/ekip");
    return { tamam: "Atama kaydedildi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function atamaKaldir(ogretmen: string, sinifId: string): Promise<KayitSonucu> {
  try {
    const sinif = await sinifBilgisi(sinifId);
    if (!sinif) return { hata: hataMetni(new Error("panel.bulunamadi")) };
    const k = await yetkiIste("ogretmen.yonet").catch(() => yetkiIste("dershane.rol_ata"));
    if (k.dershaneId !== sinif.dershane_id) return { hata: hataMetni(new Error("panel.yetkisiz")) };
    await servis().from("sinif_uyelik").delete().eq("sinif_id", sinifId).eq("kullanici_id", ogretmen).eq("rol", "ogretmen");
    revalidatePath("/dershane/ekip");
    return { tamam: "Atama kaldırıldı." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
