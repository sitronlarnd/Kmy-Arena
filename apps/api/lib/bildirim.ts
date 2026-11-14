import "server-only";
import { epostaGonder } from "./eposta";
import { servisIstemcisi } from "./supabase";

/**
 * Bildirim kuyruğunu Expo Push servisine iletir. Sessiz saat ve kapalı tercih
 * veritabanında süzülür (sistem_bildirim_bekleyenler). Geçersiz jetonlar silinir.
 */
interface Bekleyen { id: number; kullanici_id: string; baslik: string; govde: string; veri: Record<string, unknown>; tokenlar: string[] | null }
interface Bilet { status: "ok" | "error"; message?: string; details?: { error?: string } }

const EXPO = "https://exp.host/--/api/v2/push/send";

export async function bildirimleriGonder(): Promise<{ gonderilen: number; hata: number; gecersiz: number }> {
  const s = servisIstemcisi();
  const { data, error } = await s.rpc("sistem_bildirim_bekleyenler", { p_limit: 500 });
  if (error) throw error;
  const l = (data ?? []) as Bekleyen[];
  const mesajlar = l.flatMap((b) => (b.tokenlar ?? []).map((to) => ({ kuyruk: b.id, to, title: b.baslik, body: b.govde, data: b.veri, sound: "default", channelId: "varsayilan" })));
  let gonderilen = 0, hata = 0;
  const gecersiz: string[] = [];
  const basarili = new Set<number>();
  const basarisiz = new Set<number>();
  for (let i = 0; i < mesajlar.length; i += 100) {
    const parca = mesajlar.slice(i, i + 100);
    try {
      const r = await fetch(EXPO, {
        method: "POST",
        headers: {
          "content-type": "application/json", accept: "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(parca.map((m) => ({ to: m.to, title: m.title, body: m.body, data: m.data, sound: m.sound, channelId: m.channelId }))),
      });
      const j = (await r.json().catch(() => ({}))) as { data?: Bilet[] };
      parca.forEach((m, k) => {
        const b = j.data?.[k];
        if (b?.status === "ok") { gonderilen++; basarili.add(m.kuyruk); }
        else { hata++; basarisiz.add(m.kuyruk); if (b?.details?.error === "DeviceNotRegistered") gecersiz.push(m.to); }
      });
    } catch {
      parca.forEach((m) => { hata++; basarisiz.add(m.kuyruk); });
    }
  }
  const ok = l.filter((b) => basarili.has(b.id)).map((b) => b.id);
  const kotu = l.filter((b) => !basarili.has(b.id) && basarisiz.has(b.id)).map((b) => b.id);
  if (ok.length || gecersiz.length) await s.rpc("sistem_bildirim_isaretle", { p_idler: ok, p_sonuc: "gonderildi", p_gecersiz: gecersiz });
  if (kotu.length) await s.rpc("sistem_bildirim_isaretle", { p_idler: kotu, p_sonuc: "hata", p_gecersiz: [] });
  return { gonderilen, hata, gecersiz: gecersiz.length };
}

interface VeliSatiri { veli_id: string; eposta: string; veli_ad: string; dershane: string; cocuklar: { ad: string; soru: number; dogru: number; gun: number; dakika: number; seri: number; odev_biten: number; odev_bekleyen: number }[] }

const kacis = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Veliye haftalık özet (şablon metin; AI yok, kişisel veri sağlayıcıya gitmez). */
export function veliEpostasi(v: VeliSatiri): { konu: string; metin: string; html: string } {
  const satirlar = v.cocuklar.map((c) => {
    const oran = c.soru ? Math.round((c.dogru / c.soru) * 100) : 0;
    const yorum = c.soru === 0 ? "Bu hafta hiç soru çözmedi; küçük bir hatırlatma iyi gelebilir."
      : c.gun >= 5 ? "Harika bir düzen yakaladı, tebrik edebilirsiniz!"
      : c.gun >= 3 ? "İyi gidiyor; her gün biraz çözmek seriyi korur." : "Daha düzenli çalışması faydalı olur.";
    return { c, oran, yorum };
  });
  const metin = [
    `Merhaba ${v.veli_ad},`, "", `${v.dershane} · KMY Arena haftalık özet (son 7 gün)`, "",
    ...satirlar.flatMap(({ c, oran, yorum }) => [
      `${c.ad}: ${c.soru} soru, %${oran} doğru, ${c.gun} gün aktif, ${c.dakika} dk çalışma, ${c.seri} günlük seri.`,
      `Ödev: ${c.odev_biten} tamamlandı, ${c.odev_bekleyen} bekliyor. ${yorum}`, "",
    ]),
    "Ayrıntılar için KMY Arena uygulamasındaki veli ekranına bakabilirsiniz.",
    "Bu e-postaları almak istemiyorsanız uygulamada Profil → Bildirimler bölümünden kapatabilirsiniz.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#1d1b3a">
<div style="background:linear-gradient(135deg,#9b6bff,#3f7bff);color:#fff;padding:22px 24px;border-radius:18px 18px 0 0"><b style="font-size:20px">KMY Arena</b><div style="opacity:.85">${kacis(v.dershane)} · haftalık özet</div></div>
<div style="border:1px solid #e4e2f5;border-top:0;border-radius:0 0 18px 18px;padding:20px 24px">
<p>Merhaba ${kacis(v.veli_ad)},</p>
${satirlar.map(({ c, oran, yorum }) => `<div style="background:#f6f5ff;border-radius:14px;padding:14px 16px;margin:12px 0">
<b style="font-size:17px">${kacis(c.ad)}</b>
<table style="width:100%;margin-top:8px;font-size:14px"><tr><td><b>${c.soru}</b><br>soru</td><td><b>%${oran}</b><br>doğru</td><td><b>${c.gun}/7</b><br>gün</td><td><b>${c.dakika} dk</b><br>çalışma</td><td><b>${c.seri}</b><br>seri</td></tr></table>
<div style="margin-top:8px;font-size:14px">Ödev: ${c.odev_biten} tamamlandı, ${c.odev_bekleyen} bekliyor.</div>
<div style="margin-top:6px;color:#5b4bf5">${yorum}</div></div>`).join("")}
<p style="font-size:13px;color:#77759a">Bu e-postaları uygulamada Profil → Bildirimler bölümünden kapatabilirsiniz.</p></div></div>`;
  return { konu: `${v.cocuklar.map((c) => c.ad).join(", ")} · haftalık KMY Arena özeti`, metin, html };
}

export async function veliHaftalikGonder(): Promise<{ veli: number; gonderilen: number; epostaKapali: boolean }> {
  const { data, error } = await servisIstemcisi().rpc("sistem_veli_haftalik");
  if (error) throw error;
  const l = (data ?? []) as VeliSatiri[];
  if (!process.env.RESEND_API_KEY) return { veli: l.length, gonderilen: 0, epostaKapali: true };
  let gonderilen = 0;
  for (const v of l) {
    if (v.eposta.endsWith(".demo") || v.eposta.endsWith("@inceleme.kmyarena.app")) continue;
    const e = veliEpostasi(v);
    if (await epostaGonder(v.eposta, e.konu, e.metin, e.html)) gonderilen++;
    await new Promise((r) => setTimeout(r, 600)); // Resend hız sınırı (≈2/sn)
  }
  return { veli: l.length, gonderilen, epostaKapali: false };
}
