import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * İstemcide yalnızca anon anahtar bulunur; veri koruması RLS'tedir.
 * Gizli anahtarlar (service role, KMYAI) istemci paketine ASLA girmez.
 */
export const supabase = createClient(url, anon, {
  auth: {
    ...(Platform.OS === "web" ? {} : { storage: AsyncStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});

// Uygulama ön plandayken jetonu yenile (Supabase önerisi)
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (durum) => {
    if (durum === "active") void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
