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
import {
  Anchor, Check, CheckCircle2, Coins, Crown, FlaskConical, Landmark, LogOut, MessageCircle, Mountain, Send, Shield, ShieldPlus, Swords, Target, Trophy, UserMinus, UserPlus, Users, type LucideIcon,
} from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { AmblemRozeti } from "@/bilesenler/AmblemRozeti";
import { Ekran } from "@/bilesenler/Ekran";
import { AMBLEM_IKONLARI, Avatar, Boss } from "@/bilesenler/sanat";
import { Basilabilir, Bolum, Cip, Cubuk, Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { useOyunYenile } from "@/lib/oyun";
import { useMufredat } from "@/lib/sorgular";
import { GRADYAN, OYUN, useTema } from "@/lib/tema";

const BOLGE_IKON: Record<string, LucideIcon> = { mat: Landmark, fen: FlaskConical, turkce: Mountain, sosyal: Shield, ingilizce: Anchor };

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

  if (!d) {
    return (
      <Ekran baslik={t("klan.baslik")}>
        <Metin soluk>{q.isError ? t("ortak.hata") : t("ortak.yukleniyor")}</Metin>
      </Ekran>
    );
  }

  // ── Klansız ──
  if (!d.uye) {
    const kurabilir = (d.seviye ?? 1) >= KA.kurmaMinSeviye && (d.son7_soru ?? 0) >= KA.kurmaMinSoru7Gun;
    return (
      <Ekran baslik={t("klan.baslik")} altBaslik={t("klan.aciklama")}>
        {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
        {bilgi && <Metin renk={tema.dogru}>{bilgi}</Metin>}

        {(d.davetler ?? []).length > 0 && (
          <Kart vurgu={OYUN.altin} sira={0}>
            <Bolum baslik={t("klan.davetler")} ikon={UserPlus} />
            {(d.davetler ?? []).map((v) => (
              <View key={v.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AmblemRozeti a={v.amblem} boyut={44} />
                <Metin tur="altbaslik" stil={{ flex: 1 }}>{v.ad}</Metin>
                <Dugme kucuk genis={false} ikon={Check} baslik={t("klan.kabul")} yukleniyor={mesgul === v.id} onPress={() => void yap(v.id, "/api/klan/basvuru-yanit", { id: v.id, kabul: true })} />
                <Dugme kucuk genis={false} tur="hayalet" baslik={t("klan.reddet")} onPress={() => void yap(v.id, "/api/klan/basvuru-yanit", { id: v.id, kabul: false })} />
              </View>
            ))}
          </Kart>
        )}

        <Kart gradyan={GRADYAN.vurgu} sira={1}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" }}>
              <ShieldPlus size={32} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Metin tur="altbaslik" renk="#fff">{t("klan.kur")}</Metin>
              <Metin tur="kucuk" renk="#ffffffcc">{t("klan.kurKosul", { seviye: KA.kurmaMinSeviye, soru: KA.kurmaMinSoru7Gun, benSeviye: d.seviye ?? 1, benSoru: d.son7_soru ?? 0 })}</Metin>
            </View>
          </View>
          {!form && <Dugme tur="altin" baslik={t("klan.kur")} pasif={!kurabilir} onPress={() => setForm(true)} />}
        </Kart>

        {form && (
          <Kart sira={2}>
            <View style={{ alignItems: "center", paddingVertical: 6 }}><AmblemRozeti a={amblem} boyut={96} /></View>
            <Alan etiket={t("klan.ad")} value={ad} onChangeText={setAd} maxLength={24} />
            <Alan etiket={t("klan.slogan")} value={slogan} onChangeText={setSlogan} maxLength={60} />
            <Metin tur="etiket" soluk>{t("klan.kalkan")}</Metin>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {AMBLEM_KALKANLARI.filter((k) => k.seviye <= 1).map((k) => (
                <Cip key={k.kod} baslik={k.ad} secili={amblem.kalkan === k.kod} onPress={() => setAmblem({ ...amblem, kalkan: k.kod })} />
              ))}
            </View>
            <Metin tur="etiket" soluk>{t("klan.simge")}</Metin>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {AMBLEM_SIMGELERI.filter((s) => s.seviye <= 1).map((s) => {
                const Ikon = AMBLEM_IKONLARI[s.kod] ?? Shield;
                const secili = amblem.simge === s.kod;
                return (
                  <Basilabilir key={s.kod} onPress={() => setAmblem({ ...amblem, simge: s.kod })} secili={secili} etiket={s.kod}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: secili ? amblem.renk : tema.kenar, backgroundColor: secili ? `${amblem.renk}33` : tema.yuzey2 }}>
                      <Ikon size={22} color={secili ? amblem.renk : tema.soluk} />
                    </View>
                  </Basilabilir>
                );
              })}
            </View>
            <Metin tur="etiket" soluk>{t("klan.renk")}</Metin>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {AMBLEM_RENKLERI.map((r) => (
                <Basilabilir key={r} onPress={() => setAmblem({ ...amblem, renk: r })} etiket={r} secili={amblem.renk === r}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: r, borderWidth: 3, borderColor: amblem.renk === r ? tema.metin : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {amblem.renk === r && <Check size={18} color="#fff" strokeWidth={3} />}
                  </View>
                </Basilabilir>
              ))}
            </View>
            <Metin tur="etiket" soluk>{t("klan.katilimTuru")}</Metin>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(["acik", "basvurulu", "davet"] as const).map((k) => (
                <Cip key={k} baslik={t(`klan.katilim_${k}`)} secili={katilim === k} onPress={() => setKatilim(k)} />
              ))}
            </View>
            <Dugme buyuk ikon={ShieldPlus} baslik={t("klan.olustur")} yukleniyor={mesgul === "kur"} pasif={ad.trim().length < 3}
              onPress={() => void yap("kur", "/api/klan/kur", { ad, slogan, amblem, katilim }).then((ok) => ok && setForm(false))} />
          </Kart>
        )}

        <Bolum baslik={t("klan.klanlar")} ikon={Users} />
        {(d.klanlar ?? []).length === 0 && <Metin soluk>{t("klan.klanYok")}</Metin>}
        {(d.klanlar ?? []).map((k, i) => (
          <Kart key={k.id} sira={3 + i} vurgu={k.amblem.renk}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <AmblemRozeti a={k.amblem} boyut={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Metin tur="altbaslik">{k.ad}</Metin>
                {k.slogan && <Metin tur="kucuk" soluk numberOfLines={1}>“{k.slogan}”</Metin>}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  <Etiket metin={t("klan.seviye", { n: k.seviye })} renk={OYUN.xp} />
                  <Etiket metin={t("klan.uyeSayisi", { n: k.uye_sayisi })} renk={tema.soluk} ikon={Users} />
                  <Etiket metin={String(k.kupa)} renk={OYUN.kupa} ikon={Trophy} />
                </View>
              </View>
            </View>
            {k.basvurdum ? (
              <Etiket metin={t("klan.basvuruldu")} renk={OYUN.altin} />
            ) : k.katilim_turu === "davet" ? (
              <Etiket metin={t("klan.davetli")} renk={tema.soluk} />
            ) : (
              <Dugme kucuk baslik={k.katilim_turu === "acik" ? t("klan.katil") : t("klan.basvur")} yukleniyor={mesgul === k.id} pasif={k.uye_sayisi >= KA.uyeMax}
                onPress={() => void yap(k.id, "/api/klan/katil", { klanId: k.id }, k.katilim_turu === "acik" ? undefined : t("klan.basvuruldu"))} />
            )}
          </Kart>
        ))}
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
    <Ekran baslik={t("klan.baslik")} baslikGizli>
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      {bilgi && <Metin renk={tema.dogru}>{bilgi}</Metin>}

      {/* Klan başlığı: amblem renginden degrade */}
      <Kart gradyan={[`${k.amblem.renk}`, "#141631"]} sira={0}>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <AmblemRozeti a={k.amblem} boyut={80} />
          <View style={{ flex: 1, gap: 4 }}>
            <Metin tur="baslik" renk="#fff">{k.ad}</Metin>
            <Metin tur="kucuk" renk="#ffffffcc">{klanUnvani(k.seviye)}</Metin>
            {k.slogan && <Metin tur="kucuk" renk="#ffffffaa" stil={{ fontStyle: "italic" }}>“{k.slogan}”</Metin>}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Etiket metin={t("klan.seviye", { n: k.seviye })} renk="#fff" />
          <Etiket metin={String(k.kupa)} renk={OYUN.altin} ikon={Trophy} />
          <Etiket metin={String((d.uyeler ?? []).length)} renk="#fff" ikon={Users} />
        </View>
        <Cubuk oran={(k.katki_toplam - buEsik) / Math.max(1, sonrakiEsik - buEsik)} gradyan={GRADYAN.altin} parilti />
        <Metin tur="kucuk" renk="#ffffffaa">{k.katki_toplam} / {sonrakiEsik}</Metin>
        {k.onay_durumu === "bekliyor" && <Metin tur="kucuk" renk="#fff">{t("klan.onayBekliyor")}</Metin>}
        <Dugme tur="ikincil" ikon={MessageCircle} baslik={t("klan.sohbet")} onPress={() => router.push("/klan-sohbet")} />
      </Kart>

      {/* Boss */}
      {boss && (
        <Kart gradyan={boss.yenildi ? ["#12382A", "#141631"] : ["#3D1230", "#141631"]} sira={1}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Boss ozellik={boss.ozellik} boyut={96} yenildi={boss.yenildi} />
            <View style={{ flex: 1, gap: 4 }}>
              <Metin tur="etiket" renk={OYUN.boss}>{t("klan.boss")}</Metin>
              <Metin tur="altbaslik" renk="#fff">{boss.ad}</Metin>
              <Metin tur="kucuk" renk="#ffffffaa" numberOfLines={2}>{boss.ders} · {boss.kazanim_kod}</Metin>
            </View>
          </View>
          <Cubuk oran={boss.kalan_can / Math.max(1, boss.can)} gradyan={GRADYAN.boss} yukseklik={14} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Metin tur="kucuk" renk="#fff">{boss.kalan_can} / {boss.can}</Metin>
            <Metin tur="kucuk" renk={OYUN.altin}>{t("klan.bossHasarim", { n: boss.hasarim })}</Metin>
          </View>
          {boss.yenildi ? (
            <Etiket metin={t("klan.bossYenildiKart")} renk={tema.dogru} ikon={CheckCircle2} />
          ) : (
            <>
              <Metin tur="kucuk" renk="#ffffffaa">{t("klan.bossAciklama", { ozellik: t(`profil.ozellik.${boss.ozellik}` as MetinAnahtari) })}</Metin>
              <Dugme tur="ates" ikon={Swords} baslik={t("klan.bossSaldir")} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: boss.kazanim_kod, baslik: boss.ad } })} />
            </>
          )}
          {boss.en_iyiler.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {boss.en_iyiler.map((x, i) => (
                <Etiket key={x.takma_ad} metin={`${i + 1}. ${x.takma_ad} · ${x.hasar}`} renk={i === 0 ? OYUN.altin : "#ffffffaa"} ikon={i === 0 ? Crown : undefined} />
              ))}
            </View>
          )}
        </Kart>
      )}

      {/* Savaş */}
      <Bolum baslik={t("klan.savas")} ikon={Swords} />
      <Kart sira={2}>
        {!s && <Metin soluk>{t("klan.savasYok")}</Metin>}
        {s && (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <AmblemRozeti a={k.amblem} boyut={44} />
              <Metin tur="altbaslik" renk={OYUN.altin}>VS</Metin>
              <AmblemRozeti a={s.rakip.amblem} boyut={44} />
              <View style={{ flex: 1 }}>
                <Metin tur="altbaslik" numberOfLines={1}>{s.rakip.ad}</Metin>
                <Metin tur="kucuk" soluk>
                  {s.durum === "bitti"
                    ? t("klan.savasBitti", { sonuc: s.berabere ? t("klan.berabere") : s.kazandik ? t("klan.kazandik") : t("klan.kaybettik") })
                    : s.aktif
                      ? t("klan.savasKalan", { sure: sureMetni(Date.parse(s.bitis) - simdi) })
                      : t("klan.savasBaslar", { zaman: new Date(s.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) })}
                </Metin>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {s.aktif && <Etiket metin={t("klan.hakKalan", { n: s.hak_kalan })} renk={OYUN.ates} ikon={Target} />}
              <Etiket metin={t("klan.katilim", { ben: s.katilan_ben, rakip: s.katilan_rakip })} renk={tema.soluk} ikon={Users} />
            </View>
            {BOLGELER.map((b) => {
              const v = s.bolgeler?.[b.kod] ?? { ben: 0, rakip: 0 };
              const top = v.ben + v.rakip;
              const ders = dersler.find((x) => x.ozellik === b.ozellik);
              const Ikon = BOLGE_IKON[b.kod] ?? Shield;
              const bizim = v.ben > v.rakip;
              return (
                <View key={b.kod} style={{ gap: 6, paddingVertical: 6 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <IkonKutu ikon={Ikon} renk={bizim ? k.amblem.renk : v.rakip > v.ben ? s.rakip.amblem.renk : tema.soluk} boyut={34} />
                    <Metin stil={{ flex: 1 }}>{b.ad}</Metin>
                    <Metin tur="altbaslik" renk={bizim ? tema.dogru : v.rakip > v.ben ? tema.yanlis : tema.soluk}>{Math.round(v.ben)} – {Math.round(v.rakip)}</Metin>
                  </View>
                  <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: tema.kenar }}>
                    <View style={{ flex: top > 0 ? v.ben : 1, backgroundColor: k.amblem.renk }} />
                    <View style={{ flex: top > 0 ? v.rakip : 1, backgroundColor: s.rakip.amblem.renk }} />
                  </View>
                  {s.aktif && s.hak_kalan > 0 && ders && (
                    <Pressable onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", dersKodu: ders.kod, baslik: b.ad } })} accessibilityRole="button">
                      <Metin tur="kucuk" renk={tema.vurgu}>{t("klan.bolgeSaldir")} →</Metin>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </>
        )}
      </Kart>

      <Bolum baslik={t("klan.gorevler")} ikon={Target} />
      <Kart sira={3}>
        {(d.gorevler ?? []).map((g) => (
          <View key={g.kod} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {g.tamamlandi ? <CheckCircle2 size={20} color={tema.dogru} /> : <Target size={20} color={tema.soluk} />}
              <Metin stil={{ flex: 1 }}>{t(`klan.gorev_${g.kod}`, { hedef: g.hedef })}</Metin>
              <Metin tur="kucuk" soluk>{g.ilerleme}/{g.hedef}</Metin>
            </View>
            <Cubuk oran={g.ilerleme / Math.max(1, g.hedef)} gradyan={g.tamamlandi ? GRADYAN.dogru : undefined} yukseklik={8} />
            <Etiket metin={`+${g.odul_altin}`} renk={OYUN.altinKoyu} ikon={Coins} />
          </View>
        ))}
      </Kart>

      {yonetici && (d.basvurular ?? []).length > 0 && (
        <Kart vurgu={OYUN.altin} sira={4}>
          <Bolum baslik={t("klan.basvurular")} ikon={UserPlus} />
          {(d.basvurular ?? []).map((b) => (
            <View key={b.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Metin stil={{ flex: 1 }}>{b.takma_ad}</Metin>
              <Dugme kucuk genis={false} ikon={Check} baslik={t("klan.kabul")} yukleniyor={mesgul === b.id} onPress={() => void yap(b.id, "/api/klan/basvuru-yanit", { id: b.id, kabul: true })} />
              <Dugme kucuk genis={false} tur="hayalet" baslik={t("klan.reddet")} onPress={() => void yap(b.id, "/api/klan/basvuru-yanit", { id: b.id, kabul: false })} />
            </View>
          ))}
        </Kart>
      )}

      <Bolum baslik={`${t("klan.uyeler")} · ${(d.uyeler ?? []).length}/${KA.uyeMax}`} ikon={Users} />
      <Kart sira={5}>
        {(d.uyeler ?? []).map((u, i) => (
          <View key={u.kullanici_id}>
            <Basilabilir onPress={() => setSecili(secili === u.kullanici_id ? null : u.kullanici_id)} etiket={u.takma_ad} olcek={0.98}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                <Metin tur="kucuk" soluk stil={{ width: 18 }}>{i + 1}</Metin>
                <Avatar tur={u.karakter} seviye={u.seviye} boyut={40} aura={false} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Metin tur={u.ben ? "altbaslik" : "govde"} stil={{ fontSize: 15 }}>{u.takma_ad}</Metin>
                    {u.rol === "lider" && <Crown size={14} color={OYUN.altin} fill={OYUN.altin} />}
                    {u.rol === "yardimci" && <Shield size={14} color={OYUN.buz} />}
                  </View>
                  <Metin tur="kucuk" soluk>{t("klan.haftalik", { n: u.haftalik_katki })} · Σ {u.toplam_katki}</Metin>
                </View>
              </View>
            </Basilabilir>
            {secili === u.kullanici_id && yonetici && !u.ben && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 }}>
                {d.rolum === "lider" && u.rol === "uye" && <Dugme kucuk genis={false} tur="ikincil" ikon={Shield} baslik={t("klan.yardimciYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "yardimci_yap" })} />}
                {d.rolum === "lider" && u.rol === "yardimci" && <Dugme kucuk genis={false} tur="ikincil" baslik={t("klan.uyeYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "uye_yap" })} />}
                {d.rolum === "lider" && <Dugme kucuk genis={false} tur="ikincil" ikon={Crown} baslik={t("klan.liderYap")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "lider_devret" })} />}
                {(d.rolum === "lider" || u.rol === "uye") && <Dugme kucuk genis={false} tur="hayalet" ikon={UserMinus} baslik={t("klan.cikar")} onPress={() => void yap("y", "/api/klan/yonet", { hedef: u.kullanici_id, islem: "cikar" })} />}
              </View>
            )}
          </View>
        ))}
        {yonetici && (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}><Alan etiket={t("klan.davetEt")} value={davetAd} onChangeText={setDavetAd} autoCapitalize="none" /></View>
            <Dugme genis={false} ikon={Send} baslik={t("klan.davetGonder")} pasif={davetAd.trim().length < 3} yukleniyor={mesgul === "davet"}
              onPress={() => void yap("davet", "/api/klan/davet", { takmaAd: davetAd }, t("klan.davetGonderildi")).then((ok) => ok && setDavetAd(""))} />
          </View>
        )}
      </Kart>

      <Dugme tur={ayrilOnay ? "tehlike" : "hayalet"} ikon={LogOut} baslik={ayrilOnay ? t("klan.ayrilOnay") : t("klan.ayril")} yukleniyor={mesgul === "ayril"}
        onPress={() => (ayrilOnay ? void yap("ayril", "/api/klan/ayril", {}).then(() => setAyrilOnay(false)) : setAyrilOnay(true))} />
    </Ekran>
  );
}
