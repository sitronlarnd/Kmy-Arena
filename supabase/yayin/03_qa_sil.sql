-- Geçici QA merkez hesabını ve canlı testlerde inceleme dershanesinde oluşan kayıtları siler.
begin;
-- Test turnuvalarının düelloları (turnuva_mac → duello bağı "set null" olduğu için önce)
delete from public.duello where id in (
  select m.duello_id from public.turnuva_mac m join public.turnuva t on t.id = m.turnuva_id
  where t.dershane_id = app.sabit_uuid('dershane:inceleme') and m.duello_id is not null);
delete from public.turnuva where dershane_id = app.sabit_uuid('dershane:inceleme');
delete from public.canli_oturum where dershane_id = app.sabit_uuid('dershane:inceleme') and sinif_id is not null;
delete from public.deneme where dershane_id = app.sabit_uuid('dershane:inceleme') and ad like 'QA %';
delete from public.destek_talep where dershane_id = app.sabit_uuid('dershane:inceleme') and konu like 'QA %';
delete from public.sinif where dershane_id = app.sabit_uuid('dershane:inceleme')
  and id not in (app.sabit_uuid('sinif:inceleme8'), app.sabit_uuid('sinif:inceleme12'));
delete from auth.users where email in ('qa.merkez@kmyarena.app', 'elif.deneme55@ogrenci.kmyarena.app');
commit;
