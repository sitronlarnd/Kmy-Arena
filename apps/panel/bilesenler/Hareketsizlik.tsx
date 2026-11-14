"use client";

import { useEffect } from "react";

/** Merkez paneli: 30 dakika hareketsizlikte oturumu kapatır. */
export function Hareketsizlik({ dakika = 30 }: { dakika?: number }) {
  useEffect(() => {
    let son = Date.now();
    const dokun = () => { son = Date.now(); };
    const olaylar = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    for (const o of olaylar) window.addEventListener(o, dokun, { passive: true });
    const z = setInterval(() => { if (Date.now() - son > dakika * 60_000) window.location.href = "/cikis?neden=hareketsizlik"; }, 30_000);
    return () => { clearInterval(z); for (const o of olaylar) window.removeEventListener(o, dokun); };
  }, [dakika]);
  return null;
}
