import { seviyeIcinXp } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useOturum } from "@/lib/oturum";
import { useHataDefteri, useIlerleme, useMufredat, useTespitler } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

export default function Arena() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  const ilerleme = useIlerleme().data;
  const dersler = useMufredat().data ?? [];
  const tespitler = useTespitler().data;
  const hatalar = useHataDefteri().data ?? [];
  const [dersKodu, setDersKodu] = useState<string | null>(null);
  const secili = dersKodu ? dersler.find((d) => d.kod === dersKodu) : (dersler[0] ?? null);
  const vadesiGelen = hatalar.filter((h) => h.vadesi_geldi).length;
  const ogrenci = profil?.tur === "ogrenci";

  const seviye = ilerleme?.seviye ?? 1;
  const alt = seviyeIcinXp(seviye);
  const ust = seviyeIcinXp(seviye + 1);
  const oran = ilerleme ? Math.min(1, (ilerleme.xp - alt) / Math.max(1, ust - alt)) : 0;
  const tespitYok = secili && tespitler && !tespitler.get(secili.id)?.bitti;

  return (
    <Ekran baslik={dershane?.uygulama_ici_ad ?? t("sekmeler.arena")}>
      {profil?.takma_ad && <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("arena.merhaba", { ad: profil.takma_ad })}</Text>}
      {ogrenci && !profil.veli_onayi && (
        <Kart>
          <Text style={{ color: tema.metin }}>{t("giris.veliOnayiBekleniyor")}</Text>
        </Kart>
      )}

      {ogrenci && (
        <Kart>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>{t("arena.seviye", { n: seviye })}</Text>
            <Text style={{ color: tema.metin, fontSize: 16 }}>🪙 {ilerleme?.altin ?? 0}  ·  🔥 {ilerleme?.seri_dogru ?? 0}</Text>
          </View>
          <View style={{ height: 10, borderRadius: 5, backgroundColor: tema.kenar, overflow: "hidden" }} accessibilityLabel={`${ilerleme?.xp ?? 0} XP`}>
            <View style={{ width: `${Math.round(oran * 100)}%`, height: 10, backgroundColor: tema.vurgu }} />
          </View>
          <Text style={{ color: tema.soluk, fontSize: 13 }}>{ilerleme?.xp ?? 0} / {ust} {t("arena.xp")}</Text>
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

      <Dugme
        buyuk
        baslik={t("arena.soruCoz")}
        onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", ...(secili ? { dersKodu: secili.kod, baslik: secili.ad } : {}) } })}
      />

      {vadesiGelen > 0 && <Dugme baslik={t("arena.tekrarZamani", { n: vadesiGelen })} onPress={() => router.push({ pathname: "/soru", params: { mod: "tekrar" } })} />}
      <Dugme ikincil baslik={`${t("arena.hataDefteri")} (${hatalar.length})`} onPress={() => router.push("/hata-defteri")} />
    </Ekran>
  );
}
