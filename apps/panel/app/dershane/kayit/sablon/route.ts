import { excelYaz } from "@/lib/tablo-oku";

export async function GET() {
  const b = await excelYaz("Öğrenciler", ["Ad", "Soyad", "Sınıf", "Şube", "Doğum yılı", "E-posta", "Öğrenci no"], [
    ["Ayşe", "Yılmaz", "8-A", "Kadıköy", 2012, "", "1024"],
    ["Mehmet", "Kaya", "12-SAY", "Kadıköy", 2008, "mehmet@ornek.com", "1025"],
  ]);
  return new Response(new Uint8Array(b), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": 'attachment; filename="kmy-arena-ogrenci-sablonu.xlsx"' },
  });
}
