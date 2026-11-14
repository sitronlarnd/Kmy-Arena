import { NextResponse } from "next/server";
import { ortam } from "@/lib/ortam";
import { havuzDoldurIsi, kalibrasyonIsi } from "@/lib/isler";
import { OYUN_AYARLARI } from "@kmy/shared";
import { bugunIst, haftaBasi } from "@/lib/oyun-servisi";
import { aiBekleyenleriIsle } from "@/lib/topluluk-servisi";
import { servisIstemcisi } from "@/lib/supabase";
import { bildirimleriGonder, veliHaftalikGonder } from "@/lib/bildirim";
import { turnuvaMaclariniHazirla } from "@/lib/duello-servisi";
import { epostaGonder } from "@/lib/eposta";
import { sablon } from "@/lib/sablon";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Is = () => Promise<Record<string, unknown>>;

/**
 * Arka plan işleri (Vercel Cron). Yeni işler fazlarla eklenir:
 *  Faz 1: havuz-doldur (soru üretim + doğrulama), kalibrasyon
 *  Faz 2: lig-hafta-sonu, sezon-sonu
 *  Faz 6: veli-raporu, risk-skoru, planli-raporlar
 *  Faz 7: pilot-raporu (30 gün sonunda dershaneye otomatik etki raporu)
 */
const ISLER: Record<string, Is> = {
  "bildirim-gonder": async () => ({ turnuva: await turnuvaMaclariniHazirla().catch((e: unknown) => ({ hata: String(e) })), ...(await bildirimleriGonder()) }),
  "seri-hatirlat": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_seri_hatirlat");
    if (error) throw error;
    return { kuyruga: data, ...(await bildirimleriGonder()) };
  },
  "veli-haftalik": async () => veliHaftalikGonder(),
  "lisans-takip": async () => {
    const s = servisIstemcisi();
    const { data, error } = await s.rpc("sistem_lisans_takip");
    if (error) throw error;
    // Kuruculara: vadesi 15 günü geçen fatura ve 14 gün içinde biten lisans uyarısı
    let gonderilen = 0;
    const bugun = new Date().toISOString().slice(0, 10);
    const on4 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const on5 = new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10);
    const { data: gec } = await s.from("fatura").select("dershane_id, donem, tutar, vade, dershane:dershane_id(ad)").eq("durum", "bekliyor").eq("vade", on5);
    const { data: biten } = await s.from("dershane").select("id, ad, lisans_bitis").eq("lisans_bitis", on4).in("lisans_durumu", ["aktif", "pilot"]);
    const kurucular = async (d: string) => {
      const { data: r } = await s.from("kullanici_rol").select("kullanici_id").eq("dershane_id", d).eq("rol_kod", "kurucu");
      const l: string[] = [];
      for (const x of r ?? []) { const { data: u } = await s.auth.admin.getUserById(x.kullanici_id as string); if (u.user?.email) l.push(u.user.email); }
      return l;
    };
    for (const f of (gec ?? []) as unknown as { dershane_id: string; donem: string; tutar: number; vade: string; dershane: { ad: string } | null }[]) {
      const t = await sablon("odeme_gecikti", { dershane: f.dershane?.ad ?? "", donem: f.donem, tutar: f.tutar, vade: f.vade }, { konu: "KMY Arena ödemesi gecikti", govde: "Faturanızın vadesi geçti." });
      for (const e of await kurucular(f.dershane_id)) if (await epostaGonder(e, t.konu, t.govde)) gonderilen++;
    }
    for (const d of biten ?? []) {
      const t = await sablon("lisans_bitiyor", { dershane: d.ad as string, gun: 14, tarih: d.lisans_bitis as string }, { konu: "KMY Arena lisansınız bitiyor", govde: "Lisansınız 14 gün sonra bitiyor." });
      for (const e of await kurucular(d.id as string)) if (await epostaGonder(e, t.konu, t.govde)) gonderilen++;
    }
    return { ...(data as object), eposta: gonderilen, bugun };
  },
  "cevap-bolumu": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_cevap_bolumu_olustur");
    if (error) throw error;
    return { bolum: data };
  },
  "havuz-doldur": async () => {
    const o = await havuzDoldurIsi(270_000);
    return { dogrulanan: o.dogrulanan, reddedilen: o.reddedilen, atilmaOrani: o.atilmaOrani, ciftSayisi: o.raporlar.length, sureMs: o.sureMs };
  },
  kalibrasyon: async () => kalibrasyonIsi(),
  // Pazartesi 00:10 (İstanbul): geçen haftanın lig gruplarını kapat, yükselme/düşme, sezon sonu ödülü
  "lig-kapat": async () => {
    const buHafta = haftaBasi(bugunIst());
    const gecen = new Date(`${buHafta}T00:00:00Z`);
    gecen.setUTCDate(gecen.getUTCDate() - 7);
    const { data, error } = await servisIstemcisi().rpc("sistem_lig_kapat", { p_hafta: gecen.toISOString().slice(0, 10) });
    if (error) throw error;
    return data as Record<string, unknown>;
  },
  // Perşembe 09:00 (İstanbul): klan savaşı eşleştirme (savaş Cuma 18:00 – Pazar 21:00) + liderlik devri
  "klan-savas-esle": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_esle", {
      p_hafta: haftaBasi(bugunIst()), p_min_uye: OYUN_AYARLARI.klan.savasMinUye, p_hemen: false, p_dershane: null,
    });
    if (error) throw error;
    return { eslesen: data };
  },
  // Her 5 dk: cevapsız topluluk sorularına ipucu (15 dk), çözümsüzlere tam çözüm (2 sa)
  "topluluk-ai": async () => aiBekleyenleriIsle(),
  // Her gece: asistan sohbetleri 180 günden eskiyse silinir
  "asistan-temizle": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_asistan_temizle");
    if (error) throw error;
    return { silinen: data };
  },
  // Her gece: silme talebinin üzerinden 30 gün geçen hesaplar kalıcı silinir (auth → kullanıcı → bağlı veriler)
  "hesap-sil": async () => {
    const s = servisIstemcisi();
    const sinir = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data } = await s.from("kullanici").select("id").lt("silinme_talebi", sinir).limit(50);
    let silinen = 0;
    for (const k of data ?? []) {
      const { error } = await s.auth.admin.deleteUser(k.id as string);
      if (!error) silinen++;
    }
    return { silinen };
  },
  // Elle (demo/pilot): savaşı hemen başlat (bitiş yine Pazar 21:00), en az 2 üyeli klanlar
  "klan-savas-hemen": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_esle", {
      p_hafta: haftaBasi(bugunIst()), p_min_uye: 2, p_hemen: true, p_dershane: null,
    });
    if (error) throw error;
    return { eslesen: data };
  },
  // Pazar 21:05 (İstanbul): savaşları kapat, ödülleri ver
  "klan-savas-kapat": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_kapat", { p_kupa: OYUN_AYARLARI.klan.savasKupa, p_hepsi: false });
    if (error) throw error;
    return { kapanan: data };
  },
};

export async function GET(istek: Request, baglam: { params: Promise<{ is: string }> }): Promise<NextResponse> {
  const { is: ad } = await baglam.params;
  const gizli = ortam().CRON_SECRET;
  // Vercel Cron, CRON_SECRET tanımlıysa Authorization: Bearer <CRON_SECRET> gönderir.
  if (!gizli || istek.headers.get("authorization") !== `Bearer ${gizli}`) {
    return NextResponse.json({ hata: "yetkisiz" }, { status: 401 });
  }
  const calistir = ISLER[ad];
  if (!calistir) return NextResponse.json({ hata: "bilinmeyen iş" }, { status: 404 });
  try {
    return NextResponse.json({ is: ad, sonuc: await calistir() });
  } catch (hata) {
    console.error(`cron ${ad} başarısız`, hata);
    return NextResponse.json({ is: ad, hata: hata instanceof Error ? hata.message : "bilinmiyor" }, { status: 500 });
  }
}
