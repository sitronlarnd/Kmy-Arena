import "server-only";
import ExcelJS from "exceljs";

/** Excel (.xlsx) veya CSV (virgül / noktalı virgül) dosyasını başlıklı satırlara çevirir. */
export async function tabloOku(dosya: File): Promise<Record<string, string>[]> {
  const ad = dosya.name.toLowerCase();
  let satirlar: string[][];
  if (ad.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await dosya.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("panel.dosyaGecersiz");
    satirlar = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const v = (r.values as unknown[]).slice(1).map((h) => {
        if (h === null || h === undefined) return "";
        if (typeof h === "object" && h !== null && "text" in h) return String((h as { text: unknown }).text);
        if (typeof h === "object" && h !== null && "result" in h) return String((h as { result: unknown }).result);
        return String(h as string | number);
      });
      satirlar.push(v);
    });
  } else if (ad.endsWith(".csv") || ad.endsWith(".txt")) {
    const metin = (await dosya.text()).replace(/^\uFEFF/, "");
    const ayrac = (metin.split("\n")[0] ?? "").includes(";") ? ";" : ",";
    satirlar = metin.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(ayrac).map((h) => h.trim().replace(/^"|"$/g, "")));
  } else {
    throw new Error("panel.dosyaGecersiz");
  }
  const [baslik, ...govde] = satirlar;
  if (!baslik) throw new Error("panel.dosyaGecersiz");
  const anahtar = baslik.map((b) => normal(b));
  return govde.map((r) => Object.fromEntries(anahtar.map((k, i) => [k, (r[i] ?? "").trim()])));
}

/** "Doğum Yılı" → "dogumyili", "E-posta" → "eposta" */
export function normal(x: string): string {
  return x.toLocaleLowerCase("tr-TR").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u").replace(/[^a-z0-9]/g, "");
}

/** Liste → Excel dosyası (Buffer). */
export async function excelYaz(sayfa: string, basliklar: string[], satirlar: (string | number | null)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "KMY Arena";
  const ws = wb.addWorksheet(sayfa.slice(0, 31));
  ws.addRow(basliklar);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D5CFF" } };
  for (const r of satirlar) ws.addRow(r);
  ws.columns.forEach((c, i) => { c.width = Math.min(40, Math.max(10, ...[basliklar[i] ?? "", ...satirlar.map((r) => String(r[i] ?? ""))].map((x) => x.length + 2))); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
