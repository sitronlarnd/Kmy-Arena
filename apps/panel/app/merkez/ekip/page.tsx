import { ekipEkle, ekipRolKaldir } from "@/app/merkez/merkez-eylemleri";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
const ROL: Record<string, string> = { merkez_sahip: "Sahip", merkez_icerik: "İçerik editörü", merkez_destek: "Destek", merkez_satis: "Satış", bayi: "Bayi" };

export default async function Ekip() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.dershane_yonet");
  const s = servis();
  const { data: roller } = await s.from("kullanici_rol").select("kullanici_id, rol_kod, kullanici:kullanici_id(ad, soyad, son_giris)").is("dershane_id", null);
  const kisiler = new Map<string, { ad: string; son: string | null; roller: string[] }>();
  for (const r of (roller ?? []) as unknown as { kullanici_id: string; rol_kod: string; kullanici: { ad: string; soyad: string; son_giris: string | null } | null }[]) {
    const x = kisiler.get(r.kullanici_id) ?? { ad: `${r.kullanici?.ad ?? ""} ${r.kullanici?.soyad ?? ""}`, son: r.kullanici?.son_giris ?? null, roller: [] };
    x.roller.push(r.rol_kod); kisiler.set(r.kullanici_id, x);
  }
  const eposta = new Map<string, string>();
  for (const id of kisiler.keys()) { const { data } = await s.auth.admin.getUserById(id); eposta.set(id, data.user?.email ?? ""); }
  return (
    <PanelKabugu baslik="Merkez ekibi" panel="merkez" aktif="/merkez/ekip">
      <Kart genis baslik="Ekip üyesi ekle" aciklama="İçerik editörü: müfredat, prompt, ekonomi (finans ve kişisel veri yok). Destek: talepler ve salt okunur dershane görünümü. Satış: teklifler ve pilotlar. Her merkez hesabında iki adımlı doğrulama zorunludur.">
        <KayitFormu eylem={ekipEkle} dugme="Hesap aç">
          <input name="ad" placeholder="Ad" className="alan" /><input name="soyad" placeholder="Soyad" className="alan" />
          <input name="eposta" type="email" required placeholder="E-posta" className="alan" />
          <select name="rol" className="alan"><option value="merkez_icerik">İçerik editörü</option><option value="merkez_destek">Destek</option><option value="merkez_satis">Satış</option></select>
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Ekip">
        <table className="tablo"><thead><tr><th>Ad</th><th>E-posta</th><th>Roller</th><th>Son giriş</th></tr></thead>
          <tbody>{[...kisiler.entries()].map(([id, x]) => (
            <tr key={id}><td><b>{x.ad}</b></td><td>{eposta.get(id)}</td>
              <td><div className="form">{x.roller.map((r) => <span key={r} className="rozet">{ROL[r] ?? r}{r !== "merkez_sahip" && <KayitDugmesi eylem={ekipRolKaldir.bind(null, id, r)} etiket="×" tur="ikincil" onay="Kaldır?" />}</span>)}</div></td>
              <td className="soluk">{onceKac(x.son)}</td></tr>
          ))}</tbody></table>
      </Kart>
    </PanelKabugu>
  );
}
