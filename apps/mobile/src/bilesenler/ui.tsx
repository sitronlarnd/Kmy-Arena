/**
 * KMY Arena UI çekirdeği: Metin, Kart, Dugme, Cip, Cubuk, Halka, AnimSayi,
 * Etiket, IkonKutu, Bolum. Animasyonlar Reanimated (UI iş parçacığı), basışta
 * yay ölçeği + dokunsal geri bildirim.
 */
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, Stop, LinearGradient as SvgGradient } from "react-native-svg";
import { BOYUT, GRADYAN, golge, useTema, yazi } from "@/lib/tema";

export function titret(tur: "hafif" | "orta" | "basari" | "hata" = "hafif") {
  if (Platform.OS === "web") return;
  if (tur === "basari") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (tur === "hata") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else void Haptics.impactAsync(tur === "orta" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
}

// ── Metin ──
type MetinTuru = "dev" | "baslik" | "altbaslik" | "govde" | "kucuk" | "etiket" | "sayi";
const METIN: Record<MetinTuru, { boyut: number; agirlik: "normal" | "kalin" | "ekstra" | "siyah"; satir?: number; harf?: number }> = {
  dev: { boyut: 34, agirlik: "siyah", satir: 40 },
  baslik: { boyut: 24, agirlik: "siyah", satir: 30 },
  altbaslik: { boyut: 18, agirlik: "ekstra", satir: 24 },
  govde: { boyut: 16, agirlik: "normal", satir: 23 },
  kucuk: { boyut: 13, agirlik: "kalin", satir: 18 },
  etiket: { boyut: 11, agirlik: "ekstra", satir: 14, harf: 1 },
  sayi: { boyut: 20, agirlik: "siyah" },
};
export function Metin({ tur = "govde", renk, soluk, ortala, stil, children, ...p }: TextProps & { tur?: MetinTuru; renk?: string; soluk?: boolean; ortala?: boolean; stil?: TextStyle | TextStyle[] }) {
  const tema = useTema();
  const m = METIN[tur];
  return (
    <Text
      {...p}
      style={[
        yazi(m.agirlik),
        { fontSize: m.boyut, lineHeight: m.satir, letterSpacing: m.harf, color: renk ?? (soluk ? tema.soluk : tema.metin), textAlign: ortala ? "center" : undefined },
        tur === "etiket" ? { textTransform: "uppercase" } : null,
        stil,
      ]}
    >
      {children}
    </Text>
  );
}

// ── Kart: giriş animasyonu, derinlik, isteğe bağlı degrade ya da vurgu kenarı ──
export function Kart(p: { children: ReactNode; stil?: ViewStyle; sira?: number; gradyan?: readonly [string, string, ...string[]]; vurgu?: string; onPress?: () => void; ic?: number }) {
  const tema = useTema();
  const ic = p.ic ?? 18;
  const icerik = (
    <View style={{ padding: ic, gap: 10 }}>{p.children}</View>
  );
  const kutu: ViewStyle = {
    borderRadius: BOYUT.yaricap,
    backgroundColor: p.gradyan ? undefined : tema.yuzey,
    borderWidth: 1,
    borderColor: p.vurgu ? `${p.vurgu}88` : tema.kenar,
    overflow: "hidden",
    ...golge(2, p.vurgu ?? tema.golge),
  };
  const govde = p.gradyan ? (
    <LinearGradient colors={p.gradyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: BOYUT.yaricap }}>
      {icerik}
    </LinearGradient>
  ) : (
    icerik
  );
  return (
    <Animated.View entering={FadeInDown.delay((p.sira ?? 0) * 70).duration(420).springify().damping(16)} style={[kutu, p.stil]}>
      {p.vurgu && !p.gradyan && <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: p.vurgu }} />}
      {p.onPress ? <Basilabilir onPress={p.onPress}>{govde}</Basilabilir> : govde}
    </Animated.View>
  );
}

// ── Basılabilir: yay ölçeği ──
export function Basilabilir(p: { onPress?: () => void; children: ReactNode; stil?: ViewStyle; pasif?: boolean; etiket?: string; secili?: boolean; olcek?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.etiket}
      accessibilityState={{ disabled: p.pasif, selected: p.secili }}
      disabled={p.pasif}
      onPressIn={() => { s.value = withSpring(p.olcek ?? 0.95, { damping: 15, stiffness: 400 }); }}
      onPressOut={() => { s.value = withSpring(1, { damping: 10, stiffness: 250 }); }}
      onPress={() => { titret(); p.onPress?.(); }}
    >
      <Animated.View style={[a, p.stil]}>{p.children}</Animated.View>
    </Pressable>
  );
}

// ── Düğme ──
type DugmeTuru = "ana" | "ikincil" | "hayalet" | "ates" | "altin" | "dogru" | "tehlike";
export function Dugme(p: {
  baslik: string;
  onPress: () => void;
  yukleniyor?: boolean;
  pasif?: boolean;
  buyuk?: boolean;
  kucuk?: boolean;
  ikon?: LucideIcon;
  tur?: DugmeTuru;
  /** Geriye uyum */
  ikincil?: boolean;
  genis?: boolean;
}) {
  const tema = useTema();
  const tur: DugmeTuru = p.tur ?? (p.ikincil ? "ikincil" : "ana");
  const yukseklik = p.buyuk ? 64 : p.kucuk ? 38 : BOYUT.dokunma;
  const gradyan =
    tur === "ana" ? tema.vurguGradyan : tur === "ates" ? GRADYAN.ates : tur === "altin" ? GRADYAN.altin : tur === "dogru" ? GRADYAN.dogru : tur === "tehlike" ? GRADYAN.yanlis : null;
  const yaziRenk = gradyan ? (tur === "altin" ? "#3A2400" : "#fff") : tema.metin;
  const Ikon = p.ikon;
  const ic = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: yukseklik, paddingHorizontal: p.kucuk ? 14 : 22 }}>
      {p.yukleniyor ? (
        <ActivityIndicator color={yaziRenk} />
      ) : (
        <>
          {Ikon && <Ikon size={p.buyuk ? 24 : p.kucuk ? 16 : 20} color={tur === "hayalet" ? tema.vurgu : yaziRenk} strokeWidth={2.4} />}
          <Text numberOfLines={1} style={[yazi("ekstra"), { color: tur === "hayalet" ? tema.vurgu : yaziRenk, fontSize: p.buyuk ? 20 : p.kucuk ? 14 : 16 }]}>{p.baslik}</Text>
        </>
      )}
    </View>
  );
  return (
    <Basilabilir onPress={p.onPress} pasif={p.pasif || p.yukleniyor} etiket={p.baslik} stil={{ opacity: p.pasif ? 0.4 : 1, alignSelf: p.genis === false ? "flex-start" : undefined }}>
      {gradyan ? (
        <LinearGradient colors={gradyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: yukseklik / 2 }, golge(p.buyuk ? 3 : 2, gradyan[1])]}>
          {p.buyuk && <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: yukseklik / 2, borderTopLeftRadius: yukseklik / 2, borderTopRightRadius: yukseklik / 2, backgroundColor: "#ffffff22" }} />}
          {ic}
        </LinearGradient>
      ) : (
        <View style={{ borderRadius: yukseklik / 2, borderWidth: tur === "hayalet" ? 0 : 1.5, borderColor: tema.kenar, backgroundColor: tur === "hayalet" ? "transparent" : tema.yuzey2 }}>{ic}</View>
      )}
    </Basilabilir>
  );
}

// ── Çip (seçilebilir hap) ──
export function Cip(p: { baslik: string; secili?: boolean; onPress: () => void; ikon?: LucideIcon; renk?: string }) {
  const tema = useTema();
  const renk = p.renk ?? tema.vurgu;
  const Ikon = p.ikon;
  return (
    <Basilabilir onPress={p.onPress} secili={p.secili} etiket={p.baslik}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, borderColor: p.secili ? renk : tema.kenar, backgroundColor: p.secili ? `${renk}26` : tema.yuzey }}>
        {Ikon && <Ikon size={16} color={p.secili ? renk : tema.soluk} strokeWidth={2.4} />}
        <Text style={[yazi("kalin"), { color: p.secili ? renk : tema.metin, fontSize: 14 }]}>{p.baslik}</Text>
      </View>
    </Basilabilir>
  );
}

// ── İkon kutusu (renkli yuvarlak zemin) ──
export function IkonKutu({ ikon: Ikon, renk, boyut = 44, dolu }: { ikon: LucideIcon; renk: string; boyut?: number; dolu?: boolean }) {
  return (
    <View style={{ width: boyut, height: boyut, borderRadius: boyut * 0.32, alignItems: "center", justifyContent: "center", backgroundColor: dolu ? renk : `${renk}22`, borderWidth: 1, borderColor: `${renk}55` }}>
      <Ikon size={boyut * 0.5} color={dolu ? "#fff" : renk} strokeWidth={2.4} />
    </View>
  );
}

// ── Etiket ──
export function Etiket({ metin, renk, ikon: Ikon }: { metin: string; renk: string; ikon?: LucideIcon }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: `${renk}22` }}>
      {Ikon && <Ikon size={13} color={renk} strokeWidth={2.6} />}
      <Text style={[yazi("ekstra"), { color: renk, fontSize: 12 }]}>{metin}</Text>
    </View>
  );
}

// ── İlerleme çubuğu: degrade dolgu, yaylanarak dolar, parıltı ──
export function Cubuk({ oran, gradyan, yukseklik = 12, parilti }: { oran: number; gradyan?: readonly [string, string, ...string[]]; yukseklik?: number; parilti?: boolean }) {
  const tema = useTema();
  const hedef = Math.min(1, Math.max(0, Number.isFinite(oran) ? oran : 0));
  const g = useSharedValue(0);
  const p = useSharedValue(0);
  useEffect(() => {
    g.value = withTiming(hedef, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [hedef, g]);
  useEffect(() => {
    if (parilti) p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [parilti, p]);
  const dolgu = useAnimatedStyle(() => ({ width: `${g.value * 100}%` }));
  const isik = useAnimatedStyle(() => ({ left: `${interpolate(p.value, [0, 1], [-30, 110])}%` }));
  return (
    <View style={{ height: yukseklik, borderRadius: yukseklik / 2, backgroundColor: tema.koyu ? "#ffffff12" : "#00000010", overflow: "hidden" }}>
      <Animated.View style={[{ height: yukseklik, borderRadius: yukseklik / 2, overflow: "hidden" }, dolgu]}>
        <LinearGradient colors={gradyan ?? tema.vurguGradyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
        <View style={{ position: "absolute", top: 1, left: 4, right: 4, height: yukseklik / 3, borderRadius: yukseklik, backgroundColor: "#ffffff40" }} />
        {parilti && <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: "25%", backgroundColor: "#ffffff30", transform: [{ skewX: "-20deg" }] }, isik]} />}
      </Animated.View>
    </View>
  );
}

// ── Halka (SVG dairesel ilerleme) ──
const AnimDaire = Animated.createAnimatedComponent(Circle);
export function Halka({ oran, boyut = 72, kalinlik = 8, gradyan, children }: { oran: number; boyut?: number; kalinlik?: number; gradyan?: readonly [string, string, ...string[]]; children?: ReactNode }) {
  const tema = useTema();
  const r = (boyut - kalinlik) / 2;
  const cevre = 2 * Math.PI * r;
  const g = useSharedValue(0);
  useEffect(() => {
    g.value = withTiming(Math.min(1, Math.max(0, oran)), { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [oran, g]);
  const ap = useAnimatedProps(() => ({ strokeDashoffset: cevre * (1 - g.value) }));
  const renk = gradyan ?? tema.vurguGradyan;
  const id = `h${boyut}${renk[0].replace("#", "")}`;
  return (
    <View style={{ width: boyut, height: boyut, alignItems: "center", justifyContent: "center" }}>
      <Svg width={boyut} height={boyut} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={renk[0]} />
            <Stop offset="1" stopColor={renk[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={boyut / 2} cy={boyut / 2} r={r} stroke={tema.koyu ? "#ffffff14" : "#0000000f"} strokeWidth={kalinlik} fill="none" />
        <AnimDaire cx={boyut / 2} cy={boyut / 2} r={r} stroke={`url(#${id})`} strokeWidth={kalinlik} fill="none" strokeLinecap="round" strokeDasharray={`${cevre} ${cevre}`} animatedProps={ap} />
      </Svg>
      {children}
    </View>
  );
}

// ── Sayan sayı ──
export function AnimSayi({ deger, stil, onEk = "" }: { deger: number; stil?: TextStyle | TextStyle[]; onEk?: string }) {
  const [goster, setGoster] = useState(deger);
  const v = useSharedValue(deger);
  useEffect(() => {
    v.value = withTiming(deger, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [deger, v]);
  useAnimatedReaction(() => Math.round(v.value), (n, o) => { if (n !== o) runOnJS(setGoster)(n); });
  return <Text style={stil}>{onEk}{goster.toLocaleString("tr-TR")}</Text>;
}

// ── Nabız (dikkat çeken yumuşak büyüme) ──
export function Nabiz({ children, aktif = true }: { children: ReactNode; aktif?: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = aktif ? withRepeat(withSequence(withTiming(1.06, { duration: 700 }), withTiming(1, { duration: 700 })), -1, true) : withTiming(1);
  }, [aktif, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

// ── Sarsıntı (yanlış cevap) ──
export function useSarsinti() {
  const x = useSharedValue(0);
  const stil = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const salla = () => {
    x.value = withSequence(withTiming(-10, { duration: 50 }), withTiming(10, { duration: 50 }), withTiming(-7, { duration: 50 }), withTiming(7, { duration: 50 }), withTiming(0, { duration: 50 }));
  };
  return { stil, salla };
}

// ── Bölüm başlığı ──
export function Bolum({ baslik, ikon: Ikon, sag }: { baslik: string; ikon?: LucideIcon; sag?: ReactNode }) {
  const tema = useTema();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
      {Ikon && <Ikon size={18} color={tema.vurgu} strokeWidth={2.6} />}
      <Metin tur="altbaslik" stil={{ flex: 1 }} accessibilityRole="header">{baslik}</Metin>
      {sag}
    </View>
  );
}

// ── Kaynak sayacı (XP/Altın/Seri) ──
export function Kaynak({ ikon: Ikon, deger, renk, etiket }: { ikon: LucideIcon; deger: number; renk: string; etiket: string }) {
  const tema = useTema();
  return (
    <View accessibilityLabel={`${etiket}: ${deger}`} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: tema.koyu ? "#ffffff0d" : "#00000008" }}>
      <Ikon size={16} color={renk} fill={`${renk}55`} strokeWidth={2.4} />
      <AnimSayi deger={deger} stil={[yazi("siyah"), { color: tema.metin, fontSize: 15 }]} />
    </View>
  );
}
