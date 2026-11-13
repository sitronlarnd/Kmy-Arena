-- ─────────────────────────────────────────────────────────────
-- 0014 · Maliyet: soru üretimi gemini-3.6-flash, doğrulama claude-haiku-5-5
--         (proje sahibi kararı, 2026-11-13: sonnet pahalı)
--
-- Üretici ve doğrulayıcı farklı model aileleri olur (şartnamenin istediği gibi).
-- Üretimin yedeği claude-haiku-5-5; doğrulamanın yedeği yok (soru atılır).
-- Öğretmen için soru ürettirme ve diğer görevler değişmez.
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
       case gorev when 'soru_uretim' then 'gemini-3.6-flash' else 'claude-haiku-5-5' end,
       case gorev when 'soru_uretim' then 'claude-haiku-5-5' else null end,
       sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, surum + 1, 'yayinda', now()
from eski;
