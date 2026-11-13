"use server";

import { revalidatePath } from "next/cache";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

/** Genel bayrak: açık/kapalı + kademeli açılış yüzdesi. */
export async function genelBayrak(form: FormData): Promise<void> {
  const kullanici = await merkezYetkisi("merkez.ozellik_bayragi");
  const kod = String(form.get("kod"));
  const acik = form.get("acik") === "on";
  const yuzde = Math.min(100, Math.max(0, Math.round(Number(form.get("yuzde")) || 0)));
  const { error } = await servis().from("ozellik_bayragi").update({ acik, yuzde }).eq("kod", kod).is("dershane_id", null);
  if (error) throw new Error(error.message);
  await denetle(kullanici, "bayrak.genel", kod, { acik, yuzde });
  revalidatePath("/merkez/bayraklar");
}

/** Dershane bazlı geçersiz kılma: "varsayilan" kaydı siler, "acik"/"kapali" yazar. */
export async function dershaneBayragi(form: FormData): Promise<void> {
  const kullanici = await merkezYetkisi("merkez.ozellik_bayragi");
  const kod = String(form.get("kod"));
  const dershane = String(form.get("dershane_id"));
  const deger = String(form.get("deger"));
  const s = servis();
  if (deger === "varsayilan") {
    const { error } = await s.from("ozellik_bayragi").delete().eq("kod", kod).eq("dershane_id", dershane);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await s
      .from("ozellik_bayragi")
      .upsert({ kod, dershane_id: dershane, acik: deger === "acik", yuzde: 100 }, { onConflict: "kod,dershane_id" });
    if (error) throw new Error(error.message);
  }
  await s.from("denetim_log").insert({ dershane_id: dershane, kullanici_id: kullanici, islem: "bayrak.dershane", hedef: kod, ayrinti: { deger } });
  revalidatePath("/merkez/bayraklar");
}
