import "katex/dist/katex.min.css";
import { mdHtml } from "@/lib/md";

/** Web: KaTeX HTML'i doğrudan DOM'a basılır (yazı tipleri paketle gelir). */
export function MatematikMetni({ md, renk, boyut = 17 }: { md: string; renk: string; boyut?: number }) {
  return (
    <div
      style={{ color: renk, fontSize: boyut, lineHeight: 1.55, overflowX: "auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}
      dangerouslySetInnerHTML={{ __html: mdHtml(md) }}
    />
  );
}
