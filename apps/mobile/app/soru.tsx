import type { CevapYaniti, IpucuYaniti, IstemciSorusu, Sik, SiradakiYaniti, SoruModu } from "@kmy/shared";
import { ROZETLER, SIKLAR } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dugme } from "@/bilesenler/Dugme";
import { Kart } from "@/bilesenler/Kart";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { SeviyeKutlama } from "@/bilesenler/SeviyeKutlama";
import { useOyun } from "@/lib/oyun";
import { api, ApiHatasi } from "@/lib/api";
import { BOYUT, useTema } from "@/lib/tema";

const ANTRENMAN_SORU = 10;
const BEKLEME_SINIRI = 15;

type Ekran =
  | { ad: "yukleniyor" }
  | { ad: "bekle"; deneme: number }
  | { ad: "soru" }
  | { ad: "sonuc"; c: CevapYaniti }
  | { ad: "bilgi"; anahtar: MetinAnahtari }
  | { ad: "ozet" };

function metin(anahtar: string): string {
  return t(anahtar as MetinAnahtari);
}

export default function SoruEkrani() {
  const tema = useTema();
  const sorgu = useQueryClient();
  const p = useLocalSearchParams<{ mod?: string; dersKodu?: string; kazanimKodu?: string; tespitDersKodu?: string; baslik?: string }>();
  const mod: SoruModu = p.mod === "tekrar" || p.mod === "tespit" ? p.mod : "antrenman";

  const [ekran, setEkran] = useState<Ekran>({ ad: "yukleniyor" });
  const [soru, setSoru] = useState<IstemciSorusu | null>(null);
  const [secilen, setSecilen] = useState<Sik | null>(null);
  const [ipuclari, setIpuclari] = useState<string[]>([]);
  const [ipucuVar, setIpucuVar] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bildirildi, setBildirildi] = useState(false);
  const [klanaSoruldu, setKlanaSoruldu] = useState<string | null>(null);
  const [tespit, setTespit] = useState<{ cevaplanan: number; toplam: number } | null>(null);
  const [oturum, setOturum] = useState({ n: 0, dogru: 0, xp: 0, altin: 0 });
  const [gecen, setGecen] = useState(0);
  const [kutlama, setKutlama] = useState<number | null>(null);
  const karakter = useOyun().data?.karakter ?? null;
  const baslangic = useRef(0);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getir = useCallback(
    async (deneme = 0) => {
      setHata(null);
      setEkran(deneme === 0 ? { ad: "yukleniyor" } : { ad: "bekle", deneme });
      try {
        const y = await api<SiradakiYaniti>("/api/soru/siradaki", {
          mod,
          ...(p.dersKodu ? { dersKodu: p.dersKodu } : {}),
          ...(p.kazanimKodu ? { kazanimKodu: p.kazanimKodu } : {}),
          ...(p.tespitDersKodu ? { tespitDersKodu: p.tespitDersKodu } : {}),
        });
        if (y.durum === "soru") {
          setSoru(y.soru);
          setSecilen(null);
          setIpuclari([]);
          setIpucuVar(y.soru.ipucuVar && mod !== "tespit");
          setBildirildi(false);
          setTespit(y.tespit ?? null);
          baslangic.current = Date.now();
          setGecen(0);
          setEkran({ ad: "soru" });
        } else if (y.durum === "hazirlaniyor") {
          if (deneme >= BEKLEME_SINIRI) {
            setEkran({ ad: "bilgi", anahtar: "soru.yedekMod" });
            return;
          }
          setEkran({ ad: "bekle", deneme: deneme + 1 });
          zamanlayici.current = setTimeout(() => void getir(deneme + 1), y.tekrarDeneMs);
        } else if (y.durum === "tekrar_yok") {
          setEkran(oturum.n > 0 ? { ad: "ozet" } : { ad: "bilgi", anahtar: "soru.tekrarYok" });
        } else if (y.durum === "tespit_bitti") {
          setEkran({ ad: "bilgi", anahtar: oturum.n > 0 ? "soru.tespitSonuc" : "soru.tespitBitti" });
        } else {
          setEkran({ ad: "bilgi", anahtar: "soru.yedekMod" });
        }
      } catch (h) {
        setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
        setEkran({ ad: "bilgi", anahtar: "ortak.hata" });
      }
    },
    [mod, p.dersKodu, p.kazanimKodu, p.tespitDersKodu, oturum.n],
  );

  useEffect(() => {
    void getir(0);
    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    };
    // Yalnızca ilk açılışta
  }, []);

  useEffect(() => {
    if (ekran.ad !== "soru") return;
    const i = setInterval(() => setGecen(Math.floor((Date.now() - baslangic.current) / 1000)), 1000);
    return () => clearInterval(i);
  }, [ekran.ad]);

  const cevapla = async (bos: boolean) => {
    if (!soru || gonderiyor) return;
    setGonderiyor(true);
    setHata(null);
    try {
      const c = await api<CevapYaniti>("/api/soru/cevap", { soruId: soru.id, secilen: bos ? null : secilen, sureMs: Date.now() - baslangic.current });
      setOturum((o) => ({ n: o.n + 1, dogru: o.dogru + (c.sonuc === "dogru" ? 1 : 0), xp: o.xp + c.xp, altin: o.altin + c.altin }));
      setEkran({ ad: "sonuc", c });
      if (c.seviyeAtladi) setKutlama(c.seviye);
      void sorgu.invalidateQueries({ queryKey: ["oyun"] });
      void sorgu.invalidateQueries({ queryKey: ["ilerleme"] });
      void sorgu.invalidateQueries({ queryKey: ["beceri"] });
      void sorgu.invalidateQueries({ queryKey: ["hata-defteri"] });
      void sorgu.invalidateQueries({ queryKey: ["tespit"] });
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    } finally {
      setGonderiyor(false);
    }
  };

  const ipucuIste = async () => {
    if (!soru) return;
    try {
      const y = await api<IpucuYaniti>("/api/soru/ipucu", { soruId: soru.id });
      setIpuclari((l) => [...l, y.ipucu]);
      setIpucuVar(y.kalan > 0 && y.sira < 3);
    } catch (h) {
      setIpucuVar(false);
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const hataBildir = async () => {
    if (!soru || bildirildi) return;
    try {
      await api("/api/soru/hata-bildir", { soruId: soru.id });
      setBildirildi(true);
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const klanaSor = async () => {
    if (!soru || klanaSoruldu === soru.id) return;
    try {
      await api("/api/klan/mesaj", { tur: "soru", soruId: soru.id });
      setKlanaSoruldu(soru.id);
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const sonraki = () => {
    if (ekran.ad === "sonuc" && ekran.c.tespitBitti) {
      setEkran({ ad: "bilgi", anahtar: "soru.tespitSonuc" });
      return;
    }
    if (mod === "antrenman" && oturum.n >= ANTRENMAN_SORU) {
      setEkran({ ad: "ozet" });
      return;
    }
    void getir(0);
  };

  const baslik = mod === "tespit" ? t("soru.tespitBaslik") : mod === "tekrar" ? t("arena.hataDefteri") : (p.baslik ?? t("arena.soruCoz"));
  const sayac =
    mod === "tespit" && tespit
      ? t("soru.soruSayaci", { n: Math.min(tespit.cevaplanan + 1, tespit.toplam), toplam: tespit.toplam })
      : mod === "antrenman"
        ? t("soru.soruSayaci", { n: Math.min(oturum.n + 1, ANTRENMAN_SORU), toplam: ANTRENMAN_SORU })
        : null;
  const sikHarfleri = soru ? SIKLAR.filter((h) => soru.siklar[h] !== undefined) : [];
  const sonuc = ekran.ad === "sonuc" ? ekran.c : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }} edges={["bottom"]}>
      <SeviyeKutlama seviye={kutlama} karakter={karakter} kapat={() => setKutlama(null)} />
      <Stack.Screen options={{ headerShown: true, title: baslik, headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {(ekran.ad === "yukleniyor" || ekran.ad === "bekle") && (
          <View style={{ alignItems: "center", gap: 12, paddingTop: 60 }}>
            <ActivityIndicator color={tema.vurgu} size="large" />
            <Text style={{ color: tema.soluk, fontSize: BOYUT.govde, textAlign: "center" }}>
              {ekran.ad === "bekle" ? t("soru.hazirlaniyor") : t("soru.yukleniyor")}
            </Text>
          </View>
        )}

        {ekran.ad === "bilgi" && (
          <View style={{ gap: 16, paddingTop: 40 }}>
            <Text style={{ color: tema.metin, fontSize: 18, textAlign: "center" }}>{hata ?? t(ekran.anahtar)}</Text>
            {oturum.n > 0 && <Text style={{ color: tema.soluk, textAlign: "center" }}>{t("soru.dogruSayisi", { dogru: oturum.dogru, toplam: oturum.n })}</Text>}
            {ekran.anahtar === "ortak.hata" && <Dugme baslik={t("ortak.yenidenDene")} onPress={() => void getir(0)} />}
            <Dugme ikincil baslik={t("soru.kapat")} onPress={() => router.back()} />
          </View>
        )}

        {ekran.ad === "ozet" && (
          <Kart>
            <Text style={{ color: tema.metin, fontSize: 22, fontWeight: "800" }}>{t("soru.oturumOzeti")}</Text>
            <Text style={{ color: tema.metin, fontSize: 18 }}>{t("soru.dogruSayisi", { dogru: oturum.dogru, toplam: oturum.n })}</Text>
            <Text style={{ color: tema.vurgu, fontSize: 18, fontWeight: "700" }}>{t("soru.odul", { xp: oturum.xp, altin: oturum.altin })}</Text>
            <Dugme baslik={t("soru.sonraki")} onPress={() => { setOturum({ n: 0, dogru: 0, xp: 0, altin: 0 }); void getir(0); }} />
            <Dugme ikincil baslik={t("soru.bitir")} onPress={() => router.back()} />
          </Kart>
        )}

        {soru && (ekran.ad === "soru" || ekran.ad === "sonuc") && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <Text style={{ color: tema.soluk, fontSize: 13, flexShrink: 1 }}>{soru.ders} · {soru.kazanimKodu}</Text>
              <Text style={{ color: tema.soluk, fontSize: 13 }}>
                {sayac ? `${sayac} · ` : ""}{ekran.ad === "soru" ? `${Math.floor(gecen / 60)}:${String(gecen % 60).padStart(2, "0")}` : ""}
              </Text>
            </View>
            <Kart>
              <MatematikMetni md={soru.govdeMd} renk={tema.metin} boyut={BOYUT.soruMetni} />
              {soru.aiUretimi && <Text style={{ color: tema.soluk, fontSize: 11 }}>{t("ortak.aiEtiketi")}</Text>}
            </Kart>

            <View style={{ gap: 10 }} accessibilityRole="radiogroup">
              {sikHarfleri.map((h) => {
                const secili = secilen === h;
                const dogruSik = sonuc?.dogru === h;
                const yanlisSecim = sonuc && secili && !dogruSik;
                const kenar = dogruSik ? tema.dogru : yanlisSecim ? tema.yanlis : secili ? tema.vurgu : tema.kenar;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: secili, disabled: Boolean(sonuc) }}
                    accessibilityLabel={`${h} şıkkı`}
                    disabled={Boolean(sonuc) || gonderiyor}
                    onPress={() => setSecilen(h)}
                    style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 52, padding: 12, borderRadius: BOYUT.yaricap, borderWidth: 2, borderColor: kenar, backgroundColor: tema.yuzey }}
                  >
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: secili || dogruSik ? kenar : tema.zemin }}>
                      <Text style={{ fontWeight: "800", color: secili || dogruSik ? "#fff" : tema.metin }}>{h}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <MatematikMetni md={soru.siklar[h] ?? ""} renk={tema.metin} boyut={BOYUT.govde} />
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {ipuclari.map((ip, i) => (
              <Kart key={i} stil={{ borderColor: tema.vurgu }}>
                <Text style={{ color: tema.vurgu, fontWeight: "700" }}>{t("soru.ipucu", { n: i + 1 })}</Text>
                <MatematikMetni md={ip} renk={tema.metin} boyut={BOYUT.govde} />
              </Kart>
            ))}

            {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}

            {ekran.ad === "soru" && (
              <View style={{ gap: 10 }}>
                <Dugme baslik={t("soru.cevapla")} onPress={() => void cevapla(false)} yukleniyor={gonderiyor} pasif={!secilen} />
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  {ipucuVar && <Dugme ikincil baslik={t("soru.ipucu", { n: ipuclari.length + 1 })} onPress={() => void ipucuIste()} />}
                  <Dugme ikincil baslik={t("soru.bosBirak")} onPress={() => void cevapla(true)} />
                </View>
                {ipucuVar && ipuclari.length === 0 && <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("soru.ipucuNot")}</Text>}
              </View>
            )}

            {sonuc && (
              <View style={{ gap: 12 }}>
                <Kart stil={{ borderColor: sonuc.sonuc === "dogru" ? tema.dogru : tema.yanlis }}>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: sonuc.sonuc === "dogru" ? tema.dogru : tema.yanlis }}>
                    {sonuc.sonuc === "dogru" ? t("soru.dogru") : sonuc.sonuc === "bos" ? t("soru.bos") : t("soru.yanlis")}
                  </Text>
                  {sonuc.sonuc !== "dogru" && <Text style={{ color: tema.metin }}>{t("soru.dogruCevap", { sik: sonuc.dogru })}</Text>}
                  {sonuc.xp > 0 && <Text style={{ color: tema.vurgu, fontWeight: "700", fontSize: 16 }}>{t("soru.odul", { xp: sonuc.xp, altin: sonuc.altin })}</Text>}
                  {sonuc.seviyeAtladi && <Text style={{ color: tema.vurgu, fontWeight: "800", fontSize: 18 }}>{t("soru.seviyeAtladin", { seviye: sonuc.seviye })}</Text>}
                  {sonuc.sayilmadi && <Text style={{ color: tema.soluk }}>{t("soru.hizliCevap")}</Text>}
                  {sonuc.hataDefteri === "eklendi" && <Text style={{ color: tema.soluk }}>{t("soru.hataDefterineEklendi")}</Text>}
                  {sonuc.hataDefteri === "ilerledi" && <Text style={{ color: tema.soluk }}>{t("soru.tekrarIlerledi")}</Text>}
                  {sonuc.hataDefteri === "temizlendi" && <Text style={{ color: tema.dogru }}>{t("soru.temizlendi")}</Text>}
                  {sonuc.hataDefteri === "basa_dondu" && <Text style={{ color: tema.soluk }}>{t("soru.basaDondu")}</Text>}
                </Kart>
                {sonuc.oyun && (sonuc.oyun.hedefTamam || sonuc.oyun.tamamlananGorevler.length > 0 || sonuc.oyun.yeniRozetler.length > 0) && (
                  <Kart stil={{ borderColor: tema.vurgu }}>
                    {sonuc.oyun.hedefTamam && <Text style={{ color: tema.metin, fontWeight: "700" }}>🎯 {t("oyun.hedefTamam")}</Text>}
                    {sonuc.oyun.seriDurum === "artti" && <Text style={{ color: tema.metin }}>{t("oyun.seriArtti", { n: sonuc.oyun.seriGun })}</Text>}
                    {sonuc.oyun.seriDurum === "donduruldu" && <Text style={{ color: tema.metin }}>🧊 {t("oyun.seriDonduruldu", { n: sonuc.oyun.seriGun })}</Text>}
                    {sonuc.oyun.seriDurum === "sifirlandi" && <Text style={{ color: tema.metin }}>{t("oyun.seriSifirlandi")}</Text>}
                    {sonuc.oyun.tamamlananGorevler.map((g) => (
                      <Text key={g.kod} style={{ color: tema.dogru, fontWeight: "600" }}>✅ {t("oyun.gorevTamam", { baslik: g.baslik })} · {t("oyun.odul", { xp: g.xp, altin: g.altin })}</Text>
                    ))}
                    {sonuc.oyun.yeniRozetler.map((kod) => {
                      const rz = ROZETLER.find((x) => x.kod === kod);
                      return <Text key={kod} style={{ color: tema.vurgu, fontWeight: "700" }}>{rz?.emoji ?? "🎖️"} {t("oyun.yeniRozet", { ad: rz?.ad ?? kod })}</Text>;
                    })}
                  </Kart>
                )}
                {sonuc.oyun?.klan && (sonuc.oyun.klan.boss || (sonuc.oyun.klan.savas && sonuc.oyun.klan.savas.etki > 0) || sonuc.oyun.klan.tamamlananGorevler.length > 0 || sonuc.oyun.klan.seviyeAtladi) && (
                  <Kart>
                    {sonuc.oyun.klan.boss && (
                      <Text style={{ color: tema.metin, fontWeight: "700" }}>
                        {sonuc.oyun.klan.boss.yenildi ? t("klan.bossYenildi", { ad: sonuc.oyun.klan.boss.ad }) : t("klan.bossHasar", { n: sonuc.oyun.klan.boss.hasar, kalan: sonuc.oyun.klan.boss.kalan_can })}
                      </Text>
                    )}
                    {sonuc.oyun.klan.savas && sonuc.oyun.klan.savas.etki > 0 && (
                      <Text style={{ color: tema.metin }}>{t("klan.savasEtki", { n: Math.round(sonuc.oyun.klan.savas.etki), hak: sonuc.oyun.klan.savas.hak_kalan })}</Text>
                    )}
                    {sonuc.oyun.klan.tamamlananGorevler.map((g) => (
                      <Text key={g} style={{ color: tema.dogru, fontWeight: "600" }}>✅ {t(`klan.gorev_${g === "toplam_soru" ? "toplam_soru" : "herkes_30"}`, { hedef: "" })}</Text>
                    ))}
                    {sonuc.oyun.klan.seviyeAtladi && <Text style={{ color: tema.vurgu, fontWeight: "700" }}>{t("klan.seviyeAtladi", { n: sonuc.oyun.klan.seviye })}</Text>}
                  </Kart>
                )}
                {sonuc.celdiriciNotu && secilen && (
                  <Kart>
                    <Text style={{ color: tema.metin, fontWeight: "700" }}>{t("soru.neden", { sik: secilen })}</Text>
                    <MatematikMetni md={sonuc.celdiriciNotu} renk={tema.metin} boyut={BOYUT.govde} />
                  </Kart>
                )}
                {sonuc.cozumAdimlari.length > 0 && (
                  <Kart>
                    <Text style={{ color: tema.metin, fontWeight: "700" }}>{t("soru.cozum")}</Text>
                    {sonuc.cozumAdimlari.map((a, i) => (
                      <MatematikMetni key={i} md={a} renk={tema.metin} boyut={BOYUT.govde} />
                    ))}
                  </Kart>
                )}
                <Dugme baslik={sonuc.tespitBitti ? t("soru.bitir") : t("soru.sonraki")} onPress={sonraki} />
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Dugme ikincil baslik={bildirildi ? t("soru.hataBildirildi") : t("soru.hataBildir")} onPress={() => void hataBildir()} />
                  {sonuc.oyun?.klan && (
                    <Dugme ikincil baslik={klanaSoruldu === soru?.id ? t("soru.klanaSoruldu") : t("soru.klanaSor")} onPress={() => void klanaSor()} />
                  )}
                  <Dugme ikincil baslik={t("soru.bitir")} onPress={() => (oturum.n > 0 && mod === "antrenman" ? setEkran({ ad: "ozet" }) : router.back())} />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
