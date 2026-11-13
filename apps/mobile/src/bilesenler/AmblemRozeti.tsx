import { amblemSimgesi, type Amblem } from "@kmy/shared";
import { Text, View } from "react-native";

/** Hazır parçalardan klan amblemi: kalkan şekli + simge + renk. */
export function AmblemRozeti({ a, boyut = 48 }: { a: Amblem; boyut?: number }) {
  const yaricap = a.kalkan === "yuvarlak" ? boyut / 2 : a.kalkan === "sivri" ? 4 : boyut / 4;
  return (
    <View style={{ width: boyut, height: boyut, borderRadius: yaricap, backgroundColor: a.renk, alignItems: "center", justifyContent: "center", borderWidth: a.kalkan === "kanatli" || a.kalkan === "tacli" || a.kalkan === "yildizli" ? 3 : 0, borderColor: "#FFC914" }}>
      <Text style={{ fontSize: boyut * 0.5 }}>{amblemSimgesi(a.simge)}</Text>
    </View>
  );
}

