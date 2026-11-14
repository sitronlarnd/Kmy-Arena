import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black, useFonts } from "@expo-google-fonts/nunito";
import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { bildirimDinle, bildirimKaydet } from "@/lib/bildirim";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/lib/tema";

// Web: Nunito değişken yazı tipi (tüm metinler) — native'de ağırlık başına aileler yüklenir
if (Platform.OS === "web" && typeof document !== "undefined" && !document.getElementById("kmy-yazi")) {
  const l = document.createElement("link");
  l.id = "kmy-yazi";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@500..900&display=swap";
  document.head.appendChild(l);
  const s = document.createElement("style");
  s.textContent = "html,body,#root{background:#0B0C1A} [dir] div, [dir] span, [dir] input, [dir] textarea { font-family: Nunito, system-ui, sans-serif; }";
  document.head.appendChild(s);
}

const sorguIstemcisi = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function OturumKapisi() {
  const { hazir, oturum, profil, yukle } = useOturum();
  // Tipli rotalar bölüm dizisini dar bir demete çevirir; burada düz dizi olarak okunur.
  const bolumler: readonly string[] = useSegments();
  const yonlendir = useRouter();
  const tema = useTema();
  const [yaziHazir] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => yukle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_olay, s) => void yukle(s));
    return () => data.subscription.unsubscribe();
  }, [yukle]);

  useEffect(() => bildirimDinle(), []);
  useEffect(() => {
    if (profil && (profil.tur === "ogrenci" || profil.tur === "veli")) void bildirimKaydet();
  }, [profil]);

  useEffect(() => {
    if (!hazir) return;
    const authBolumunde = bolumler[0] === "(auth)";
    if (!oturum && !authBolumunde) yonlendir.replace("/(auth)/giris");
    else if (oturum && !profil && bolumler[1] !== "katil") yonlendir.replace("/(auth)/katil");
    else if (oturum && profil && (profil.sifre_degismeli || !profil.kvkk_onay_tarihi) && bolumler[0] !== "sifre") yonlendir.replace("/sifre");
    else if (oturum && profil && (profil.sifre_degismeli || !profil.kvkk_onay_tarihi)) return;
    else if (oturum && profil && profil.tur === "veli" && bolumler[0] !== "veli") yonlendir.replace("/veli");
    else if (oturum && profil && authBolumunde) yonlendir.replace("/(sekmeler)");
  }, [hazir, oturum, profil, bolumler, yonlendir]);

  if (!hazir || (!yaziHazir && Platform.OS !== "web")) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tema.zemin }}>
        <ActivityIndicator color={tema.vurgu} />
      </View>
    );
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: tema.zemin } }} />;
}

export default function KokDuzen() {
  return (
    <QueryClientProvider client={sorguIstemcisi}>
      <StatusBar style="light" />
      <OturumKapisi />
    </QueryClientProvider>
  );
}
