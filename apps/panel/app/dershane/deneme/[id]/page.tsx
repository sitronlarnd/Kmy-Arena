import { notFound } from "next/navigation";
import { KayitDugmesi } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc, tarih } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { YazdirDugmesi } from "@/app/merkez/dershaneler/[id]/YazdirDugmesi";
import { dersZayifOdev } from "../eylemler";

export const dynamic = "force-dynamic";

interface Rapor { ogrenciler: { id: string; ad: string; sinif: string | null; net: number; dersler: Record<string, number> }[]; siniflar: { sinif_id: string; sinif: string; dersler: Record<string, number>; en_zayif: string }[] }

export default async function DenemeRaporu({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("dershane");
  const { id } = await params;
  const { data: d } = await (await sunucuIstemcisi()).from("deneme").select("ad, tarih, sinav_turu").eq("id", id).maybeSingle();
  if (!d) notFound();
  const r = await panelRpc<Rapor>("panel_deneme_rapor", { p_deneme: id });
  const dersler = [...new Set(r.ogrenciler.flatMap((o) => Object.keys(o.dersler)))];
  return (
    <PanelKabugu baslik={d.ad as string} panel="dershane" aktif="/dershane/deneme" yol={<><a href="/dershane/deneme">Denemeler</a> › {d.sinav_turu as string} · {tarih(d.tarih as string)}</>}
      sag={<YazdirDugmesi />}>
      <Kart genis baslik="Sınıflar" aciklama="Her sınıfın ders ortalamaları ve en zayıf dersi. Tek tıkla o derste sınıfın en çok yanlış yaptığı konulara uyarlamalı telafi ödevi verin.">
        <table className="tablo">
          <thead><tr><th>Sınıf</th>{dersler.map((x) => <th key={x}>{x}</th>)}<th>En zayıf</th><th /></tr></thead>
          <tbody>{r.siniflar.map((c) => (
            <tr key={c.sinif_id}><td><b>{c.sinif}</b></td>{dersler.map((x) => <td key={x}>{c.dersler[x] ?? "—"}</td>)}
              <td><span className="rozet yanlis">{c.en_zayif}</span></td>
              <td><KayitDugmesi eylem={dersZayifOdev.bind(null, c.sinif_id, c.en_zayif)} etiket={`${c.en_zayif} telafi ödevi`} /></td></tr>
          ))}</tbody>
        </table>
      </Kart>
      <Kart genis baslik={`Öğrenciler (${r.ogrenciler.length})`}>
        <div className="kaydir">
          <table className="tablo">
            <thead><tr><th>#</th><th>Öğrenci</th><th>Sınıf</th>{dersler.map((x) => <th key={x}>{x}</th>)}<th>Toplam net</th></tr></thead>
            <tbody>{r.ogrenciler.map((o, i) => (
              <tr key={o.id}><td>{i + 1}</td><td><a href={`/ogretmen/ogrenci/${o.id}`}>{o.ad}</a></td><td>{o.sinif}</td>{dersler.map((x) => <td key={x}>{o.dersler[x] ?? "—"}</td>)}<td><b>{o.net}</b></td></tr>
            ))}</tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
