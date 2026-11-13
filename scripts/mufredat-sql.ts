/**
 * seed/mufredat/*.json → supabase/seed/01_mufredat.sql
 * Kullanım: pnpm tsx scripts/mufredat-sql.ts
 * JSON, dershane ve Merkez Panelin düzenleyebildiği müfredatın kaynağıdır.
 * Üretilen SQL tekrar çalıştırılabilir (kod üzerinden günceller).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

interface Kazanim { kod: string; aciklama: string; on_kosullar: string[] }
interface Unite { kod: string; ad: string; sinif_duzeyi: number; kazanimlar: Kazanim[] }
interface Ders { kod: string; ad: string; ozellik: string; alanlar?: string[]; uniteler: Unite[] }
interface Dosya { sinav_turu: string; dersler: Ders[] }

const kok = fileURLToPath(new URL("..", import.meta.url));
const klasor = join(kok, "seed", "mufredat");
const q = (s: string): string => `'${s.replaceAll("'", "''")}'`;
const id = (tur: string, kod: string): string => `app.sabit_uuid(${q(`${tur}:${kod}`)})`;

const satirlar: string[] = [
  "-- OTOMATİK ÜRETİLDİ: scripts/mufredat-sql.ts — elle düzenleme, JSON'u düzenle.",
  "",
];
const tumKodlar = new Set<string>();
// Sıra: LGS, TYT, AYT, YDT (uygulamadaki ders sırası)
const SIRA = ["lgs.json", "tyt.json", "ayt.json", "ydt.json"];
const dosyalar = readdirSync(klasor).filter((f) => f.endsWith(".json")).sort((a, b) => SIRA.indexOf(a) - SIRA.indexOf(b));
let dersSirasi = 0;

for (const ad of dosyalar) {
  const d = JSON.parse(readFileSync(join(klasor, ad), "utf8")) as Dosya;
  d.dersler.forEach((ders) => {
    const alanlar = ders.alanlar?.length ? `array[${ders.alanlar.map(q).join(", ")}]::text[]` : "'{}'::text[]";
    satirlar.push(
      `insert into public.ders (id, kod, ad, sinav_turu, ozellik, alanlar, sira) values (${id("ders", ders.kod)}, ${q(ders.kod)}, ${q(ders.ad)}, ${q(d.sinav_turu)}, ${q(ders.ozellik)}, ${alanlar}, ${dersSirasi++})`,
      "  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, alanlar = excluded.alanlar, sira = excluded.sira;",
    );
    ders.uniteler.forEach((u, ui) => {
      satirlar.push(
        `insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (${id("unite", u.kod)}, ${id("ders", ders.kod)}, ${q(u.kod)}, ${q(u.ad)}, ${u.sinif_duzeyi}, ${ui})`,
        "  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;",
      );
      u.kazanimlar.forEach((k, ki) => {
        tumKodlar.add(k.kod);
        const onKosul = k.on_kosullar.length ? `array[${k.on_kosullar.map((o) => id("kazanim", o)).join(", ")}]` : "'{}'::uuid[]";
        satirlar.push(
          `insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (${id("kazanim", k.kod)}, ${id("unite", u.kod)}, ${q(k.kod)}, ${q(k.aciklama)}, ${u.sinif_duzeyi}, ${q(d.sinav_turu)}, ${onKosul}, ${ki})`,
          "  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira, unite_id = excluded.unite_id;",
        );
      });
    });
  });
}

// Ön koşul bütünlüğü: bilinmeyen kazanıma atıf yapılamaz
for (const ad of dosyalar) {
  const d = JSON.parse(readFileSync(join(klasor, ad), "utf8")) as Dosya;
  for (const k of d.dersler.flatMap((x) => x.uniteler.flatMap((u) => u.kazanimlar))) {
    for (const o of k.on_kosullar) {
      if (!tumKodlar.has(o)) throw new Error(`${ad}: ${k.kod} bilinmeyen ön koşula atıf yapıyor: ${o}`);
    }
  }
}

const hedef = join(kok, "supabase", "seed", "01_mufredat.sql");
writeFileSync(hedef, `${satirlar.join("\n")}\n`);
console.warn(`${tumKodlar.size} kazanım → ${hedef}`);
