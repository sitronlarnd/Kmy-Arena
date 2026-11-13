/** Kutlama efektleri: konfeti patlaması, uçan ödül, seviye atlama ve rozet modalı. */
import { EVRIM_ADLARI, evrimAsamasi, ROZETLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Coins, Sparkles } from "lucide-react-native";
import { useEffect, useMemo } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, {
  Easing, FadeIn, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from "react-native-reanimated";
import { RozetMadalya, Avatar } from "./sanat";
import { Dugme, Metin, titret } from "./ui";
import { GRADYAN, OYUN, golge, useTema } from "@/lib/tema";

const RENKLER = ["#8B5CF6", "#5B7CFF", "#FFC53D", "#FF6A3D", "#2EE08A", "#FF4D9D", "#5CC8FF"];

function Parca({ i, toplam, guc }: { i: number; toplam: number; guc: number }) {
  const v = useSharedValue(0);
  const r = useMemo(() => {
    const aci = (i / toplam) * Math.PI * 2 + Math.random() * 0.5;
    const hiz = (0.6 + Math.random() * 0.6) * guc;
    return { dx: Math.cos(aci) * hiz, dy: Math.sin(aci) * hiz - guc * 0.5, don: (Math.random() - 0.5) * 720, renk: RENKLER[i % RENKLER.length] ?? "#FFC53D", gen: 6 + Math.random() * 6, uzun: Math.random() > 0.5 };
  }, [i, toplam, guc]);
  useEffect(() => {
    v.value = withTiming(1, { duration: 1400 + Math.random() * 500, easing: Easing.out(Easing.quad) });
  }, [v]);
  const a = useAnimatedStyle(() => ({
    opacity: 1 - Math.max(0, v.value - 0.6) / 0.4,
    transform: [
      { translateX: r.dx * v.value },
      { translateY: r.dy * v.value + 260 * v.value * v.value },
      { rotate: `${r.don * v.value}deg` },
    ],
  }));
  return <Animated.View style={[{ position: "absolute", width: r.gen, height: r.uzun ? r.gen * 2 : r.gen, borderRadius: r.uzun ? 2 : r.gen, backgroundColor: r.renk }, a]} />;
}

/** Ortadan patlayan konfeti; `anahtar` değişince yeniden oynar. */
export function Konfeti({ anahtar, adet = 36, guc = 220 }: { anahtar: number | string; adet?: number; guc?: number }) {
  return (
    <View key={anahtar} pointerEvents="none" style={{ position: "absolute", left: "50%", top: "40%", width: 0, height: 0, alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      {Array.from({ length: adet }).map((_, i) => <Parca key={i} i={i} toplam={adet} guc={guc} />)}
    </View>
  );
}

/** "+12 XP" yukarı süzülüp kaybolur */
export function UcanOdul({ xp, altin }: { xp: number; altin: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withSpring(1, { damping: 9 }), withDelay(900, withTiming(2, { duration: 600 })));
  }, [v]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value <= 1 ? v.value : 2 - v.value,
    transform: [{ translateY: -40 * v.value }, { scale: 0.6 + Math.min(1, v.value) * 0.5 }],
  }));
  if (xp <= 0 && altin <= 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -10, alignSelf: "center", flexDirection: "row", gap: 8, zIndex: 40 }, a]}>
      {xp > 0 && (
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: OYUN.xp, ...golge(2, OYUN.xp) }}>
          <Metin tur="altbaslik" renk="#fff">+{xp} XP</Metin>
        </View>
      )}
      {altin > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: OYUN.altin, ...golge(2, OYUN.altin) }}>
          <Coins size={16} color="#3A2400" />
          <Metin tur="altbaslik" renk="#3A2400">+{altin}</Metin>
        </View>
      )}
    </Animated.View>
  );
}

function IsinHalesi({ renk }: { renk: string }) {
  const d = useSharedValue(0);
  useEffect(() => {
    d.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1);
  }, [d]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${d.value * 360}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", width: 300, height: 300, alignItems: "center", justifyContent: "center" }, a]}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={{ position: "absolute", width: 14, height: 300, borderRadius: 7, backgroundColor: `${renk}22`, transform: [{ rotate: `${i * 15}deg` }] }} />
      ))}
    </Animated.View>
  );
}

/** Seviye atlama: dönen ışık hâlesi, zıplayan karakter, konfeti. */
export function SeviyeKutlama(p: { seviye: number | null; karakter?: { tur: string; cerceve: string | null; arka_plan: string | null; kostum: string | null } | null; kapat: () => void }) {
  const tema = useTema();
  useEffect(() => {
    if (p.seviye !== null) titret("basari");
  }, [p.seviye]);
  if (p.seviye === null) return null;
  const evrim = evrimAsamasi(p.seviye);
  const evrimAni = evrim > evrimAsamasi(p.seviye - 1);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={p.kapat}>
      <Pressable onPress={p.kapat} style={{ flex: 1, backgroundColor: "#05061099", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <IsinHalesi renk={OYUN.altin} />
        <Konfeti anahtar={p.seviye} adet={48} />
        <Animated.View entering={ZoomIn.springify().damping(11)} style={{ alignItems: "center", gap: 14, padding: 28, borderRadius: 28, backgroundColor: tema.yuzey, minWidth: 280, borderWidth: 1, borderColor: `${OYUN.altin}66`, ...golge(3, OYUN.altin) }}>
          <Metin tur="etiket" renk={OYUN.altin}>{t("oyun.seviyeAtladinBaslik")}</Metin>
          {p.karakter && <Avatar tur={p.karakter.tur} seviye={p.seviye} cerceve={p.karakter.cerceve} arkaPlan={p.karakter.arka_plan} kostum={p.karakter.kostum} boyut={120} />}
          <Metin tur="dev" renk={OYUN.xp}>{t("oyun.seviyeAtladin", { n: p.seviye })}</Metin>
          {evrimAni && <Metin tur="altbaslik" ortala>{t("oyun.evrim", { ad: EVRIM_ADLARI[evrim] ?? "" })}</Metin>}
          <View style={{ alignSelf: "stretch" }}>
            <Dugme tur="altin" baslik={t("ortak.devam")} onPress={p.kapat} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/** Yeni rozet: madalya döner ve yerine oturur. */
export function RozetKutlama({ kodlar, kapat }: { kodlar: string[]; kapat: () => void }) {
  const tema = useTema();
  const d = useSharedValue(0);
  const kod = kodlar[0];
  useEffect(() => {
    if (!kod) return;
    titret("basari");
    d.value = 0;
    d.value = withSpring(1, { damping: 8, stiffness: 90 });
  }, [kod, d]);
  const a = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateY: `${(1 - d.value) * 540}deg` }, { scale: 0.4 + d.value * 0.6 }] }));
  if (!kod) return null;
  const rz = ROZETLER.find((x) => x.kod === kod);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={kapat}>
      <Pressable onPress={kapat} style={{ flex: 1, backgroundColor: "#05061099", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <IsinHalesi renk={OYUN.xp} />
        <Konfeti anahtar={kod} adet={30} guc={180} />
        <Animated.View entering={FadeIn} style={{ alignItems: "center", gap: 12, padding: 28, borderRadius: 28, backgroundColor: tema.yuzey, minWidth: 280, ...golge(3, OYUN.xp) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Sparkles size={16} color={OYUN.xp} />
            <Metin tur="etiket" renk={OYUN.xp}>{t("oyun.yeniRozetBaslik")}</Metin>
          </View>
          <Animated.View style={a}>
            <RozetMadalya kod={kod} kategori={rz?.kategori ?? "soru"} boyut={120} />
          </Animated.View>
          <Metin tur="baslik" ortala>{rz?.ad ?? kod}</Metin>
          {rz?.aciklama && <Metin soluk ortala>{rz.aciklama}</Metin>}
          {rz && rz.altin > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Coins size={18} color={OYUN.altin} />
              <Metin tur="altbaslik" renk={OYUN.altin}>+{rz.altin}</Metin>
            </View>
          )}
          <View style={{ alignSelf: "stretch" }}>
            <Dugme baslik={kodlar.length > 1 ? t("ortak.devam") : t("ortak.harika")} onPress={kapat} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

export const GRADYAN_SONUC = { dogru: GRADYAN.dogru, yanlis: GRADYAN.yanlis } as const;
