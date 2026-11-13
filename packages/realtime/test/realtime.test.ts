import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BellekIciRealtime, DUELLO_OLAYLARI, kanallar, SupabaseSunucuYayinci } from "../src/index";

describe("Realtime soyutlaması", () => {
  it("sunucunun yayınladığı olayı kanalı dinleyen iki oyuncu da alır", async () => {
    const rt = new BellekIciRealtime();
    const ad = kanallar.duello("d1");
    const a = rt.kanal(ad);
    const b = rt.kanal(ad);
    const alinan: string[] = [];
    a.dinle<{ sira: number }>(DUELLO_OLAYLARI.soru, (v) => alinan.push(`a${v.sira}`));
    b.dinle<{ sira: number }>(DUELLO_OLAYLARI.soru, (v) => alinan.push(`b${v.sira}`));
    await rt.yayinla(ad, DUELLO_OLAYLARI.soru, { sira: 1 });
    assert.deepEqual(alinan.sort(), ["a1", "b1"]);
    await a.kapat();
    await rt.yayinla(ad, DUELLO_OLAYLARI.soru, { sira: 2 });
    assert.deepEqual(alinan.sort(), ["a1", "b1", "b2"]);
  });

  it("varlık (presence) bildirimi ve ayrılma", async () => {
    const rt = new BellekIciRealtime();
    const a = rt.kanal("x");
    const b = rt.kanal("x");
    await a.varlikBildir({ oyuncu: "a" });
    await b.varlikBildir({ oyuncu: "b" });
    assert.equal(a.varliklar().length, 2);
    await b.kapat();
    assert.deepEqual(a.varliklar(), [{ oyuncu: "a" }]);
  });

  it("Supabase yayıncısı doğru REST ucuna service-role anahtarıyla gönderir", async () => {
    let url = "";
    let govde: unknown;
    const y = new SupabaseSunucuYayinci({
      supabaseUrl: "https://abc.supabase.co/",
      servisAnahtari: "gizli",
      fetch: async (u, init) => {
        url = String(u);
        govde = JSON.parse(String(init?.body));
        assert.equal(new Headers(init?.headers).get("apikey"), "gizli");
        return new Response(null, { status: 202 });
      },
    });
    await y.yayinla("duello:1", "tur_sonu", { kazanan: "a" });
    assert.equal(url, "https://abc.supabase.co/realtime/v1/api/broadcast");
    assert.deepEqual(govde, { messages: [{ topic: "duello:1", event: "tur_sonu", payload: { kazanan: "a" }, private: false }] });
  });
});
