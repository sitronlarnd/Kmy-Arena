import "server-only";

/** Resend ile e-posta (RESEND_API_KEY yoksa sessizce atlanır). Başarılıysa true. */
export async function epostaGonder(kime: string, konu: string, metin: string, html?: string): Promise<boolean> {
  const anahtar = process.env.RESEND_API_KEY;
  const kimden = process.env.EPOSTA_GONDEREN ?? "KMY Arena <bildirim@kmyai.cloud>";
  if (!anahtar) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${anahtar}`, "content-type": "application/json" },
      body: JSON.stringify({ from: kimden, to: [kime], subject: konu, text: metin, ...(html ? { html } : {}) }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
