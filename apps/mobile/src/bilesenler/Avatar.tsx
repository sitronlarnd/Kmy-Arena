import { esyaBul, evrimAsamasi, karakterBul } from "@kmy/shared";
import { Text, View } from "react-native";
import { useTema } from "@/lib/tema";

/** Karakter avatarı: arka plan, çerçeve, kostüm aksesuarı ve evrim yıldızları. */
export function Avatar(p: {
  tur: string | null | undefined;
  seviye?: number;
  cerceve?: string | null;
  arkaPlan?: string | null;
  kostum?: string | null;
  boyut?: number;
}) {
  const tema = useTema();
  const b = p.boyut ?? 64;
  const k = karakterBul(p.tur);
  const cerceve = esyaBul(p.cerceve)?.renk ?? k?.renk ?? tema.kenar;
  const arka = esyaBul(p.arkaPlan)?.renk ?? tema.zemin;
  const kostum = esyaBul(p.kostum)?.emoji;
  const evrim = evrimAsamasi(p.seviye ?? 1);
  return (
    <View style={{ width: b, height: b }} accessibilityLabel={k?.ad ?? "karakter"}>
      <View style={{ width: b, height: b, borderRadius: b / 2, borderWidth: Math.max(2, b / 16), borderColor: cerceve, backgroundColor: arka, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: b * 0.5 }}>{k?.emoji ?? "❔"}</Text>
      </View>
      {kostum && <Text style={{ position: "absolute", right: -2, top: -4, fontSize: b * 0.32 }}>{kostum}</Text>}
      {evrim > 0 && (
        <Text style={{ position: "absolute", bottom: -6, alignSelf: "center", fontSize: b * 0.18 }}>{"⭐".repeat(evrim)}</Text>
      )}
    </View>
  );
}
