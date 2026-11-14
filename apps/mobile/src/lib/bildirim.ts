import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { api } from "./api";

/**
 * Push bildirimi kaydı. Web'de, emülatörde veya EAS proje kimliği yokken
 * (eas init yapılmadan) sessizce atlanır; uygulama bildirimsiz de çalışır.
 */
Notifications.setNotificationHandler({
  handleNotification: () => Promise.resolve({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

let kayitli: string | null = null;

export async function bildirimKaydet(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("varsayilan", { name: "KMY Arena", importance: Notifications.AndroidImportance.DEFAULT, lightColor: "#6D5CFF" });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (token === kayitli) return;
    await api("/api/bildirim/kayit", { token, platform: Platform.OS });
    kayitli = token;
  } catch {
    // Bildirim kaydı başarısız olsa da uygulama çalışmaya devam eder.
  }
}

export async function bildirimKaydiniSil(): Promise<void> {
  if (!kayitli) return;
  await api("/api/bildirim/sil", { token: kayitli }).catch(() => undefined);
  kayitli = null;
}

/** Bildirime dokununca ilgili ekrana git. */
export function bildirimDinle(): () => void {
  if (Platform.OS === "web") return () => undefined;
  const ac = (r: Notifications.NotificationResponse | null) => {
    const yol = (r?.notification.request.content.data as { yol?: unknown } | undefined)?.yol;
    if (typeof yol === "string" && yol.startsWith("/")) router.push(yol as never);
  };
  void Notifications.getLastNotificationResponseAsync().then(ac);
  const abonelik = Notifications.addNotificationResponseReceivedListener(ac);
  return () => abonelik.remove();
}
