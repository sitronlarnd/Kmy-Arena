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

/**
 * v2: v1'de uzun çözüm yazılınca çıktı token sınırında kesiliyordu (canlı
 * test, 2026-11-13). Karar alanları başa alındı, çözüm en sona ve kısa.
 */
export const SORU_DOGRULAMA_V2: PromptSurumu = {
  surum: "soru-dogrulama@2",
  metin: `Sen titiz bir soru editörü ve çözücüsün. Sana bir çoktan seçmeli soru verilecek; cevap anahtarı verilmeyecek.

Görevin:
1. Soruyu kendi içinde dikkatle çöz ve her şıkkı kontrol et.
2. Tam olarak bir şıkkın doğru olup olmadığını belirle.
3. Sorunun verilen kazanım kapsamında olup olmadığını değerlendir.
4. Dil, yazım, mantık veya bilgi hatası, eksik veri, belirsizlik ya da uygunsuz içerik var mı bak.

YALNIZCA şu JSON nesnesini döndür, alanları bu sırayla yaz, başka hiçbir şey yazma:
{
  "cevap": "<doğru bulduğun şık harfi>",
  "tek_dogru_mu": <true | false>,
  "kazanim_uygun": <true | false>,
  "sorunlar": ["<varsa ciddi sorun; yoksa boş liste>"],
  "zorluk_tahmini": <1-10>,
  "cozum": "<en fazla 3 cümlelik özet çözüm>"
}

"sorunlar" listesine yalnızca soruyu öğrenciye göstermeyi engelleyecek ciddi sorunları yaz (yanlış bilgi, birden çok doğru şık, eksik veri, kazanım dışı, yazım hatası, uygunsuz içerik). Üslup tercihlerini yazma.`,
};

export const SORU_DOGRULAMA_PROMPTLARI: readonly PromptSurumu[] = [SORU_DOGRULAMA_V1, SORU_DOGRULAMA_V2];
export const SORU_DOGRULAMA_VARSAYILAN = SORU_DOGRULAMA_V2;
