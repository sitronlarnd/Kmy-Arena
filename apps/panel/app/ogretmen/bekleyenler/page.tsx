import { karar, toplulukOnay } from "@/app/ogretmen/eylemler";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc, tarih } from "@/lib/panel";
import { paneleErisebilir, yetkilerim } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Bekleyenler {
  sikayetler: Array<{ id: string; hedef_tur: string; hedef_id: string; sebep: string; oncelikli: boolean; olusturma: string; onizleme: string | null; sayi: number }>;
  soru_hatalari: Array<{ id: string; soru_id: string; aciklama: string | null; govde: string; dogru: string; olusturma: string }>;
  duellolar: Array<{ id: string; ogrenci: string; neden: string; olusturma: string }>;
  topluluk: Array<{ id: string; metin: string; ai_cozum: string | null; olusturma: string; cevaplar: Array<{ id: string; aciklama: string; sik: string | null; ai_dogru: boolean | null; kabul: string | null }> }>;
  klanlar: Array<{ id: string; ad: string; slogan: string | null; olusturma: string }>;
}

const SEBEP: Record<string, string> = { kufur: "Küfür", zorbalik: "Zorbalık", kisisel_bilgi: "Kişisel bilgi", spam: "Spam", uygunsuz: "Uygunsuz", diger: "Diğer" };
const HEDEF: Record<string, string> = { klan_mesaj: "Klan mesajı", topluluk_soru: "Topluluk sorusu", topluluk_cevap: "Topluluk cevabı", klan: "Klan" };

function KararDugmeleri({ tur, id, secenekler }: { tur: string; id: string; secenekler: Array<[string, string, string?]> }) {
  return (
    <div className="form">
      {secenekler.map(([k, etiket, stil]) => (
        <form key={k} action={karar}>
          <input type="hidden" name="tur" value={tur} /><input type="hidden" name="id" value={id} /><input type="hidden" name="karar" value={k} />
          <button className={`dugme kucuk ${stil ?? ""}`} type="submit">{etiket}</button>
        </form>
      ))}
    </div>
  );
}

export default async function Bekleyenler() {
  const y = await yetkilerim();
  const b = await panelRpc<Bekleyenler>("panel_bekleyenler");
  const toplam = b.sikayetler.length + b.soru_hatalari.length + b.duellolar.length + b.topluluk.length + b.klanlar.length;
  return (
    <PanelKabugu baslik={`Bekleyenler · ${toplam}`} panel={paneleErisebilir(y, "ogretmen") ? "ogretmen" : "dershane"} aktif="/ogretmen/bekleyenler">
      {toplam === 0 && <Kart genis vurgu baslik="Her şey yolunda" aciklama="Bekleyen şikâyet, hata bildirimi ya da onay yok." />}

      {b.sikayetler.length > 0 && (
        <Kart genis baslik="Şikâyetler" aciklama="Zorbalık şikâyetleri en üstte. 3 şikâyet alan içerik otomatik gizlenmiştir; yersizse geri açabilirsin.">
          <div className="liste" style={{ marginTop: 12 }}>
            {b.sikayetler.map((s) => (
              <div key={s.id} className="satir" style={{ borderLeft: s.oncelikli ? "4px solid var(--yanlis)" : undefined }}>
                <div className="esnek">
                  <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                    <span className={`rozet ${s.oncelikli ? "yanlis" : "altin"}`}>{SEBEP[s.sebep] ?? s.sebep}</span>
                    <span className="rozet">{HEDEF[s.hedef_tur] ?? s.hedef_tur}</span>
                    <span className="soluk kucuk">{s.sayi} şikâyet · {tarih(s.olusturma, true)}</span>
                  </div>
                  <div className="kucuk">“{s.onizleme ?? "—"}”</div>
                </div>
                <KararDugmeleri tur="sikayet" id={s.id} secenekler={[["gizle", "Gizle", "tehlike"], ["red", "Yersiz", "ikincil"]]} />
              </div>
            ))}
          </div>
        </Kart>
      )}

      {b.topluluk.length > 0 && (
        <Kart genis baslik="Topluluk: öğretmen onayı bekleyen sorular" aciklama="Doğru cevabı onayla (puanı sen verirsin); istersen örnek çözüm olarak işaretle.">
          <div className="liste" style={{ marginTop: 12 }}>
            {b.topluluk.map((q) => (
              <div key={q.id} className="satir" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <div><b>Soru:</b> {q.metin}</div>
                {q.ai_cozum && <details><summary className="soluk kucuk">AI çözümü</summary><pre className="rapor">{q.ai_cozum}</pre></details>}
                {q.cevaplar.length === 0 && <span className="soluk kucuk">Henüz öğrenci cevabı yok.</span>}
                {q.cevaplar.map((c) => (
                  <div key={c.id} className="satir" style={{ background: "var(--yuzey)" }}>
                    <div className="esnek kucuk">{c.sik && <span className="rozet vurgu">{c.sik}</span>} {c.aciklama}
                      {c.ai_dogru !== null && <span className={`rozet ${c.ai_dogru ? "dogru" : "yanlis"}`} style={{ marginLeft: 6 }}>AI: {c.ai_dogru ? "doğru görünüyor" : "kontrol et"}</span>}
                    </div>
                    <form action={toplulukOnay}><input type="hidden" name="cevap" value={c.id} /><button className="dugme kucuk dogru">Onayla</button></form>
                    <form action={toplulukOnay}><input type="hidden" name="cevap" value={c.id} /><input type="hidden" name="ornek" value="1" /><button className="dugme kucuk ikincil">Örnek çözüm</button></form>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Kart>
      )}

      {b.soru_hatalari.length > 0 && (
        <Kart genis baslik="Soru hata bildirimleri" aciklama="Onaylarsan soru herkes için emekliye ayrılır.">
          <div className="liste" style={{ marginTop: 12 }}>
            {b.soru_hatalari.map((h) => (
              <div key={h.id} className="satir">
                <div className="esnek kucuk"><div>{h.govde}</div><div className="soluk">Cevap anahtarı: {h.dogru} · Not: {h.aciklama ?? "—"}</div></div>
                <KararDugmeleri tur="soru_hatasi" id={h.id} secenekler={[["onay", "Hatalı, kaldır", "tehlike"], ["red", "Soru doğru", "ikincil"]]} />
              </div>
            ))}
          </div>
        </Kart>
      )}

      {b.duellolar.length > 0 && (
        <Kart baslik="Şüpheli düellolar">
          <div className="liste" style={{ marginTop: 12 }}>
            {b.duellolar.map((d) => (
              <div key={d.id} className="satir">
                <div className="esnek kucuk"><b>{d.ogrenci}</b><div className="soluk">{d.neden}</div></div>
                <KararDugmeleri tur="duello" id={d.id} secenekler={[["onay", "İncelendi"]]} />
              </div>
            ))}
          </div>
        </Kart>
      )}

      {b.klanlar.length > 0 && (
        <Kart baslik="Klan adı onayı">
          <div className="liste" style={{ marginTop: 12 }}>
            {b.klanlar.map((k) => (
              <div key={k.id} className="satir">
                <div className="esnek"><b>{k.ad}</b><div className="soluk kucuk">{k.slogan ?? ""}</div></div>
                <KararDugmeleri tur="klan" id={k.id} secenekler={[["onay", "Onayla", "dogru"], ["red", "Reddet", "tehlike"]]} />
              </div>
            ))}
          </div>
        </Kart>
      )}
    </PanelKabugu>
  );
}
