/**
 * Sunucu saati eşitleme: her yanıtta sunucu zamanı gelir; ofset = sunucu − (gönderim + varış)/2.
 * Böylece iki cihaz soruyu aynı sunucu anında açar (hedef ≤ 300 ms fark).
 */
let ofset = 0;
let sonRtt = 0;

export function saatGuncelle(sunucuMs: number, gonderim: number, varis: number): void {
  const rtt = Math.max(0, varis - gonderim);
  const yeni = sunucuMs - (gonderim + varis) / 2;
  // Daha düşük gecikmeli ölçüm daha güvenilir
  if (sonRtt === 0 || rtt <= sonRtt * 1.5) ofset = yeni;
  sonRtt = sonRtt === 0 ? rtt : Math.round(sonRtt * 0.7 + rtt * 0.3);
}

export function sunucuSimdi(): number {
  return Date.now() + ofset;
}

export function olculenRtt(): number {
  return sonRtt;
}
