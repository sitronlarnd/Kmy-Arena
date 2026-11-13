-- 0011 · claude-sonnet-5-5 üretimde 2500 token sınırına dayanıp JSON'u yarıda
-- kesiyordu (canlı test, 2026-11-13). Üretim görevlerinde sınır 4000.
with eski as (
  update public.ai_gorev_ayari
  set durum = 'arsiv'
  where durum = 'yayinda' and kapsam = 'genel' and gorev in ('soru_uretim', 'ogretmen_soru_uretim')
  returning *
)
insert into public.ai_gorev_ayari (gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, max_token,
                                   zaman_asimi_ms, yeniden_deneme, surum, durum, yayin_tarihi)
select gorev, kapsam, kapsam_id, model_birincil, model_yedek, sicaklik, 4000, zaman_asimi_ms, yeniden_deneme,
       surum + 1, 'yayinda', now()
from eski;
