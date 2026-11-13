import "server-only";
import { HAVUZ_AYARLARI, olculmusZorluk, type CevapSonucu } from "@kmy/shared";
import { mufredatGetir } from "./ayarlar";
import { havuzuDoldur, type DoldurmaRaporu } from "./havuz";
import { servisIstemcisi } from "./supabase";

export interface UretimOzeti {
  raporlar: DoldurmaRaporu[];
  dogrulanan: number;
  reddedilen: number;
  atilmaOrani: number;
  ortalamaSoruSuresiMs: number;
  redAsamalari: Record<string, number>;
  sureMs: number;
}

/** (kazanım, bant) çiftlerini eşzamanlılık sınırıyla ve süre bütçesiyle doldurur. */
export async function ciftleriDoldur(
  ciftler: ReadonlyArray<{ kazanimId: string; bant: number; adet: number }>,
  butceMs: number,
  eszamanli = 2,
): Promise<UretimOzeti> {
  const bas = Date.now();
  const raporlar: DoldurmaRaporu[] = [];
  let i = 0;
  const isci = async () => {
    while (i < ciftler.length) {
      const kalan = butceMs - (Date.now() - bas);
      if (kalan < 60_000) break;
      const c = ciftler[i++];
      if (!c) break;
      raporlar.push(await havuzuDoldur(c.kazanimId, c.bant, c.adet, kalan));
    }
  };
  await Promise.all(Array.from({ length: eszamanli }, isci));
  const dogrulanan = raporlar.reduce((t, r) => t + r.dogrulanan, 0);
  const reddedilen = raporlar.reduce((t, r) => t + r.reddedilen, 0);
  const sureler = raporlar.flatMap((r) => r.soruSureleriMs);
  const redAsamalari: Record<string, number> = {};
  for (const r of raporlar) for (const [k, v] of Object.entries(r.nedenler)) redAsamalari[k] = (redAsamalari[k] ?? 0) + v;
  return {
    raporlar,
    dogrulanan,
    reddedilen,
    atilmaOrani: dogrulanan + reddedilen > 0 ? Math.round((reddedilen / (dogrulanan + reddedilen)) * 1000) / 1000 : 0,
    ortalamaSoruSuresiMs: sureler.length ? Math.round(sureler.reduce((a, b) => a + b, 0) / sureler.length) : 0,
    redAsamalari,
    sureMs: Date.now() - bas,
  };
}

/**
 * Cron: havuzu doldur. Son 7 günde çözülen kazanımlarda her bant için en az
 * `aktifHedef`, diğer tüm kazanımların kolay bantlarında (1-2) en az
 * `soğukHedef` doğrulanmış soru olsun. En büyük açıktan başlar.
 */
export async function havuzDoldurIsi(butceMs = 270_000): Promise<UretimOzeti> {
  const { aktifHedef, sogukHedef, cronMaxSoru } = HAVUZ_AYARLARI;
  const s = servisIstemcisi();
  const m = await mufredatGetir();
  const [durum, aktif, paketler] = await Promise.all([
    s.rpc("sistem_havuz_durumu"),
    s.from("cevap").select("kazanim_id").gte("olusturma", new Date(Date.now() - 7 * 86_400_000).toISOString()).limit(10_000),
    // Yalnızca lisansı süren dershanelerin paketlerindeki sınav grupları ön ısıtılır
    s.from("dershane").select("paket:paket_id (sinav_gruplari)").in("lisans_durumu", ["pilot", "aktif"]),
  ]);
  const gruplar = new Set<string>();
  for (const d of (paketler.data ?? []) as unknown as Array<{ paket: { sinav_gruplari: string[] } | null }>) {
    for (const g of d.paket?.sinav_gruplari ?? []) gruplar.add(g);
  }
  const grupta = (sinav: string) => gruplar.has(sinav === "LGS" ? "LGS" : "YKS");
  if (durum.error) throw durum.error;
  const stok = new Map<string, number>();
  for (const r of (durum.data ?? []) as Array<{ kazanim_id: string; zorluk_bandi: number; dogrulanmis: number }>) {
    stok.set(`${r.kazanim_id}:${r.zorluk_bandi}`, Number(r.dogrulanmis));
  }
  const aktifler = new Set((aktif.data ?? []).map((r) => r.kazanim_id as string));
  const ciftler: Array<{ kazanimId: string; bant: number; adet: number; acik: number }> = [];
  for (const kz of m.kazanimlar.values()) {
    const aktifMi = aktifler.has(kz.id);
    if (!aktifMi && !grupta(kz.sinav)) continue;
    for (const bant of [1, 2, 3, 4, 5]) {
      const hedef = aktifMi ? aktifHedef : bant <= 2 ? sogukHedef : 0;
      const acik = hedef - (stok.get(`${kz.id}:${bant}`) ?? 0);
      if (acik > 0) ciftler.push({ kazanimId: kz.id, bant, adet: Math.min(acik, 3), acik: acik + (aktifler.has(kz.id) ? 100 : 0) });
    }
  }
  ciftler.sort((a, b) => b.acik - a.acik);
  // Token tüketim sınırı: bir çalıştırmada en fazla cronMaxSoru soru
  const secilen: typeof ciftler = [];
  let toplam = 0;
  for (const c of ciftler) {
    if (toplam >= cronMaxSoru) break;
    const adet = Math.min(c.adet, cronMaxSoru - toplam);
    secilen.push({ ...c, adet });
    toplam += adet;
  }
  return ciftleriDoldur(secilen, butceMs);
}

/** Cron: 20+ cevaplı soruların gerçek zorluğunu yeniden hesapla; çok hata bildirilenleri akıştan çek. */
export async function kalibrasyonIsi(): Promise<{ kalibre: number; cekilen: number }> {
  const s = servisIstemcisi();
  const { data: sorular, error } = await s
    .from("soru")
    .select("id, cevap_sayisi")
    .eq("durum", "dogrulandi")
    .gte("cevap_sayisi", 20)
    .order("son_gosterim", { ascending: false })
    .limit(400);
  if (error) throw error;
  let kalibre = 0;
  for (const sr of sorular ?? []) {
    const { data: cevaplar } = await s.from("cevap").select("theta_once, dogru_mu, secilen").eq("soru_id", sr.id).limit(2000);
    const veri = (cevaplar ?? [])
      .filter((c) => c.theta_once !== null)
      .map((c) => ({ theta: Number(c.theta_once), sonuc: (c.dogru_mu ? "dogru" : c.secilen ? "yanlis" : "bos") as CevapSonucu }));
    const k = olculmusZorluk(veri);
    if (k) {
      await s.from("soru").update({ olculmus_zorluk: Math.min(10, Math.max(1, k.zorluk)) }).eq("id", sr.id);
      kalibre++;
    }
  }
  // Hata bildirimi oranı eşiği aşan sorular incelemeye kadar akıştan çekilir
  const { data: supheli } = await s
    .from("soru")
    .select("id, hata_bildirim_sayisi, gosterim_sayisi")
    .eq("durum", "dogrulandi")
    .gte("hata_bildirim_sayisi", 3)
    .limit(200);
  let cekilen = 0;
  for (const sr of supheli ?? []) {
    if (sr.hata_bildirim_sayisi / Math.max(1, sr.gosterim_sayisi) >= HAVUZ_AYARLARI.hataOraniEsigi) {
      await s.from("soru").update({ durum: "emekli", red_nedeni: "hata bildirimi eşiği aşıldı; inceleme bekliyor" }).eq("id", sr.id);
      cekilen++;
    }
  }
  return { kalibre, cekilen };
}
