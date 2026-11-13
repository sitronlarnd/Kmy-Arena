import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { kacir, kalinParcalar, matematikVarMi, mdHtml } from "@/lib/md";

const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.19.1/dist/katex.min.css";

/**
 * iOS/Android: matematik içeren metin KaTeX ile WebView'de çizilir, yükseklik
 * içeriğe göre ayarlanır. Matematik yoksa düz Text (hızlı, WebView yok).
 */
export function MatematikMetni({ md, renk, boyut = 17 }: { md: string; renk: string; boyut?: number }) {
  const [yukseklik, setYukseklik] = useState(boyut * 2);
  const html = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="${KATEX_CSS}">
<style>html,body{margin:0;padding:0;background:transparent;color:${kacir(renk)};font:${boyut}px/1.55 -apple-system,Roboto,sans-serif}p{margin:0 0 8px}.katex-display{overflow-x:auto;overflow-y:hidden}</style>
</head><body><div id="k">${mdHtml(md)}</div>
<script>function b(){window.ReactNativeWebView.postMessage(String(document.getElementById('k').scrollHeight))}
window.addEventListener('load',b);new ResizeObserver(b).observe(document.getElementById('k'));setTimeout(b,300);</script>
</body></html>`,
    [md, renk, boyut],
  );
  if (!matematikVarMi(md)) {
    return (
      <Text style={{ color: renk, fontSize: boyut, lineHeight: boyut * 1.5 }}>
        {kalinParcalar(md).map((p, i) => (
          <Text key={i} style={p.kalin ? { fontWeight: "800" } : undefined}>{p.metin}</Text>
        ))}
      </Text>
    );
  }
  return (
    // pointerEvents none: şık düğmesinin içindeyken dokunuşu WebView yutmasın
    <View style={{ height: yukseklik }} pointerEvents="none">
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        scrollEnabled={false}
        style={{ backgroundColor: "transparent" }}
        onMessage={(e) => {
          const h = Number(e.nativeEvent.data);
          if (Number.isFinite(h) && h > 0) setYukseklik(Math.ceil(h) + 4);
        }}
      />
    </View>
  );
}
