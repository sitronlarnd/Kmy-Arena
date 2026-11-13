import {
  AMBLEM_KALKANLARI,
  AMBLEM_RENKLERI,
  AMBLEM_SIMGELERI,
  BOLGELER,
  klanSeviyeEsigi,
  klanUnvani,
  OYUN_AYARLARI,
  type Amblem,
} from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { AmblemRozeti } from "@/bilesenler/AmblemRozeti";
import { Avatar } from "@/bilesenler/Avatar";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { api, ApiHatasi } from "@/lib/api";
import { useOyunYenile } from "@/lib/oyun";
import { useMufredat } from "@/lib/sorgular";
import { useTema } from "@/lib/tema";

type Rol = "lider" | "yardimci" | "uye";
interface KlanOzet { id: string; ad: string; slogan: string | null; amblem: Amblem; seviye: number; kupa: number; katilim_turu: string; uye_sayisi: number; basvurdum: boolean }
interface Uye { kullanici_id: string; takma_ad: string; rol: Rol; haftalik_katki: number; toplam_katki: number; karakter: string | null; seviye: number; ben: boolean }
interface Durum {
  uye: boolean;
  // klansız
  klanlar?: KlanOzet[];
  davetler?: Array<{ id: string; klan_id: string; ad: string; amblem: Amblem; seviye: number }>;
  seviye?: number;
  son7_soru?: number;
  // üye
  rolum?: Rol;
  klan?: { id: string; ad: string; slogan: string | null; amblem: Amblem; seviye: number; katki_toplam: number; kupa: number; katilim_turu: string; onay_durumu: string };
  uyeler?: Uye[];
  gorevler?: Array<{ kod: "toplam_soru" | "herkes_30"; hedef: number; ilerleme: number; odul_altin: number; tamamlandi: boolean }>;
  boss?: { ad: string; emoji: string; can: number; kalan_can: number; yenildi: boolean; kazanim: string; kazanim_kod: string; ders: string; ozellik: string; hasarim: number; en_iyiler: Array<{ takma_ad: string; hasar: number }> } | null;
  savas?: {
    durum: string; baslangic: string; bitis: string; aktif: boolean; rakip: { ad: string; amblem: Amblem; seviye: number };
    bolgeler: Record<string, { ben: number; rakip: number }>; hak_kalan: number; katilan_ben: number; katilan_rakip: number;
    kazandik: boolean | null; berabere: boolean; puan_ben: number | null; puan_rakip: number | null;
  } | null;
  basvurular?: Array<{ id: string; takma_ad: string }>;
}

const KA = OYUN_AYARLARI.klan;

function Cubuk({ oran, renk }: { oran: number; renk: string }) {
  const tema = useTema();
  return (
    <View style={{ height: 10, borderRadius: 5, backgroundColor: tema.kenar, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, oran)) * 100)}%`, height: 10, backgroundColor: renk }} />
    </View>
  );
}

function Cip({ secili, onPress, children }: { secili: boolean; onPress: () => void; children: ReactNode }) {
  const tema = useTema();
  return (
    <Pressable onPress={onPress} accessibilityState={{ selected: secili }} style={{ minHeight: 40, minWidth: 40, paddingHorizontal: 10, justifyContent: "center", alignItems: "center", borderRadius: 20, borderWidth: 2, borderColor: secili ? tema.vurgu : tema.kenar, backgroundColor: tema.yuzey }}>
      {children}
    </Pressable>
  );
}

function sureMetni(ms: number): string {
  const dk = Math.max(0, Math.floor(ms / 60000));
  const s = Math.floor(dk / 60);
  return s >= 24 ? `${Math.floor(s / 24)} g ${s % 24} sa` : s > 0 ? `${s} sa ${dk % 60} dk` : `${dk} dk`;
}

export default function KlanSekmesi() {
  const tema = useTema();
  const qc = useQueryClient();
  const oyunYenile = useOyunYenile();
  const dersler = useMufredat().data ?? [];
  const q = useQuery({
    queryKey: ["klan"],
    queryFn: () => api<Durum>("/api/klan/durum", {}),
    refetchInterval: (s) => (s.state.data?.savas?.aktif ? 15_000 : 60_000),
  });
  const d = q.data;
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [ad, setAd] = useState("");
  const [slogan, setSlogan] = useState("");
  const [amblem, setAmblem] = useState<Amblem>({ kalkan: "klasik", simge: "yildiz", renk: AMBLEM_RENKLERI[0] });
  const [katilim, setKatilim] = useState<"acik" | "basvurulu" | "davet">("acik");
  const [davetAd, setDavetAd] = useState("");
  const [secili, setSecili] = useState<string | null>(null);
  const [ayrilOnay, setAyrilOnay] = useState(false);

  const yap = async (anahtar: string, yol: string, govde: unknown, basari?: string) => {
    setMesgul(anahtar);
    setHata(null);
    setBilgi(null);
    try {
      await api(yol, govde);
      if (basari) setBilgi(basari);
      await qc.invalidateQueries({ queryKey: ["klan"] });
      oyunYenile();
      return true;
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
      return false;
    } finally {
      setMesgul(null);
    }
  };

  const baslik = (m: string) => <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>{m}</Text>;

  if (!d) {
    return (
      <Ekran baslik={t("klan.baslik")}>
        <Text style={{ color: tema.soluk }}>{q.isError ? t("ortak.hata") : t("ortak.yukleniyor")}</Text>
      </Ekran>
    );
  }

  // ── Klansız ──
  if (!d.uye) {
    const kurabilir = (d.seviye ?? 1) >= KA.kurmaMinSeviye && (d.son7_soru ?? 0) >= KA.kurmaMinSoru7Gun;
    return (
      <Ekran baslik={t("klan.baslik")}>
        <Text style={{ color: tema.soluk }}>{t("klan.aciklama")}</Text>
        {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
        {bilgi && <Text style={{ color: tema.dogru }}>{bilgi}</Text>}

        {(d.davetler ?? []).length > 0 && (
          <Kart>
            {baslik(t("klan.davetler"))}
            {(d.davetler ?? []).map((v) => (
              <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AmblemRozeti a={v.amblem} boyut={36} />
                <Text style={{ color: tema.metin, flex: 1, fontWeight: "700" }}>{v.ad}</Text>
                <Dugme baslik={t("klan.kabul")} yukleniyor={mesgul === v.id} onPress={() => void yap(v.id, "/api/klan/basvuru-yanit", { id: v.id, kabul: true })} />
                <Dugme ikincil baslik={t("klan.reddet")} onPress={() => void yap(v.id, "/api/klan/basvuru-yanit", { id: v.id, kabul: false })} />
              </View>
            ))}
          </Kart>
        )}

        <Kart>
          {baslik(`🛡️ ${t("klan.kur")}`)}
          <Text style={{ color: tema.soluk }}>
            {t("klan.kurKosul", { seviye: KA.kurmaMinSeviye, soru: KA.kurmaMinSoru7Gun, benSeviye: d.seviye ?? 1, benSoru: d.son7_soru ?? 0 })}
          </Text>
          {!form ? (
            <Dugme baslik={t("klan.kur")} pasif={!kurabilir} onPress={() => setForm(true)} />
          ) : (
            <>
              <View style={{ alignItems: "center" }}><AmblemRozeti a={amblem} boyut={72} /></View>
              <Alan etiket={t("klan.ad")} value={ad} onChangeText={setAd} maxLength={24} />
              <Alan etiket={t("klan.slogan")} value={slogan} onChangeText={setSlogan} maxLength={60} />
              <Text style={{ color: tema.soluk }}>{t("klan.kalkan")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {AMBLEM_KALKANLARI.filter((k) => k.seviye <= 1).map((k) => (
                  <Cip key={k.kod} secili={amblem.kalkan === k.kod} onPress={() => setAmblem({ ...amblem, kalkan: k.kod })}><Text style={{ color: tema.metin }}>{k.ad}</Text></Cip>
                ))}
              </View>
              <Text style={{ color: tema.soluk }}>{t("klan.simge")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {AMBLEM_SIMGELERI.filter((s) => s.seviye <= 1).map((s) => (
                  <Cip key={s.kod} secili={amblem.simge === s.kod} onPress={() => setAmblem({ ...amblem, simge: s.kod })}><Text style={{ fontSize: 20 }}>{s.emoji}</Text></Cip>
                ))}
              </View>
              <Text style={{ color: tema.soluk }}>{t("klan.renk")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {AMBLEM_RENKLERI.map((r) => (
                  <Pressable key={r} onPress={() => setAmblem({ ...amblem, renk: r })} accessibilityLabel={r}
                    style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r, borderWidth: 3, borderColor: amblem.renk === r ? tema.metin : "transparent" }} />
                ))}
              </View>
              <Text style={{ color: tema.soluk }}>{t("klan.katilimTuru")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["acik", "basvurulu", "davet"] as const).map((k) => (
                  <Cip key={k} secili={katilim === k} onPress={() => setKatilim(k)}><Text style={{ color: tema.metin }}>{t(`klan.katilim_${k}`)}</Text></Cip>
                ))}
              </View>
              <Dugme buyuk baslik={t("klan.olustur")} yukleniyor={mesgul === "kur"} pasif={ad.trim().length < 3}
                onPress={() => void yap("kur", "/api/klan/kur", { ad, slogan, amblem, katilim }).then((ok) => ok && setForm(false))} />
            </>
          )}
        </Kart>

        <Kart>
          {baslik(t("klan.klanlar"))}
          {(d.klanlar ?? []).length === 0 && <Text style={{ color: tema.soluk }}>{t("klan.klanYok")}</Text>}
          {(d.klanlar ?? []).map((k) => (
            <View key={k.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
              <AmblemRozeti a={k.amblem} boyut={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.metin, fontWeight: "700" }}>{k.ad}</Text>
                <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.seviye", { n: k.seviye })} · {t("klan.uyeSayisi", { n: k.uye_sayisi })} · {t("klan.kupa", { n: k.kupa })}</Text>
                {k.slogan && <Text style={{ color: tema.soluk, fontSize: 12, fontStyle: "italic" }}>“{k.slogan}”</Text>}
              </View>
              {k.basvurdum ? (
                <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.basvuruldu")}</Text>
              ) : k.katilim_turu === "davet" ? (
                <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.davetli")}</Text>
              ) : (
                <Dugme baslik={k.katilim_turu === "acik" ? t("klan.katil") : t("klan.basvur")} yukleniyor={mesgul === k.id} pasif={k.uye_sayisi >= KA.uyeMax}
                  onPress={() => void yap(k.id, "/api/klan/katil", { klanId: k.id }, k.katilim_turu === "acik" ? undefined : t("klan.basvuruldu"))} />
              )}
            </View>
          ))}
        </Kart>
      </Ekran>
    );
  }

  // ── Üye ──
  const k = d.klan;
  if (!k) return null;
  const yonetici = d.rolum === "lider" || d.rolum === "yardimci";
  const sonrakiEsik = klanSeviyeEsigi(k.seviye + 1);
  const buEsik = klanSeviyeEsigi(k.seviye);
  const s = d.savas;
  const simdi = Date.now();

  const boss = d.boss;
  return (
    <Ekran baslik={t("klan.baslik")}>
      {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
      {bilgi && <Text style={{ color: tema.dogru }}>{bilgi}</Text>}

      <Kart>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <AmblemRozeti a={k.amblem} boyut={64} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 20 }}>{k.ad}</Text>
            <Text style={{ color: tema.soluk }}>{klanUnvani(k.seviye)} · {t("klan.seviye", { n: k.seviye })} · {t("klan.kupa", { n: k.kupa })}</Text>
            {k.slogan && <Text style={{ color: tema.soluk, fontStyle: "italic" }}>“{k.slogan}”</Text>}
          </View>
        </View>
        <Cubuk oran={(k.katki_toplam - buEsik) / Math.max(1, sonrakiEsik - buEsik)} renk={k.amblem.renk} />
        <Text style={{ color: tema.soluk, fontSize: 12 }}>{k.katki_toplam} / {sonrakiEsik}</Text>
        {k.onay_durumu === "bekliyor" && <Text style={{ color: tema.soluk }}>{t("klan.onayBekliyor")}</Text>}
        <Dugme ikincil baslik={`💬 ${t("klan.sohbet")}`} onPress={() => router.push("/klan-sohbet")} />
      </Kart>

      {d.boss && (
        <Kart stil={{ borderColor: d.boss.yenildi ? tema.dogru : "#E4572E" }}>
          {baslik(`${d.boss.emoji} ${t("klan.boss")}: ${d.boss.ad}`)}
          <Text style={{ color: tema.soluk }}>{d.boss.ders} · {d.boss.kazanim_kod} — {d.boss.kazanim}</Text>
          <Cubuk oran={d.boss.kalan_can / Math.max(1, d.boss.can)} renk="#E4572E" />
          <Text style={{ color: tema.metin }}>❤️ {d.boss.kalan_can} / {d.boss.can} · {t("klan.bossHasarim", { n: d.boss.hasarim })}</Text>
          {d.boss.yenildi ? (
            <Text style={{ color: tema.dogru, fontWeight: "700" }}>{t("klan.bossYenildiKart")}</Text>
          ) : (
            <>
              <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.bossAciklama", { ozellik: t(`profil.ozellik.${d.boss.ozellik}` as MetinAnahtari) })}</Text>
              <Dugme baslik={`⚔️ ${t("klan.bossSaldir")}`} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: boss?.kazanim_kod ?? "", baslik: boss?.ad ?? "" } })} />
            </>
          )}
          {d.boss.en_iyiler.length > 0 && (
            <Text style={{ color: tema.soluk, fontSize: 12 }}>{d.boss.en_iyiler.map((x, i) => `${i + 1}. ${x.takma_ad} (${x.hasar})`).join("  ")}</Text>
          )}
        </Kart>
      )}

      <Kart>
        {baslik(`⚔️ ${t("klan.savas")}`)}
        {!s && <Text style={{ color: tema.soluk }}>{t("klan.savasYok")}</Text>}
        {s && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AmblemRozeti a={k.amblem} boyut={32} />
              <Text style={{ color: tema.metin, fontWeight: "800" }}>vs</Text>
              <AmblemRozeti a={s.rakip.amblem} boyut={32} />
              <Text style={{ color: tema.metin, flex: 1 }}>
                {s.durum === "bitti"
                  ? t("klan.savasBitti", { sonuc: s.berabere ? t("klan.berabere") : s.kazandik ? t("klan.kazandik") : t("klan.kaybettik") })
                  : s.aktif
                    ? t("klan.savasAktif", { ad: s.rakip.ad, sure: sureMetni(Date.parse(s.bitis) - simdi) })
                    : t("klan.savasBekliyor", { ad: s.rakip.ad, zaman: new Date(s.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) })}
              </Text>
            </View>
            {s.aktif && <Text style={{ color: tema.metin, fontWeight: "700" }}>{t("klan.hakKalan", { n: s.hak_kalan })}</Text>}
            <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.katilim", { ben: s.katilan_ben, rakip: s.katilan_rakip })}</Text>
            {BOLGELER.map((b) => {
              const v = s.bolgeler?.[b.kod] ?? { ben: 0, rakip: 0 };
              const top = v.ben + v.rakip;
              const ders = dersler.find((x) => x.ozellik === b.ozellik);
              return (
                <View key={b.kod} style={{ gap: 4, paddingVertical: 4 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: tema.metin }}>{b.emoji} {b.ad}</Text>
                    <Text style={{ color: v.ben > v.rakip ? tema.dogru : v.rakip > v.ben ? tema.yanlis : tema.soluk, fontWeight: "700" }}>{Math.round(v.ben)} – {Math.round(v.rakip)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: tema.kenar }}>
                    <View style={{ flex: top > 0 ? v.ben : 1, backgroundColor: k.amblem.renk }} />
                    <View style={{ flex: top > 0 ? v.rakip : 1, backgroundColor: s.rakip.amblem.renk }} />
                  </View>
                  {s.aktif && s.hak_kalan > 0 && ders && (
                    <Pressable onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", dersKodu: ders.kod, baslik: b.ad } })} accessibilityRole="button">
                      <Text style={{ color: tema.vurgu, fontWeight: "700" }}>{t("klan.bolgeSaldir")} →</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        )}
      </Kart>

      <Kart>
        {baslik(t("klan.gorevler"))}
        {(d.gorevler ?? []).map((g) => (
          <View key={g.kod} style={{ gap: 4 }}>
            <Text style={{ color: tema.metin }}>{g.tamamlandi ? "✅ " : ""}{t(`klan.gorev_${g.kod}`, { hedef: g.hedef })}</Text>
            <Cubuk oran={g.ilerleme / Math.max(1, g.hedef)} renk={g.tamamlandi ? tema.dogru : tema.vurgu} />
            <Text style={{ color: tema.soluk, fontSize: 12 }}>{g.ilerleme}/{g.hedef} · {t("klan.gorevOdul", { altin: g.odul_altin })}</Text>
          </View>
        ))}
      </Kart>

      {yonetici && (d.basvurular ?? []).length > 0 && (
        <Kart>
          {baslik(t("klan.basvurular"))}
          {(d.basvurular ?? []).map((b) => (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: tema.metin, flex: 1 }}>{b.takma_ad}</Text>
              <Dugme baslik={t("klan.kabul")} yukleniyor={mesgul === b.id} onPress={() => void yap(b.id, "/api/klan/basvuru-yanit", { id: b.id, kabul: true })} />
              <Dugme ikincil baslik={t("klan.reddet")} onPress={() => void yap(b.id, "/api/klan/basvuru-yanit", { id: b.id, kabul: false })} />
            </View>
          ))}
        </Kart>
      )}

      <Kart>
        {baslik(`${t("klan.uyeler")} (${(d.uyeler ?? []).length}/${KA.uyeMax})`)}
        {(d.uyeler ?? []).map((u) => (
          <View key={u.kullanici_id}>
            <Pressable onPress={() => setSecili(secili === u.kullanici_id ? null : u.kullanici_id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
              <Avatar tur={u.karakter} seviye={u.seviye} boyut={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.metin, fontWeight: u.ben ? "800" : "600" }}>{u.takma_ad}{u.rol !== "uye" ? ` · ${t(`klan.rol_${u.rol}`)}` : ""}</Text>
                <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("klan.haftalik", { n: u.haftalik_katki })} · Σ {u.toplam_katki}</Text>
              </View>
            </Pressable>
            {secili === u.kullanici_id && yonetici && !u.ben && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 6 }}>
                {d.rolum === "lider" && u.rol === "uye" && <Dugme ikincil baslik={t("klan.yardimciYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "yardimci_yap" })} />}
                {d.rolum === "lider" && u.rol === "yardimci" && <Dugme ikincil baslik={t("klan.uyeYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "uye_yap" })} />}
                {d.rolum === "lider" && <Dugme ikincil baslik={t("klan.liderYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "lider_devret" })} />}
                {(d.rolum === "lider" || u.rol === "uye") && <Dugme ikincil baslik={t("klan.cikar")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "cikar" })} />}
              </View>
            )}
          </View>
        ))}
        {yonetici && (
          <>
            <Alan etiket={t("klan.davetEt")} value={davetAd} onChangeText={setDavetAd} autoCapitalize="none" />
            <Dugme ikincil baslik={t("klan.davetGonder")} pasif={davetAd.trim().length < 3} yukleniyor={mesgul === "davet"}
              onPress={() => void yap("davet", "/api/klan/davet", { takmaAd: davetAd }, t("klan.davetGonderildi")).then((ok) => ok && setDavetAd(""))} />
          </>
        )}
      </Kart>

      <Dugme ikincil baslik={ayrilOnay ? t("klan.ayrilOnay") : t("klan.ayril")} yukleniyor={mesgul === "ayril"}
        onPress={() => (ayrilOnay ? void yap("ayril", "/api/klan/ayril", {}).then(() => setAyrilOnay(false)) : setAyrilOnay(true))} />
    </Ekran>
  );
}
