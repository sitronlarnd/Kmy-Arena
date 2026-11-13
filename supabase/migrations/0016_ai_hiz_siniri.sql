-- ─────────────────────────────────────────────────────────────
-- 0016 · KMYAI'ye giden isteklerde PLATFORM GENELİ hız sınırı
--
-- Vercel'de birden fazla sunucu örneği (cron, ön ısıtma, öğrenci isteği sonrası
-- arka plan üretimi) aynı anda çalışabilir; örnek içi sınır yetmez. Her istek
-- buradan bir "sıra" alır: istekler arasında en az ai_istek_araligi_ms olur.
-- Değer Merkez Panelden değiştirilebilir (uygulama_ayari).
-- ─────────────────────────────────────────────────────────────
alter table public.uygulama_ayari
  add column ai_istek_araligi_ms integer not null default 3000 check (ai_istek_araligi_ms between 0 and 60000),
  add column ai_sonraki_istek timestamptz not null default now();

/** Sıradaki istek için beklenecek süre (ms). Sırayı atomik olarak ilerletir. */
create or replace function public.sistem_ai_sira()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot timestamptz;
begin
  update public.uygulama_ayari
  set ai_sonraki_istek = greatest(ai_sonraki_istek, clock_timestamp()) + make_interval(secs => ai_istek_araligi_ms / 1000.0)
  where id
  returning ai_sonraki_istek - make_interval(secs => ai_istek_araligi_ms / 1000.0) into v_slot;
  return greatest(0, ceil(extract(epoch from (v_slot - clock_timestamp())) * 1000))::integer;
end $$;
revoke execute on function public.sistem_ai_sira() from public, anon, authenticated;
grant execute on function public.sistem_ai_sira() to service_role;
