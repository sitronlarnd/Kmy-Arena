import { t } from "@kmy/shared/i18n";
import { Bell, KeyRound, LogOut, Mail, Moon, Trash2, type LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { api } from "@/lib/api";
import { bildirimKaydiniSil } from "@/lib/bildirim";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/lib/tema";
import { Alan } from "./Alan";
import { Dugme, IkonKutu, Kart, Metin } from "./ui";

interface Tercih { bildirim_acik: boolean; sessiz_baslangic: number; sessiz_bitis: number; veli_eposta_acik: boolean }

function Satir({ ikon, baslik, aciklama, deger, degis }: { ikon: LucideIcon; baslik: string; aciklama?: string; deger: boolean; degis: (v: boolean) => void }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <IkonKutu ikon={ikon} renk={tema.vurgu} boyut={38} />
      <View style={{ flex: 1 }}>
        <Metin tur="altbaslik">{baslik}</Metin>
        {aciklama ? <Metin tur="kucuk" soluk>{aciklama}</Metin> : null}
      </View>
      <Switch value={deger} onValueChange={degis} trackColor={{ true: tema.vurgu, false: tema.kenar }} thumbColor="#fff" />
    </View>
  );
}

/** Profil ve veli ekranlarının ortak alt bölümü: bildirim tercihleri, çıkış, hesap silme. */
export function HesapAyarlari() {
  const tema = useTema();
  const profil = useOturum((d) => d.profil);
  const [t1, setT] = useState<Tercih | null>(null);
  const [silOnay, setSilOnay] = useState(false);
  const [sifreAcik, setSifreAcik] = useState(false);
  const [yeniSifre, setYeniSifre] = useState("");
  const [sifreMesaj, setSifreMesaj] = useState<string | null>(null);

  async function sifreDegistir() {
    if (yeniSifre.length < 8) { setSifreMesaj(t("sifre.kurallar")); return; }
    const { error } = await supabase.auth.updateUser({ password: yeniSifre });
    setSifreMesaj(error ? t("ortak.hata") : t("sifre.degisti"));
    if (!error) { setYeniSifre(""); setSifreAcik(false); }
  }

  useEffect(() => {
    if (!profil) return;
    void supabase.from("kullanici").select("bildirim_acik, sessiz_baslangic, sessiz_bitis, veli_eposta_acik").eq("id", profil.id).maybeSingle<Tercih>()
      .then(({ data }) => setT(data ?? null));
  }, [profil]);

  async function guncelle(d: Partial<{ acik: boolean; sessizBaslangic: number; sessizBitis: number; veliEposta: boolean }>) {
    const r = await api<{ acik: boolean; sessizBaslangic: number; sessizBitis: number; veliEposta: boolean }>("/api/bildirim/tercih", d).catch(() => null);
    if (r) setT({ bildirim_acik: r.acik, sessiz_baslangic: r.sessizBaslangic, sessiz_bitis: r.sessizBitis, veli_eposta_acik: r.veliEposta });
  }

  const sessiz = t1 ? t1.sessiz_baslangic === 22 && t1.sessiz_bitis === 8 : true;
  const satirVar = Platform.OS !== "web" || profil?.tur === "veli";
  return (
    <>
      {t1 && satirVar && (
        <Kart>
          <Metin tur="altbaslik">{t("bildirim.baslik")}</Metin>
          <View style={{ gap: 14, marginTop: 10 }}>
            {Platform.OS !== "web" && (
              <Satir ikon={Bell} baslik={t("bildirim.anlik")} aciklama={t("bildirim.anlikAciklama")} deger={t1.bildirim_acik} degis={(v) => void guncelle({ acik: v })} />
            )}
            {Platform.OS !== "web" && t1.bildirim_acik && (
              <Satir ikon={Moon} baslik={t("bildirim.sessiz")} aciklama={t("bildirim.sessizAciklama")} deger={sessiz}
                degis={(v) => void guncelle(v ? { sessizBaslangic: 22, sessizBitis: 8 } : { sessizBaslangic: 0, sessizBitis: 0 })} />
            )}
            {profil?.tur === "veli" && (
              <Satir ikon={Mail} baslik={t("bildirim.veliEposta")} aciklama={t("bildirim.veliEpostaAciklama")} deger={t1.veli_eposta_acik} degis={(v) => void guncelle({ veliEposta: v })} />
            )}
          </View>
        </Kart>
      )}
      <Kart>
        {sifreAcik ? (
          <View style={{ gap: 10 }}>
            <Alan etiket={t("sifre.yeni")} value={yeniSifre} onChangeText={setYeniSifre} secureTextEntry autoComplete="new-password" />
            <Dugme kucuk ikon={KeyRound} baslik={t("sifre.degistir")} onPress={() => void sifreDegistir()} />
          </View>
        ) : (
          <Dugme kucuk tur="ikincil" ikon={KeyRound} baslik={t("sifre.degistir")} onPress={() => { setSifreAcik(true); setSifreMesaj(null); }} />
        )}
        {sifreMesaj && <Metin tur="kucuk" soluk>{sifreMesaj}</Metin>}
      </Kart>
      <Dugme tur="hayalet" ikon={LogOut} baslik={t("giris.cikisYap")} onPress={() => void bildirimKaydiniSil().then(() => supabase.auth.signOut())} />
      <Kart vurgu={tema.yanlis}>
        <Metin tur="kucuk" soluk>{t("profil.silmeAciklama")}</Metin>
        <Dugme kucuk tur={silOnay ? "tehlike" : "hayalet"} ikon={Trash2} baslik={silOnay ? t("profil.silmeOnay") : t("profil.hesabiSil")}
          onPress={() => (silOnay ? void api("/api/hesap/sil", {}).then(() => supabase.auth.signOut()) : setSilOnay(true))} />
      </Kart>
    </>
  );
}
