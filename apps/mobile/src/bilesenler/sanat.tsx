/**
 * Vektör çizimler (emoji yerine): karakterler, boss canavarları, klan
 * amblemleri, rozet madalyaları. Hepsi react-native-svg; ölçeklenir, temaya uyar.
 */
import { esyaBul, evrimAsamasi, karakterBul } from "@kmy/shared";
import {
  Award, BookOpen, Bird, Brain, CalendarCheck, Crown, Crosshair, Flame, Gem, GraduationCap, HandHeart, Heart, Mountain,
  PawPrint, Rocket, Search, Shield, ShoppingBag, Sparkles, Star, Sunrise, Swords, Target, Trophy, Users, Zap, type LucideIcon,
} from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Path, Polygon, RadialGradient, Rect, Stop, LinearGradient as SvgGradient } from "react-native-svg";

function acik(hex: string, oran: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = (c: number) => Math.round(c + (255 - c) * oran).toString(16).padStart(2, "0");
  return `#${k(r)}${k(g)}${k(b)}`;
}
function koyu(hex: string, oran: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const k = (c: number) => Math.round(c * (1 - oran)).toString(16).padStart(2, "0");
  return `#${k(r)}${k(g)}${k(b)}`;
}

function Goz({ x, y, r = 7, renk = "#1B1530", iris }: { x: number; y: number; r?: number; renk?: string; iris?: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill="#fff" />
      {iris && <Circle cx={x} cy={y + 0.5} r={r * 0.72} fill={iris} />}
      <Circle cx={x} cy={y + 0.8} r={r * 0.45} fill={renk} />
      <Circle cx={x + r * 0.28} cy={y - r * 0.25} r={r * 0.2} fill="#fff" />
    </G>
  );
}

/** Karakter yüzleri (viewBox 0 0 100 100, merkez ~50,55) */
function KarakterYuz({ tur, renk }: { tur: string; renk: string }) {
  const a = acik(renk, 0.55);
  const k = koyu(renk, 0.35);
  switch (tur) {
    case "bilge_baykus":
      return (
        <G>
          <Path d="M24 34 L30 14 L40 30 Z" fill={k} />
          <Path d="M76 34 L70 14 L60 30 Z" fill={k} />
          <Ellipse cx={50} cy={58} rx={30} ry={32} fill={renk} />
          <Ellipse cx={50} cy={70} rx={18} ry={18} fill={a} />
          <Circle cx={38} cy={50} r={13} fill={acik(renk, 0.75)} />
          <Circle cx={62} cy={50} r={13} fill={acik(renk, 0.75)} />
          <Goz x={38} y={50} r={9} iris="#F7B500" />
          <Goz x={62} y={50} r={9} iris="#F7B500" />
          <Path d="M46 60 L54 60 L50 68 Z" fill="#FF9F1C" />
        </G>
      );
    case "kivilcim_tilki":
      return (
        <G>
          <Path d="M20 22 L38 40 L26 50 Z" fill={renk} />
          <Path d="M80 22 L62 40 L74 50 Z" fill={renk} />
          <Path d="M24 28 L33 40 L27 45 Z" fill={a} />
          <Path d="M76 28 L67 40 L73 45 Z" fill={a} />
          <Path d="M20 48 Q50 18 80 48 Q78 80 50 88 Q22 80 20 48 Z" fill={renk} />
          <Path d="M24 58 Q38 62 50 88 Q30 82 24 58 Z" fill="#FFF4EA" />
          <Path d="M76 58 Q62 62 50 88 Q70 82 76 58 Z" fill="#FFF4EA" />
          <Goz x={38} y={54} r={6.5} iris="#3A2A10" />
          <Goz x={62} y={54} r={6.5} iris="#3A2A10" />
          <Ellipse cx={50} cy={76} rx={5} ry={3.5} fill="#2A1B12" />
        </G>
      );
    case "demir_ayi":
      return (
        <G>
          <Circle cx={26} cy={30} r={11} fill={renk} />
          <Circle cx={74} cy={30} r={11} fill={renk} />
          <Circle cx={26} cy={30} r={5.5} fill={a} />
          <Circle cx={74} cy={30} r={5.5} fill={a} />
          <Circle cx={50} cy={56} r={32} fill={renk} />
          <Ellipse cx={50} cy={70} rx={15} ry={12} fill={a} />
          <Goz x={38} y={50} r={6} />
          <Goz x={62} y={50} r={6} />
          <Ellipse cx={50} cy={65} rx={6} ry={4.5} fill="#2A1B12" />
          <Path d="M44 74 Q50 79 56 74" stroke="#2A1B12" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </G>
      );
    case "ruzgar_atmacasi":
      return (
        <G>
          <Path d="M14 62 Q22 38 40 34 L34 58 Z" fill={k} />
          <Path d="M86 62 Q78 38 60 34 L66 58 Z" fill={k} />
          <Ellipse cx={50} cy={54} rx={28} ry={32} fill={renk} />
          <Path d="M30 44 Q50 34 70 44 L70 50 Q50 42 30 50 Z" fill={k} />
          <Ellipse cx={50} cy={72} rx={16} ry={14} fill={a} />
          <Goz x={39} y={52} r={6.5} iris="#FFB703" />
          <Goz x={61} y={52} r={6.5} iris="#FFB703" />
          <Path d="M44 60 Q50 58 56 60 Q54 72 50 74 Q50 66 44 60 Z" fill="#FFB703" />
        </G>
      );
    case "golge_kedi":
      return (
        <G>
          <Path d="M22 20 L42 36 L24 48 Z" fill={renk} />
          <Path d="M78 20 L58 36 L76 48 Z" fill={renk} />
          <Path d="M26 27 L36 36 L28 42 Z" fill="#B794F6" />
          <Path d="M74 27 L64 36 L72 42 Z" fill="#B794F6" />
          <Ellipse cx={50} cy={58} rx={31} ry={29} fill={renk} />
          <Ellipse cx={38} cy={54} rx={7.5} ry={8.5} fill="#7CFC9A" />
          <Ellipse cx={62} cy={54} rx={7.5} ry={8.5} fill="#7CFC9A" />
          <Ellipse cx={38} cy={55} rx={2.2} ry={6.5} fill="#10121F" />
          <Ellipse cx={62} cy={55} rx={2.2} ry={6.5} fill="#10121F" />
          <Path d="M47 66 L53 66 L50 70 Z" fill="#FF8FB1" />
          <Path d="M50 70 Q46 75 42 73 M50 70 Q54 75 58 73" stroke={a} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <Path d="M20 64 L34 66 M20 70 L34 69 M80 64 L66 66 M80 70 L66 69" stroke={a} strokeWidth={1.4} strokeLinecap="round" />
        </G>
      );
    default: // tas_kaplumbaga
      return (
        <G>
          <Path d="M14 74 Q50 34 86 74 Z" fill={k} />
          <Path d="M24 72 L36 56 L50 52 L64 56 L76 72 Z" fill={koyu(renk, 0.15)} stroke={a} strokeWidth={2} />
          <Path d="M36 56 L42 72 M64 56 L58 72 M50 52 L50 72" stroke={a} strokeWidth={2} />
          <Circle cx={50} cy={40} r={20} fill={acik(renk, 0.25)} />
          <Goz x={42} y={38} r={5.5} />
          <Goz x={58} y={38} r={5.5} />
          <Path d="M43 48 Q50 53 57 48" stroke={k} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </G>
      );
  }
}

function Aksesuar({ kod }: { kod: string | null | undefined }) {
  switch (kod) {
    case "kostum_tac":
      return <Path d="M30 22 L36 8 L44 18 L50 4 L56 18 L64 8 L70 22 Z" fill="#FFC53D" stroke="#E89B00" strokeWidth={2} />;
    case "kostum_sapka":
      return <G><Rect x={28} y={14} width={44} height={6} rx={3} fill="#3A2A20" /><Rect x={36} y={0} width={28} height={16} rx={4} fill="#4A3628" /><Rect x={36} y={10} width={28} height={4} fill="#D94E3B" /></G>;
    case "kostum_kask":
      return <Path d="M26 26 Q50 -2 74 26 Z" fill="#FF5C72" stroke="#fff" strokeWidth={2} />;
    case "kostum_gozluk":
      return <G><Circle cx={38} cy={52} r={10} fill="none" stroke="#1B1530" strokeWidth={3} /><Circle cx={62} cy={52} r={10} fill="none" stroke="#1B1530" strokeWidth={3} /><Path d="M48 52 L52 52" stroke="#1B1530" strokeWidth={3} /></G>;
    case "kostum_atki":
      return <G><Path d="M22 80 Q50 94 78 80 L78 88 Q50 100 22 88 Z" fill="#E5354F" /><Rect x={60} y={84} width={9} height={16} rx={3} fill="#C42640" /></G>;
    case "kostum_pelerin":
      return <Path d="M14 90 Q50 70 86 90 L80 100 L20 100 Z" fill="#8B5CF6" />;
    default:
      return null;
  }
}

/** Karakter avatarı: degrade zemin, çerçeve halkası, aksesuar, evrim aurası. */
export function Avatar(p: { tur: string | null | undefined; seviye?: number; cerceve?: string | null; arkaPlan?: string | null; kostum?: string | null; boyut?: number; aura?: boolean }) {
  const b = p.boyut ?? 64;
  const k = karakterBul(p.tur);
  const renk = k?.renk ?? "#7C5CFA";
  const cerceve = esyaBul(p.cerceve)?.renk ?? acik(renk, 0.2);
  const arka = esyaBul(p.arkaPlan)?.renk ?? koyu(renk, 0.55);
  const evrim = evrimAsamasi(p.seviye ?? 1);
  const id = `av${(p.tur ?? "x").slice(0, 4)}${b}`;
  const don = useSharedValue(0);
  useEffect(() => {
    if (evrim > 0 && p.aura !== false) don.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
  }, [evrim, p.aura, don]);
  const auraStil = useAnimatedStyle(() => ({ transform: [{ rotate: `${don.value * 360}deg` }] }));
  return (
    <View style={{ width: b, height: b }} accessibilityLabel={k?.ad ?? "karakter"}>
      {evrim > 0 && (
        <Animated.View style={[{ position: "absolute", left: -b * 0.08, top: -b * 0.08, width: b * 1.16, height: b * 1.16 }, auraStil]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            {Array.from({ length: 4 + evrim * 2 }).map((_, i, d) => {
              const a = (i / d.length) * Math.PI * 2;
              return <Circle key={i} cx={50 + Math.cos(a) * 47} cy={50 + Math.sin(a) * 47} r={evrim >= 3 ? 3 : 2.2} fill={evrim >= 3 ? "#FFC53D" : acik(renk, 0.4)} />;
            })}
          </Svg>
        </Animated.View>
      )}
      <Svg width={b} height={b} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="35%" r="70%">
            <Stop offset="0" stopColor={acik(arka, 0.35)} />
            <Stop offset="1" stopColor={arka} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#${id})`} stroke={cerceve} strokeWidth={4} />
        <G transform="translate(8 10) scale(0.84)">
          <KarakterYuz tur={k?.tur ?? "bilge_baykus"} renk={renk} />
          <Aksesuar kod={p.kostum} />
        </G>
      </Svg>
      {evrim >= 3 && (
        <View style={{ position: "absolute", top: -b * 0.14, alignSelf: "center" }}>
          <Crown size={b * 0.28} color="#FFC53D" fill="#FFC53D" />
        </View>
      )}
    </View>
  );
}

/** Boss canavarı: özelliğe göre renk ve biçim, nefes alma animasyonu. */
export function Boss({ ozellik, boyut = 96, yenildi }: { ozellik: string; boyut?: number; yenildi?: boolean }) {
  const renk = ({ zeka: "#8B5CF6", enerji: "#FF8A3D", bilgelik: "#2EC4B6", strateji: "#4C7DFF", ceviklik: "#FF4D9D" } as Record<string, string>)[ozellik] ?? "#FF4D6D";
  const n = useSharedValue(0);
  useEffect(() => {
    n.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1);
  }, [n]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: yenildi ? 0.9 : 1 + n.value * 0.05 }, { translateY: -n.value * 3 }], opacity: yenildi ? 0.45 : 1 }));
  const id = `bs${ozellik}`;
  return (
    <Animated.View style={[{ width: boyut, height: boyut }, a]}>
      <Svg width={boyut} height={boyut} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={acik(renk, 0.2)} />
            <Stop offset="1" stopColor={koyu(renk, 0.35)} />
          </SvgGradient>
        </Defs>
        <Ellipse cx={50} cy={94} rx={30} ry={5} fill="#00000040" />
        {/* boynuzlar */}
        <Path d="M26 30 Q12 10 22 4 Q24 20 36 26 Z" fill="#F4E9D8" />
        <Path d="M74 30 Q88 10 78 4 Q76 20 64 26 Z" fill="#F4E9D8" />
        {/* gövde */}
        <Path d="M16 60 Q14 22 50 20 Q86 22 84 60 Q84 90 50 90 Q16 90 16 60 Z" fill={`url(#${id})`} />
        {/* dikenler */}
        <Polygon points="30,24 36,12 42,22" fill={koyu(renk, 0.2)} />
        <Polygon points="44,20 50,8 56,20" fill={koyu(renk, 0.2)} />
        <Polygon points="58,22 64,12 70,24" fill={koyu(renk, 0.2)} />
        {/* kızgın kaşlar ve gözler */}
        <Path d="M28 42 L44 48" stroke="#1B1530" strokeWidth={4} strokeLinecap="round" />
        <Path d="M72 42 L56 48" stroke="#1B1530" strokeWidth={4} strokeLinecap="round" />
        {yenildi ? (
          <G stroke="#1B1530" strokeWidth={3.5} strokeLinecap="round">
            <Path d="M31 52 L41 60 M41 52 L31 60" /><Path d="M59 52 L69 60 M69 52 L59 60" />
          </G>
        ) : (
          <G>
            <Circle cx={36} cy={56} r={7} fill="#FFF36B" /><Circle cx={64} cy={56} r={7} fill="#FFF36B" />
            <Circle cx={37} cy={57} r={3.2} fill="#1B1530" /><Circle cx={63} cy={57} r={3.2} fill="#1B1530" />
          </G>
        )}
        {/* ağız ve dişler */}
        <Path d="M32 72 Q50 84 68 72 Q50 78 32 72 Z" fill="#2A0F1A" />
        <Polygon points="38,73 41,79 44,75" fill="#fff" />
        <Polygon points="56,75 59,79 62,73" fill="#fff" />
        {/* göbek deseni */}
        <Ellipse cx={50} cy={80} rx={10} ry={4} fill={acik(renk, 0.35)} opacity={0.5} />
      </Svg>
    </Animated.View>
  );
}

// ── Klan amblemi ──
export const AMBLEM_IKONLARI: Record<string, LucideIcon> = {
  yildiz: Star, simsek: Zap, kitap: BookOpen, ates: Flame, dag: Mountain, kurt: PawPrint, kartal: Bird, ejder: Swords, tac: Crown, elmas: Gem,
};
const KALKAN_YOLU: Record<string, string> = {
  klasik: "M50 4 L90 16 L90 50 Q90 82 50 96 Q10 82 10 50 L10 16 Z",
  yuvarlak: "M50 4 A46 46 0 1 1 49.9 4 Z",
  sivri: "M50 2 L92 22 L80 70 L50 98 L20 70 L8 22 Z",
  kanatli: "M50 8 L84 18 L84 50 Q84 80 50 94 Q16 80 16 50 L16 18 Z M16 26 L2 18 L6 44 L16 46 Z M84 26 L98 18 L94 44 L84 46 Z",
  tacli: "M50 14 L88 22 L88 52 Q88 82 50 96 Q12 82 12 52 L12 22 Z M28 18 L32 4 L42 14 L50 2 L58 14 L68 4 L72 18 Z",
  yildizli: "M50 4 L90 16 L90 50 Q90 82 50 96 Q10 82 10 50 L10 16 Z",
};
export function Amblem({ a, boyut = 48 }: { a: { kalkan: string; simge: string; renk: string }; boyut?: number }) {
  const Ikon = AMBLEM_IKONLARI[a.simge] ?? Star;
  const id = `am${a.renk.replace("#", "")}${a.kalkan}`;
  return (
    <View style={{ width: boyut, height: boyut, alignItems: "center", justifyContent: "center" }}>
      <Svg width={boyut} height={boyut} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={acik(a.renk, 0.25)} />
            <Stop offset="1" stopColor={koyu(a.renk, 0.3)} />
          </SvgGradient>
        </Defs>
        <Path d={KALKAN_YOLU[a.kalkan] ?? KALKAN_YOLU.klasik} fill={`url(#${id})`} stroke={a.kalkan === "tacli" || a.kalkan === "yildizli" || a.kalkan === "kanatli" ? "#FFC53D" : "#ffffff55"} strokeWidth={3} />
        <Path d="M50 12 L82 21 L82 34 Q50 26 18 34 L18 21 Z" fill="#ffffff22" />
      </Svg>
      <Ikon size={boyut * 0.42} color="#fff" fill="#ffffff33" strokeWidth={2.2} />
    </View>
  );
}

// ── Rozet madalyası ──
const ROZET_IKON: Record<string, LucideIcon> = {
  ilk_soru: Rocket, soru_100: Target, soru_500: BookOpen, soru_1000: GraduationCap, soru_5000: Trophy,
  dogru_50: Crosshair, dogru_250: Crosshair, dogru_1000: Gem, sabah_kusu: Sunrise, zor_10: Mountain,
  tespit_ilk: Search, tespit_hepsi: Search, ilk_alisveris: ShoppingBag, klan_katil: Users, boss_vurus: Swords,
  duello_ilk: Swords, duello_seri_10: Shield, topluluk_10: HandHeart, hata_avcisi: Search, tam_set: Award,
};
const KATEGORI: Record<string, { ikon: LucideIcon; renk: [string, string] }> = {
  soru: { ikon: Target, renk: ["#8B5CF6", "#5B3FD6"] },
  seri: { ikon: Flame, renk: ["#FF8A3D", "#E5354F"] },
  ustalik: { ikon: Crown, renk: ["#FFD861", "#E89B00"] },
  tekrar: { ikon: Heart, renk: ["#FF7AB6", "#D9367A"] },
  beceri: { ikon: Brain, renk: ["#4DE3D2", "#1597A0"] },
  gorev: { ikon: CalendarCheck, renk: ["#7DDBFF", "#4C7DFF"] },
  karakter: { ikon: Sparkles, renk: ["#C4A1FF", "#7C5CFA"] },
  lig: { ikon: Trophy, renk: ["#FFC53D", "#FF8A00"] },
  sosyal: { ikon: Users, renk: ["#3CF0A0", "#12B76A"] },
};
export function RozetMadalya({ kod, kategori, boyut = 64, kilitli }: { kod: string; kategori: string; boyut?: number; kilitli?: boolean }) {
  const k = KATEGORI[kategori] ?? { ikon: Target, renk: ["#8B5CF6", "#5B3FD6"] as [string, string] };
  const Ikon = ROZET_IKON[kod] ?? k.ikon;
  const renk = kilitli ? (["#3A3D5C", "#2A2D48"] as const) : k.renk;
  const id = `rz${kod}${kilitli ? "k" : ""}`;
  return (
    <View style={{ width: boyut, height: boyut, alignItems: "center", justifyContent: "center", opacity: kilitli ? 0.55 : 1 }}>
      <Svg width={boyut} height={boyut} viewBox="0 0 100 100" style={{ position: "absolute" }}>
        <Defs>
          <SvgGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={renk[0]} />
            <Stop offset="1" stopColor={renk[1]} />
          </SvgGradient>
        </Defs>
        <Polygon points="50,3 91,26 91,74 50,97 9,74 9,26" fill={`url(#${id})`} stroke="#ffffff66" strokeWidth={3} />
        <Polygon points="50,14 81,32 81,68 50,86 19,68 19,32" fill="#00000022" />
        <Path d="M12 30 L50 8 L88 30 L88 40 Q50 22 12 40 Z" fill="#ffffff26" />
      </Svg>
      <Ikon size={boyut * 0.4} color="#fff" strokeWidth={2.4} />
    </View>
  );
}
