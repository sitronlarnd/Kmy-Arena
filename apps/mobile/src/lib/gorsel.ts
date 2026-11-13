import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/** Kameradan ya da galeriden görsel seçer; 1280 px'e küçültüp JPEG base64 döndürür (fotoğraf cihazda kalır). */
export async function gorselSec(kaynak: "kamera" | "galeri"): Promise<{ base64: string; uri: string } | null> {
  if (kaynak === "kamera") {
    const izin = await ImagePicker.requestCameraPermissionsAsync();
    if (!izin.granted) return null;
  }
  const secenek: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1, allowsEditing: true };
  const r = kaynak === "kamera" ? await ImagePicker.launchCameraAsync(secenek) : await ImagePicker.launchImageLibraryAsync(secenek);
  const a = r.canceled ? null : r.assets[0];
  if (!a) return null;
  const genislik = Math.min(1280, a.width || 1280);
  const k = await manipulateAsync(a.uri, [{ resize: { width: genislik } }], { compress: 0.65, format: SaveFormat.JPEG, base64: true });
  return k.base64 ? { base64: k.base64, uri: k.uri } : null;
}
