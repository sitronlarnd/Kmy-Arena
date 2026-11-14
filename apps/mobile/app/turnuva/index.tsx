import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Crown, Swords } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Dugme, Etiket, Kart, Metin } from "@/bilesenler/ui";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { OYUN, useTema } from "@/lib/tema";

interface Mac { tur: number; sira: number; a: string | null; b: string | null; kazanan: "a" | "b" | null; durum: string; ben: "a" | "b" | null }
interface Turnuva {
  id: string; ad: string; durum: string; tur: number; boyut: number; odul: string | null; ders: string; kazanan: string | null; benim: boolean;
  macim: { duello_id: string | null; durum: string; tur: number } | null; maclar: Mac[] | null;
}

function turAdi(tur: number, turSayisi: number) {
  if (tur === turSayisi) return t("turnuva.final");
  if (tur === turSayisi - 1) return t("turnuva.yariFinal");
  return t("turnuva.tur", { n: tur });
}

export function TurnuvaListesi({ filtre }: { filtre?: string }) {
  const tema = useTema();
  const [hazirlaniyor, setHazirlaniyor] = useState(false);
  const { data, refetch } = useQuery({
    queryKey: ["turnuvalarim"],
    queryFn: async () => ((await supabase.rpc("turnuvalarim")).data ?? []) as Turnuva[],
    refetchInterval: 15_000,
  });
  const l = (data ?? []).filter((x) => !filtre || x.id === filtre);

  async function oyna(tr: Turnuva) {
    if (tr.macim?.duello_id) { router.push(`/duello/${tr.macim.duello_id}`); return; }
    setHazirlaniyor(true);
    try {
      await api("/api/turnuva/hazirla", {});
      const yeni = (await refetch()).data?.find((x) => x.id === tr.id);
      if (yeni?.macim?.duello_id) router.push(`/duello/${yeni.macim.duello_id}`);
    } finally { setHazirlaniyor(false); }
  }

  if (l.length === 0) return <Kart><Metin soluk ortala>{t("turnuva.yok")}</Metin></Kart>;
  return (
    <>
      {l.map((tr) => {
        const maclar = tr.maclar ?? [];
        const turSayisi = Math.log2(tr.boyut);
        const turlar = [...new Set(maclar.map((m) => m.tur))].sort((a, b) => a - b);
        const elendi = tr.benim && !tr.macim && tr.durum === "surdu";
        return (
          <Kart key={tr.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Crown size={22} color={OYUN.altin} />
              <View style={{ flex: 1 }}>
                <Metin tur="altbaslik">{tr.ad}</Metin>
                <Metin tur="kucuk" soluk>{tr.ders}{tr.odul ? ` · ${t("turnuva.odul", { odul: tr.odul })}` : ""}</Metin>
              </View>
              {tr.durum === "bitti" ? <Etiket metin={t("turnuva.sampiyon", { ad: tr.kazanan ?? "" })} renk={OYUN.altin} /> : <Etiket metin={turAdi(tr.tur, turSayisi)} renk={tema.vurgu} />}
            </View>
            {tr.macim && tr.durum === "surdu" && (
              tr.macim.durum === "bitti" ? null :
              <Dugme tur="ates" ikon={Swords} baslik={hazirlaniyor ? t("turnuva.macHazirlaniyor") : t("turnuva.maciniOyna")} onPress={() => void oyna(tr)} />
            )}
            {elendi && <Metin tur="kucuk" soluk>{t("turnuva.elendin")}</Metin>}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6 }}>
              {turlar.map((tur) => (
                <View key={tur} style={{ gap: 8, justifyContent: "space-around", minWidth: 150 }}>
                  <Metin tur="kucuk" soluk>{turAdi(tur, turSayisi)}</Metin>
                  {maclar.filter((m) => m.tur === tur).map((m) => (
                    <View key={m.sira} style={{ borderRadius: 12, borderWidth: 1, borderColor: m.ben ? tema.vurgu : tema.kenar, backgroundColor: tema.yuzey2, overflow: "hidden" }}>
                      {(["a", "b"] as const).map((taraf) => (
                        <View key={taraf} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: m.kazanan === taraf ? `${tema.dogru}22` : "transparent" }}>
                          <Metin tur="kucuk" renk={m.kazanan === taraf ? tema.dogru : m.ben === taraf ? tema.vurgu : tema.metin}>{m[taraf] ?? t("turnuva.bay")}</Metin>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Kart>
        );
      })}
    </>
  );
}

export default function Turnuvalar() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return (
    <Ekran baslik={t("turnuva.baslik")} altBaslik={t("turnuva.aciklama")}>
      <TurnuvaListesi filtre={id} />
    </Ekran>
  );
}
