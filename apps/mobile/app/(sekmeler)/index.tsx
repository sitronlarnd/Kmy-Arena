import { ligAdimi, seviyeIcinXp } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/bilesenler/Avatar";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { useOturum } from "@/lib/oturum";
import { useHataDefteri, useMufredat, useTespitler } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

function Cubuk({ oran, renk }: { oran: number; renk: string }) {
  const tema = useTema();
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: tema.kenar, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, oran)) * 100)}%`, height: 10, backgroundColor: renk }} />
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

  return (
    <Ekran baslik={dershane?.uygulama_ici_ad ?? t("sekmeler.arena")}>
      {ogrenci && !profil.veli_onayi && (
        <Kart>
          <Text style={{ color: tema.metin }}>{t("giris.veliOnayiBekleniyor")}</Text>
        </Kart>
      )}

      {ogrenci && oyun && !oyun.karakter && (
        <Kart stil={{ borderColor: tema.vurgu }}>
          <Text style={{ color: tema.metin, fontWeight: "700", fontSize: 17 }}>{t("oyun.karakterSec")}</Text>
          <Text style={{ color: tema.soluk }}>{t("oyun.karakterAciklama")}</Text>
          <Dugme baslik={t("oyun.karakterSec")} onPress={() => router.push("/karakter")} />
        </Kart>
      )}

      {ogrenci && oyun && (
        <Kart>
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Pressable onPress={() => router.push("/magaza")} accessibilityRole="button" accessibilityLabel={t("oyun.magaza")}>
              <Avatar tur={oyun.karakter?.tur} seviye={seviye} cerceve={oyun.karakter?.cerceve} arkaPlan={oyun.karakter?.arka_plan} kostum={oyun.karakter?.kostum} boyut={64} />
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>
                {profil.takma_ad ?? ""} · {t("arena.seviye", { n: seviye })}
              </Text>
              {oyun.karakter?.unvan && <Text style={{ color: tema.vurgu, fontWeight: "600" }}>{oyun.karakter.unvan}</Text>}
              <Cubuk oran={(oyun.xp - alt) / Math.max(1, ust - alt)} renk={tema.vurgu} />
              <Text style={{ color: tema.soluk, fontSize: 12 }}>{oyun.xp} / {ust} {t("arena.xp")}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: oyun.seriTehlikede ? tema.yanlis : tema.metin, fontWeight: "700" }}>🔥 {t("oyun.seri", { n: oyun.seri })}</Text>
            <Text style={{ color: tema.metin }}>🪙 {oyun.altin}</Text>
            <Text style={{ color: tema.metin }}>🧊 {oyun.dondurucu}</Text>
          </View>
          {oyun.seriTehlikede && <Text style={{ color: tema.yanlis, fontSize: 13 }}>{t("oyun.seriTehlikede")}</Text>}
          <Text style={{ color: tema.soluk, fontSize: 13 }}>{t("oyun.gunlukHedef", { n: Math.min(oyun.gunlukSoru, oyun.gunlukHedef), hedef: oyun.gunlukHedef })}</Text>
          <Cubuk oran={oyun.gunlukSoru / Math.max(1, oyun.gunlukHedef)} renk="#F2711C" />
        </Kart>
      )}

      {ogrenci && mufredat.isSuccess && dersler.length === 0 && (
        <Kart>
          <Text style={{ color: tema.metin }}>{t("soru.paketYok")}</Text>
        </Kart>
      )}

      {dersler.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityLabel={t("arena.dersSec")}>
          {dersler.map((d) => {
            const aktif = secili?.id === d.id;
            return (
              <Pressable
                key={d.id}
                accessibilityRole="button"
                accessibilityState={{ selected: aktif }}
                onPress={() => setDersKodu(d.kod)}
                style={{ minHeight: BOYUT.dokunma, paddingHorizontal: 14, justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: aktif ? tema.vurgu : tema.kenar, backgroundColor: aktif ? tema.vurgu : tema.yuzey }}
              >
                <Text style={{ color: aktif ? "#fff" : tema.metin, fontWeight: "600" }}>{d.ad} · {d.sinav_turu}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {ogrenci && tespitYok && secili && (
        <Kart stil={{ borderColor: tema.vurgu }}>
          <Text style={{ color: tema.metin }}>{t("arena.tespitOneri", { ders: secili.ad })}</Text>
          <Dugme baslik={t("soru.tespitBasla")} onPress={() => router.push({ pathname: "/soru", params: { mod: "tespit", tespitDersKodu: secili.kod } })} />
        </Kart>
      )}

      {ogrenci && canli && canli.durum !== "kapali" && (
        <Kart stil={canli.durum === "aktif" ? { borderColor: "#E4572E" } : undefined}>
          <Text style={{ color: tema.metin, fontWeight: "800" }}>🔴 {t("canli.baslik")}</Text>
          <Text style={{ color: tema.soluk }}>
            {canli.durum === "aktif" ? t("canli.aciklama") : canli.baslangic ? t("canli.yakinda", { zaman: new Date(canli.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) }) : ""}
          </Text>
          {canli.durum === "aktif" && <Dugme baslik={t("canli.katil")} onPress={() => router.push("/canli")} />}
        </Kart>
      )}

      <Dugme
        buyuk
        baslik={t("arena.soruCoz")}
        onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", ...(secili ? { dersKodu: secili.kod, baslik: secili.ad } : {}) } })}
      />
      {vadesiGelen > 0 && <Dugme baslik={t("arena.tekrarZamani", { n: vadesiGelen })} onPress={() => router.push({ pathname: "/soru", params: { mod: "tekrar" } })} />}

      {ogrenci && oyun && oyun.gorevler.length > 0 && (
        <Kart>
          <Text accessibilityRole="header" style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>{t("oyun.gorevler")}</Text>
          {[{ ad: t("oyun.gunluk"), liste: gunluk }, { ad: t("oyun.haftalik"), liste: haftalik }].map((grup) => (
            <View key={grup.ad} style={{ gap: 8 }}>
              <Text style={{ color: tema.soluk, fontSize: 12, fontWeight: "700" }}>{grup.ad.toLocaleUpperCase("tr-TR")}</Text>
              {grup.liste.map((g) => (
                <View key={g.id} style={{ gap: 4, opacity: g.tamamlandi ? 0.6 : 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <Text style={{ color: tema.metin, flex: 1 }}>{g.tamamlandi ? "✅ " : ""}{g.baslik}</Text>
                    <Text style={{ color: tema.soluk, fontSize: 12 }}>{g.ilerleme}/{g.hedef}</Text>
                  </View>
                  <Cubuk oran={g.ilerleme / g.hedef} renk={g.tamamlandi ? tema.dogru : tema.vurgu} />
                  <Text style={{ color: tema.soluk, fontSize: 11 }}>{t("oyun.odul", { xp: g.xp, altin: g.altin })}</Text>
                </View>
              ))}
            </View>
          ))}
        </Kart>
      )}

      {ogrenci && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Dugme ikincil baslik={`🏆 ${t("oyun.lig")} · ${lig.ad}`} onPress={() => router.push("/lig")} />
          <Dugme ikincil baslik={`📓 ${t("arena.hataDefteri")} (${hatalar.length})`} onPress={() => router.push("/hata-defteri")} />
          <Dugme ikincil baslik={`🛍️ ${t("oyun.magaza")}`} onPress={() => router.push("/magaza")} />
          <Dugme ikincil baslik={`🎖️ ${t("oyun.rozetler")} (${oyun?.rozetler.length ?? 0})`} onPress={() => router.push("/rozetler")} />
          <Dugme ikincil baslik={`🃏 ${t("oyun.album")}`} onPress={() => router.push("/album")} />
        </View>
      )}
    </Ekran>
  );
}
