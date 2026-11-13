import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/lib/tema";

const sorguIstemcisi = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } });

function OturumKapisi() {
  const { hazir, oturum, profil, yukle } = useOturum();
  // Tipli rotalar bölüm dizisini dar bir demete çevirir; burada düz dizi olarak okunur.
  const bolumler: readonly string[] = useSegments();
  const yonlendir = useRouter();
  const tema = useTema();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => yukle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_olay, s) => void yukle(s));
    return () => data.subscription.unsubscribe();
  }, [yukle]);

  useEffect(() => {
    if (!hazir) return;
    const authBolumunde = bolumler[0] === "(auth)";
    if (!oturum && !authBolumunde) yonlendir.replace("/(auth)/giris");
    else if (oturum && !profil && bolumler[1] !== "katil") yonlendir.replace("/(auth)/katil");
    else if (oturum && profil && authBolumunde) yonlendir.replace("/(sekmeler)");
  }, [hazir, oturum, profil, bolumler, yonlendir]);

  if (!hazir) {
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
      <StatusBar style="auto" />
      <OturumKapisi />
    </QueryClientProvider>
  );
}
