import "server-only";
import { dogruSikSec, soruTipiSec, soruUret, type HatSonucu, type UretimIstegi } from "@kmy/ai";
import { HAVUZ_AYARLARI, sinirla, type Sik } from "@kmy/shared";
import { aiAyarlari, mufredatGetir, type MufredatKazanimi } from "./ayarlar";
import { kmyai, kmyaiErisilebilir } from "./kmyai";
import { servisIstemcisi } from "./supabase";

export interface DoldurmaRaporu {
  kazanimKodu: string;
  bant: number;
  istenen: number;
  dogrulanan: number;
  reddedilen: number;
  atlandi?: string;
  nedenler: Record<string, number>;
  ornekRedler: string[];
  sureMs: number;
  soruSureleriMs: number[];
}

/** Bandın zorluk aralığı: 1 → 1-2, 2 → 3-4, … */
function banttanZorluk(bant: number, i: number): number {
  return sinirla(bant * 2 - 1 + (i % 2), 1, 10);
}

async function harfSayaclari(kazanimId: string): Promise<Partial<Record<Sik, number>>> {
  const { data } = await servisIstemcisi().from("soru").select("dogru").eq("kazanim_id", kazanimId).eq("durum", "dogrulandi").limit(1000);
  const sayac: Partial<Record<Sik, number>> = {};
  for (const r of data ?? []) sayac[r.dogru as Sik] = (sayac[r.dogru as Sik] ?? 0) + 1;
  return sayac;
}

async function oncekiOzetler(kazanimId: string): Promise<string[]> {
  const { data } = await servisIstemcisi()
    .from("soru")
    .select("govde_md")
    .eq("kazanim_id", kazanimId)
    .eq("durum", "dogrulandi")
    .order("olusturma", { ascending: false })
    .limit(12);
  return (data ?? []).map((r) => String(r.govde_md).replace(/\s+/g, " ").slice(0, 110));
}

async function kaydet(k: MufredatKazanimi, r: HatSonucu, promptSurumu: string): Promise<void> {
  if (!r.soru) return;
  const s = r.soru;
  const { error } = await servisIstemcisi().from("soru").insert({
    kaynak: "ai",
    kazanim_id: k.id,
    sinav_turu: k.sinav,
    soru_tipi: s.soruTipi,
    zorluk: sinirla(s.zorluk, 1, 10),
    tahmini_sure_sn: sinirla(s.tahminiSureSn, 10, 400),
    govde_md: s.govdeMd,
    gorsel: null,
    siklar: s.siklar,
    dogru: s.dogru,
    cozum_adimlari: s.cozumAdimlari,
    celdirici_notlari: s.celdiriciNotlari,
    ipuclari: s.ipuclari.slice(0, 3),
    prompt_surumu: promptSurumu,
    uretici_model: r.uretimModeli,
    dogrulayici_model: r.dogrulayiciModeli,
    durum: r.durum,
    red_nedeni: r.durum === "reddedildi" ? `${r.asama}: ${r.redNedeni}`.slice(0, 1000) : null,
  });
  if (error) console.error("soru kaydedilemedi", error.message);
}

/**
 * Bir (kazanım, bant) için `adet` doğrulanmış soru hedefiyle üretir.
 * Aynı anda tek üretici (veritabanı kilidi). Eşzamanlılık: 2 soru paralel
 * (KMYAI hız sınırı; ayrıca örnek başına toplam 4 istek sınırı var).
 * `butceMs` dolunca yeni soru başlatmaz.
 */
export async function havuzuDoldur(kazanimId: string, bant: number, adet: number, butceMs = 240_000): Promise<DoldurmaRaporu> {
  const bas = Date.now();
  const m = await mufredatGetir();
  const k = m.kazanimlar.get(kazanimId);
  const rapor: DoldurmaRaporu = {
    kazanimKodu: k?.kod ?? kazanimId, bant, istenen: adet, dogrulanan: 0, reddedilen: 0, nedenler: {}, ornekRedler: [], sureMs: 0, soruSureleriMs: [],
  };
  const bitir = (atlandi?: string) => ({ ...rapor, ...(atlandi ? { atlandi } : {}), sureMs: Date.now() - bas });
  if (!k) return bitir("kazanım yok");
  const ayar = await aiAyarlari();
  if (ayar.yedekMod) return bitir("yedek mod");
  if (ayar.durdurulan.has("soru_uretim")) return bitir("üretim durduruldu");
  const istemci = kmyai();
  if (!istemci) return bitir("KMYAI anahtarı yok");
  if (!kmyaiErisilebilir()) return bitir("KMYAI erişilemiyor");

  const s = servisIstemcisi();
  const kilitSn = Math.ceil(butceMs / 1000) + 30;
  const { data: kilit } = await s.rpc("sistem_uretim_kilidi_al", { p_kazanim: kazanimId, p_bant: bant, p_saniye: kilitSn });
  if (kilit !== true) return bitir("başka üretim sürüyor");

  try {
    const [sayac, ozetler] = await Promise.all([harfSayaclari(kazanimId), oncekiOzetler(kazanimId)]);
    let siradaki = 0;
    let deneme = 0;
    const maxDeneme = adet * 3; // atılma oranı yüksek olsa da sonsuz döngü yok
    const isci = async () => {
      while (rapor.dogrulanan < adet && deneme < maxDeneme && Date.now() - bas < butceMs - 45_000 && kmyaiErisilebilir()) {
        const i = siradaki++;
        deneme++;
        const zorluk = banttanZorluk(bant, i);
        const dogruSik = dogruSikSec(k.sinav, sayac);
        sayac[dogruSik] = (sayac[dogruSik] ?? 0) + 1;
        const istek: UretimIstegi = {
          kazanimKodu: k.kod, kazanimAciklama: k.aciklama, dersKodu: k.dersKod, dersAd: k.dersAd, sinifDuzeyi: k.sinifDuzeyi,
          sinav: k.sinav, hedefZorluk: zorluk, soruTipi: soruTipiSec(zorluk, k.soruTipiAgirliklari), dogruSik, oncekiOzetler: ozetler,
        };
        const r = await soruUret(
          { istemci, uretimAyari: ayar.gorevler.soru_uretim, dogrulamaAyari: ayar.gorevler.soru_dogrulama, uretimPromptu: ayar.promptlar.soru_uretim, dogrulamaPromptu: ayar.promptlar.soru_dogrulama },
          istek,
        );
        rapor.soruSureleriMs.push(r.sureMs);
        await kaydet(k, r, ayar.promptlar.soru_uretim.surum);
        if (r.durum === "dogrulandi") {
          rapor.dogrulanan++;
          ozetler.unshift(r.soru.govdeMd.replace(/\s+/g, " ").slice(0, 110));
        } else {
          rapor.reddedilen++;
          rapor.nedenler[r.asama] = (rapor.nedenler[r.asama] ?? 0) + 1;
          if (rapor.ornekRedler.length < 5) rapor.ornekRedler.push(`${r.asama}: ${r.redNedeni}`.slice(0, 200));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, adet) }, isci));
  } finally {
    await s.rpc("sistem_uretim_kilidi_birak", { p_kazanim: kazanimId, p_bant: bant, p_uretilen: rapor.dogrulanan, p_reddedilen: rapor.reddedilen });
  }
  return bitir();
}

/** Öğrenci soru isterken stok azsa kaç soru üretilecek. */
export function arkaPlanIhtiyaci(bantStok: number): number {
  return Math.max(0, HAVUZ_AYARLARI.ogrenciMinStok - bantStok);
}
