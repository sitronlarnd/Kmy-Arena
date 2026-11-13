-- ─────────────────────────────────────────────────────────────
-- 0009 · Soru üretimi/doğrulaması için zaman aşımı ve token sınırı
--
-- Canlı test (2026-11-13): claude-sonnet-4-6 soru üretimi 20 sn'de bitmedi
-- (her denemede zaman aşımı → yedek modele düştü); doğrulayıcı 1200 token
-- sınırında JSON'u yarıda kesti. Üretim arka planda (havuz) çalıştığı için
-- 90 sn öğrenciyi bekletmez. Ayar Merkez Panelin sürüm mantığıyla değişir:
-- eski yayın arşive, yeni sürüm yayına.
-- ─────────────────────────────────────────────────────────────

with eski as (
  update public.ai_gorev_ayari
  set durum = 'arsiv'
  where kapsam = 'genel' and durum = 'yayinda'
    and gorev in ('soru_uretim', 'soru_dogrulama', 'ogretmen_soru_uretim')
  returning *
)
insert into public.ai_gorev_ayari (gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, max_token,
                                   zaman_asimi_ms, yeniden_deneme, surum, durum, yayin_tarihi)
select gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, 2500, 90000, 1, surum + 1, 'yayinda', now()
from eski;
