import { YazdirDugmesi } from "@/app/merkez/dershaneler/[id]/YazdirDugmesi";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Etki { ogrenci: number; gruplar: { grup: "yuksek" | "orta" | "dusuk"; ogrenci: number; gunluk_soru: number; ilk_net: number; son_net: number; degisim: number }[] }
const AD = { yuksek: "Yüksek kullanım", orta: "Orta kullanım", dusuk: "Düşük kullanım" };
const RENK = { yuksek: "#12b76a", orta: "#7c5cfa", dusuk: "#f5a400" };

export default async function EtkiRaporu() {
  await paneliKoru("dershane");
  const sinavlar = ["LGS", "TYT", "AYT"] as const;
  const veri = await Promise.all(sinavlar.map((s) => panelRpc<Etki>("panel_etki_raporu", { p_sinav: s }).catch(() => ({ ogrenci: 0, gruplar: [] }))));
  return (
    <PanelKabugu baslik="Etki raporu" panel="dershane" aktif="/dershane/deneme" sag={<YazdirDugmesi />}
      yol="Platformu çok kullanan öğrencilerin denemelerdeki net değişimi, az kullananlarla karşılaştırılır. Veli toplantılarında ve yeni kayıt görüşmelerinde PDF olarak kullanabilirsiniz.">
      {sinavlar.map((s, i) => {
        const e = veri[i];
        if (!e || e.ogrenci < 3) return <Kart key={s} baslik={s}><p>Yeterli veri yok: en az 2 denemesi olan 3 öğrenci gerekir.</p></Kart>;
        const max = Math.max(...e.gruplar.map((g) => Math.abs(g.degisim)), 1);
        return (
          <Kart key={s} genis baslik={`${s} · ${e.ogrenci} öğrenci`} aciklama="İlk ve son deneme arasındaki ortalama toplam net değişimi">
            <div style={{ display: "grid", gap: 14, marginTop: 10 }}>
              {e.gruplar.map((g) => (
                <div key={g.grup} style={{ display: "grid", gridTemplateColumns: "200px 1fr 120px", gap: 14, alignItems: "center" }}>
                  <div><b>{AD[g.grup]}</b><div className="soluk kucuk">{g.ogrenci} öğrenci · günde {g.gunluk_soru} soru</div></div>
                  <div style={{ height: 26, borderRadius: 8, background: "var(--yuzey2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(Math.abs(g.degisim) / max) * 100}%`, background: g.degisim >= 0 ? RENK[g.grup] : "#e5354f", borderRadius: 8 }} />
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: g.degisim >= 0 ? RENK[g.grup] : "#e5354f" }}>{g.degisim >= 0 ? "+" : ""}{g.degisim} net</div>
                </div>
              ))}
            </div>
            <p className="soluk kucuk" style={{ marginTop: 12 }}>Ortalama net: {e.gruplar.map((g) => `${AD[g.grup]} ${g.ilk_net} → ${g.son_net}`).join(" · ")}. Gözlemsel bir karşılaştırmadır; nedensellik iddiası değildir.</p>
          </Kart>
        );
      })}
    </PanelKabugu>
  );
}
