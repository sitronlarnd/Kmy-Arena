import { ligAdimi, seviyeIcinXp } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Award, BookMarked, CalendarCheck, CheckCircle2, Coins, Flame, Layers, Play, Radio, RotateCcw, ShoppingBag, Snowflake, Sparkles, Target, Trophy, type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Avatar } from "@/bilesenler/sanat";
import { Basilabilir, Bolum, Cip, Cubuk, Dugme, Etiket, Halka, IkonKutu, Kart, Kaynak, Metin, Nabiz } from "@/bilesenler/ui";
import { api } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { useOturum } from "@/lib/oturum";
import { useHataDefteri, useMufredat, useTespitler } from "@/lib/sorgular";
import { GRADYAN, OYUN, golge, useTema } from "@/lib/tema";

function Kisayol({ ikon, renk, baslik, alt, onPress, sira }: { ikon: LucideIcon; renk: string; baslik: string; alt?: string; onPress: () => void; sira: number }) {
  return (
    <View style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Kart sira={sira} onPress={onPress} ic={14}>
        <IkonKutu ikon={ikon} renk={renk} />
        <View>
          <Metin tur="altbaslik" numberOfLines={1}>{baslik}</Metin>
          {alt && <Metin tur="kucuk" soluk numberOfLines={1}>{alt}</Metin>}
        </View>
      </Kart>
    </View>
  );
}

export default function Arena() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  const oyun = useOyun().data;
  const canliAcik = useOturum((s) => s.ozellikler.canli_soru_saati !== false);
  const canli = useQuery({
    queryKey: ["canli-ozet"],
    enabled: profil?.tur === "ogrenci" && canliAcik,
    refetchInterval: 60_000,
    queryFn: () => api<{ durum: string; baslangic?: string }>("/api/canli/durum", {}),
  }).data;
  const mufredat = useMufredat();
  const dersler = mufredat.data ?? [];
  const tespitler = useTespitler().data;
  const hatalar = useHataDefteri().data ?? [];
  const [dersKodu, setDersKodu] = useState<string | null>(null);
  const secili = dersKodu ? dersler.find((d) => d.kod === dersKodu) : (dersler[0] ?? null);
  const vadesiGelen = hatalar.filter((h) => h.vadesi_geldi).length;
  const ogrenci = profil?.tur === "ogrenci";

  const seviye = oyun?.seviye ?? 1;
  const alt = seviyeIcinXp(seviye);
  const ust = seviyeIcinXp(seviye + 1);
  const lig = ligAdimi(oyun?.ligAdim ?? 1);
  const tespitYok = secili && tespitler && !tespitler.get(secili.id)?.bitti;
  const gunluk = oyun?.gorevler.filter((g) => g.tur === "gunluk") ?? [];
  const haftalik = oyun?.gorevler.filter((g) => g.tur === "haftalik") ?? [];
  const gunlukOran = oyun ? oyun.gunlukSoru / Math.max(1, oyun.gunlukHedef) : 0;

  return (
    <Ekran baslik={dershane?.uygulama_ici_ad ?? t("sekmeler.arena")} altBaslik={profil?.takma_ad ? t("arena.merhaba", { ad: profil.takma_ad }) : undefined}>
      {ogrenci && !profil.veli_onayi && (
        <Kart vurgu={OYUN.altin}>
          <Metin>{t("giris.veliOnayiBekleniyor")}</Metin>
        </Kart>
      )}

      {ogrenci && oyun && !oyun.karakter && (
        <Kart gradyan={GRADYAN.vurgu} sira={0}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Sparkles size={28} color="#fff" />
            <View style={{ flex: 1 }}>
              <Metin tur="altbaslik" renk="#fff">{t("oyun.karakterSec")}</Metin>
              <Metin renk="#ffffffcc">{t("oyun.karakterAciklama")}</Metin>
            </View>
          </View>
          <Dugme tur="altin" baslik={t("oyun.karakterSec")} onPress={() => router.push("/karakter")} />
        </Kart>
      )}

      {/* Kahraman kartı: XP halkası içinde karakter, kaynaklar */}
      {ogrenci && oyun && (
        <Kart sira={1} gradyan={[tema.yuzey2, tema.yuzey]}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Basilabilir onPress={() => router.push("/karakter")} etiket={t("oyun.karakter")}>
              <Halka oran={(oyun.xp - alt) / Math.max(1, ust - alt)} boyut={104} kalinlik={7}>
                <Avatar tur={oyun.karakter?.tur} seviye={seviye} cerceve={oyun.karakter?.cerceve} arkaPlan={oyun.karakter?.arka_plan} kostum={oyun.karakter?.kostum} boyut={80} />
              </Halka>
              <View style={{ position: "absolute", bottom: -4, alignSelf: "center", paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, backgroundColor: OYUN.xp, ...golge(1, OYUN.xp) }}>
                <Metin tur="kucuk" renk="#fff">{t("arena.seviye", { n: seviye })}</Metin>
              </View>
            </Basilabilir>
            <View style={{ flex: 1, gap: 6 }}>
              <Metin tur="altbaslik" numberOfLines={1}>{profil.takma_ad ?? ""}</Metin>
              {oyun.karakter?.unvan && <Etiket metin={oyun.karakter.unvan} renk={OYUN.xp} ikon={Award} />}
              <Metin tur="kucuk" soluk>{oyun.xp.toLocaleString("tr-TR")} / {ust.toLocaleString("tr-TR")} {t("arena.xp")}</Metin>
              <Basilabilir onPress={() => router.push("/lig")} etiket={t("oyun.lig")}>
                <Etiket metin={`${lig.ad} · ${t("oyun.lig")}`} renk={lig.renk} ikon={Trophy} />
              </Basilabilir>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Kaynak ikon={Flame} deger={oyun.seri} renk={oyun.seriTehlikede ? tema.yanlis : OYUN.ates} etiket={t("oyun.seriEtiket")} />
            <Kaynak ikon={Coins} deger={oyun.altin} renk={OYUN.altin} etiket={t("oyun.altin")} />
            <Kaynak ikon={Snowflake} deger={oyun.dondurucu} renk={OYUN.buz} etiket={t("oyun.dondurucu")} />
            <Kaynak ikon={Trophy} deger={oyun.kupa} renk={OYUN.kupa} etiket={t("duello.kupaEtiket")} />
          </View>
          {oyun.seriTehlikede && <Etiket metin={t("oyun.seriTehlikede")} renk={tema.yanlis} ikon={Flame} />}
        </Kart>
      )}

      {/* Günlük hedef + ana eylem */}
      {ogrenci && oyun && (
        <Kart sira={2}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Halka oran={gunlukOran} boyut={64} kalinlik={7} gradyan={GRADYAN.ates}>
              <Flame size={24} color={OYUN.ates} fill={gunlukOran >= 1 ? OYUN.ates : "transparent"} />
            </Halka>
            <View style={{ flex: 1 }}>
              <Metin tur="etiket" soluk>{t("arena.gunlukHedef")}</Metin>
              <Metin tur="altbaslik">{t("oyun.gunlukHedef", { n: Math.min(oyun.gunlukSoru, oyun.gunlukHedef), hedef: oyun.gunlukHedef })}</Metin>
            </View>
          </View>
        </Kart>
      )}

      {dersler.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }} accessibilityLabel={t("arena.dersSec")}>
          {dersler.map((d) => (
            <Cip key={d.id} baslik={d.ad} secili={secili?.id === d.id} onPress={() => setDersKodu(d.kod)} />
          ))}
        </ScrollView>
      )}

      <Nabiz aktif={Boolean(ogrenci && oyun && oyun.gunlukSoru < oyun.gunlukHedef)}>
        <Dugme
          buyuk
          ikon={Play}
          baslik={secili ? t("arena.soruCozDers", { ders: secili.ad }) : t("arena.soruCoz")}
          onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", ...(secili ? { dersKodu: secili.kod, baslik: secili.ad } : {}) } })}
        />
      </Nabiz>

      {ogrenci && mufredat.isSuccess && dersler.length === 0 && (
        <Kart vurgu={tema.yanlis}>
          <Metin>{t("soru.paketYok")}</Metin>
        </Kart>
      )}

      {vadesiGelen > 0 && (
        <Kart sira={3} vurgu="#FF7AB6" onPress={() => router.push({ pathname: "/soru", params: { mod: "tekrar" } })}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IkonKutu ikon={RotateCcw} renk="#FF7AB6" />
            <View style={{ flex: 1 }}>
              <Metin tur="altbaslik">{t("arena.tekrarZamani", { n: vadesiGelen })}</Metin>
              <Metin tur="kucuk" soluk>{t("arena.tekrarAciklama")}</Metin>
            </View>
          </View>
        </Kart>
      )}

      {ogrenci && tespitYok && secili && (
        <Kart sira={3} vurgu={OYUN.buz}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <IkonKutu ikon={Target} renk={OYUN.buz} />
            <Metin stil={{ flex: 1 }}>{t("arena.tespitOneri", { ders: secili.ad })}</Metin>
          </View>
          <Dugme tur="ikincil" baslik={t("soru.tespitBasla")} onPress={() => router.push({ pathname: "/soru", params: { mod: "tespit", tespitDersKodu: secili.kod } })} />
        </Kart>
      )}

      {ogrenci && canli && canli.durum !== "kapali" && (
        <Kart sira={4} gradyan={canli.durum === "aktif" ? GRADYAN.ates : undefined} vurgu={canli.durum === "aktif" ? undefined : OYUN.ates}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Nabiz aktif={canli.durum === "aktif"}>
              <IkonKutu ikon={Radio} renk={canli.durum === "aktif" ? "#fff" : OYUN.ates} dolu={canli.durum !== "aktif"} />
            </Nabiz>
            <View style={{ flex: 1 }}>
              <Metin tur="altbaslik" renk={canli.durum === "aktif" ? "#fff" : undefined}>{t("canli.baslik")}</Metin>
              <Metin tur="kucuk" renk={canli.durum === "aktif" ? "#ffffffdd" : tema.soluk}>
                {canli.durum === "aktif" ? t("canli.aciklama") : canli.baslangic ? t("canli.yakinda", { zaman: new Date(canli.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) }) : ""}
              </Metin>
            </View>
          </View>
          {canli.durum === "aktif" && <Dugme tur="altin" baslik={t("canli.katil")} onPress={() => router.push("/canli")} />}
        </Kart>
      )}

      {ogrenci && oyun && oyun.gorevler.length > 0 && (
        <>
          <Bolum baslik={t("oyun.gorevler")} ikon={CalendarCheck} />
          {[{ ad: t("oyun.gunluk"), liste: gunluk }, { ad: t("oyun.haftalik"), liste: haftalik }].filter((g) => g.liste.length > 0).map((grup, gi) => (
            <Kart key={grup.ad} sira={5 + gi}>
              <Metin tur="etiket" soluk>{grup.ad}</Metin>
              {grup.liste.map((g) => (
                <View key={g.id} style={{ gap: 6, opacity: g.tamamlandi ? 0.65 : 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    {g.tamamlandi ? <CheckCircle2 size={20} color={tema.dogru} /> : <Target size={20} color={tema.soluk} />}
                    <Metin stil={{ flex: 1 }}>{g.baslik}</Metin>
                    <Metin tur="kucuk" soluk>{g.ilerleme}/{g.hedef}</Metin>
                  </View>
                  <Cubuk oran={g.ilerleme / g.hedef} gradyan={g.tamamlandi ? GRADYAN.dogru : undefined} yukseklik={8} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Etiket metin={`+${g.xp} XP`} renk={OYUN.xp} />
                    {g.altin > 0 && <Etiket metin={`+${g.altin}`} renk={OYUN.altinKoyu} ikon={Coins} />}
                  </View>
                </View>
              ))}
            </Kart>
          ))}
        </>
      )}

      {ogrenci && (
        <>
          <Bolum baslik={t("arena.kesfet")} ikon={Layers} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Kisayol sira={7} ikon={Trophy} renk={lig.renk} baslik={t("oyun.lig")} alt={lig.ad} onPress={() => router.push("/lig")} />
            <Kisayol sira={8} ikon={BookMarked} renk="#FF7AB6" baslik={t("arena.hataDefteri")} alt={t("arena.kayit", { n: hatalar.length })} onPress={() => router.push("/hata-defteri")} />
            <Kisayol sira={9} ikon={ShoppingBag} renk={OYUN.altin} baslik={t("oyun.magaza")} onPress={() => router.push("/magaza")} />
            <Kisayol sira={10} ikon={Award} renk={OYUN.xp} baslik={t("oyun.rozetler")} alt={t("arena.kayit", { n: oyun?.rozetler.length ?? 0 })} onPress={() => router.push("/rozetler")} />
            <Kisayol sira={11} ikon={Sparkles} renk={OYUN.elmas} baslik={t("oyun.album")} onPress={() => router.push("/album")} />
          </View>
        </>
      )}
    </Ekran>
  );
}
