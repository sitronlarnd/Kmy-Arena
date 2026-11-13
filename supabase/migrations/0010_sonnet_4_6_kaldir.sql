-- ─────────────────────────────────────────────────────────────
-- 0010 · claude-sonnet-4-6 kullanımdan kalkar (proje sahibi kararı, 2026-11-13)
--
-- Birincil model sonnet-4-6 olan görevler claude-sonnet-5-5'e, yedeği
-- sonnet-4-6 olanlar claude-haiku-4-5'e geçer. Doğrulayıcının yedeği
-- kaldırılır: doğrulayıcıya ulaşılamazsa soru daha zayıf bir modelle
-- doğrulanmaz, atılır ve sonra yeniden üretilir.
-- Merkez Panelin sürüm mantığı: eski yayın arşive, yeni sürüm yayına.
-- ─────────────────────────────────────────────────────────────

with eski as (
  update public.ai_gorev_ayari
  set durum = 'arsiv'
  where durum = 'yayinda'
    and ('claude-sonnet-4-6' in (model_birincil, coalesce(model_yedek, '')) or gorev = 'soru_dogrulama')
  returning *
)
insert into public.ai_gorev_ayari (gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, max_token,
                                   zaman_asimi_ms, yeniden_deneme, surum, durum, yayin_tarihi)
select gorev, kapsam, kapsam_id,
       case when model_birincil = 'claude-sonnet-4-6' then 'claude-sonnet-5-5' else model_birincil end,
       case when gorev = 'soru_dogrulama' then null
            when model_yedek = 'claude-sonnet-4-6' then 'claude-haiku-4-5'
            else model_yedek end,
       sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, surum + 1, 'yayinda', now()
from eski;
