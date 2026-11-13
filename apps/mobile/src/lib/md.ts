import katex from "katex";

/**
 * Soru metni (Markdown alt kümesi + LaTeX) → HTML. Kullanıcı girdisi değil,
 * doğrulanmış soru metnidir; yine de tüm metin HTML kaçışından geçer.
 * Desteklenen: $…$, $$…$$, **kalın**, *eğik*, satır sonu, paragraf.
 */
export function kacir(m: string): string {
  return m.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function satirIci(m: string): string {
  return kacir(m)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\n/g, "<br/>");
}

function matematik(ifade: string, blok: boolean): string {
  try {
    return katex.renderToString(ifade, { displayMode: blok, throwOnError: false, output: "html", strict: false });
  } catch {
    return kacir(ifade);
  }
}

export function mdHtml(md: string): string {
  const parcalar: string[] = [];
  const desen = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let son = 0;
  for (let e = desen.exec(md); e; e = desen.exec(md)) {
    parcalar.push(satirIci(md.slice(son, e.index)));
    parcalar.push(e[1] !== undefined ? matematik(e[1], true) : matematik(e[2] ?? "", false));
    son = e.index + e[0].length;
  }
  parcalar.push(satirIci(md.slice(son)));
  return parcalar
    .join("")
    .split(/(?:<br\/>){2,}/)
    .map((p) => `<p>${p}</p>`)
    .join("");
}

export function matematikVarMi(md: string): boolean {
  return /\$[^$]+\$/.test(md);
}

/** Matematik yoksa düz metin + kalın parçalar (WebView'e gerek yok). */
export function kalinParcalar(md: string): Array<{ metin: string; kalin: boolean }> {
  return md.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => (p.startsWith("**") && p.endsWith("**") ? { metin: p.slice(2, -2), kalin: true } : { metin: p, kalin: false }));
}
