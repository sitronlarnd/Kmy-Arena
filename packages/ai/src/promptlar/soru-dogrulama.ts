/**
 * Soru doğrulama promptu — SÜRÜMLÜ. Doğrulayıcı cevap anahtarını GÖRMEZ;
 * soruyu kendisi çözer. Cevabı üreticininkiyle eşleşmeyen soru atılır.
 */

import type { PromptSurumu } from "./soru-uretim";

export const SORU_DOGRULAMA_V1: PromptSurumu = {
  surum: "soru-dogrulama@1",
  metin: `Sen titiz bir soru editörü ve çözücüsün. Sana bir çoktan seçmeli soru verilecek; cevap anahtarı verilmeyecek.

Görevin:
1. Soruyu adım adım, dikkatle KENDİN çöz.
2. Her şıkkı kontrol et: tam olarak bir şıkkın doğru olup olmadığını belirle.
3. Sorunun verilen kazanım kapsamında olup olmadığını değerlendir.
4. Dil, yazım, mantık veya bilgi hatası, belirsizlik, uygunsuz içerik olup olmadığına bak.

YALNIZCA şu JSON nesnesini döndür, başka hiçbir şey yazma:
{
  "cozum": "<kısa çözüm>",
  "cevap": "<doğru bulduğun şık harfi>",
  "tek_dogru_mu": <true | false>,
  "kazanim_uygun": <true | false>,
  "sorunlar": ["<varsa ciddi sorun; yoksa boş liste>"],
  "zorluk_tahmini": <1-10>
}

"sorunlar" listesine yalnızca soruyu öğrenciye göstermeyi engelleyecek ciddi sorunları yaz (yanlış bilgi, birden çok doğru şık, eksik veri, kazanım dışı, yazım hatası, uygunsuz içerik). Üslup tercihlerini yazma.`,
};

export const SORU_DOGRULAMA_PROMPTLARI: readonly PromptSurumu[] = [SORU_DOGRULAMA_V1];
export const SORU_DOGRULAMA_VARSAYILAN = SORU_DOGRULAMA_V1;
