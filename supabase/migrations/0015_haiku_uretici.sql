-- ─────────────────────────────────────────────────────────────
-- 0015 · Proje sahibi kararı (2026-11-13): gemini-3.6-flash iptal.
--         Soru üretimi ve doğrulaması claude-haiku-5-5.
-- Üretimin yedeği claude-haiku-4-5; doğrulamanın yedeği yok (soru atılır).
-- ─────────────────────────────────────────────────────────────
with eski as (
  update public.ai_gorev_ayari
  set durum = 'arsiv'
  where durum = 'yayinda' and kapsam = 'genel' and gorev in ('soru_uretim', 'soru_dogrulama')
  returning *
)
insert into public.ai_gorev_ayari (gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, max_token,
                                   zaman_asimi_ms, yeniden_deneme, surum, durum, yayin_tarihi)
select gorev, kapsam, kapsam_id, 'claude-haiku-5-5',
       case gorev when 'soru_uretim' then 'claude-haiku-4-5' else null end,
       sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, surum + 1, 'yayinda', now()
from eski;
