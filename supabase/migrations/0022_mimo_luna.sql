-- ─────────────────────────────────────────────────────────────
-- 0022 · Proje sahibi kararı (2026-11-14): soru üretimi mimo-v2.6-flash,
--         doğrulama gpt-6-luna. Üretimin yedeği claude-haiku-5-5;
--         doğrulamanın yedeği yok (doğrulanamayan soru atılır).
-- ─────────────────────────────────────────────────────────────
with eski as (
  update public.ai_gorev_ayari
  set durum = 'arsiv'
  where durum = 'yayinda' and kapsam = 'genel' and gorev in ('soru_uretim', 'soru_dogrulama')
  returning *
)
insert into public.ai_gorev_ayari (gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, max_token,
                                   zaman_asimi_ms, yeniden_deneme, surum, durum, yayin_tarihi)
select gorev, kapsam, kapsam_id,
       case gorev when 'soru_uretim' then 'mimo-v2.6-flash' else 'gpt-6-luna' end,
       case gorev when 'soru_uretim' then 'claude-haiku-5-5' else null end,
       sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, surum + 1, 'yayinda', now()
from eski;
