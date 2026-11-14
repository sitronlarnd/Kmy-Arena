-- Geçici QA merkez hesabı (canlı test için; 03_qa_sil.sql ile silinir)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', app.sabit_uuid('kullanici:qa.merkez'), 'authenticated', 'authenticated', 'qa.merkez@kmyarena.app', '$2b$10$.XTgcC1/2ADI3v6jDAwoJuUnC63mdbdJUc287I/v0HjP5k..tXpu2', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do update set encrypted_password = excluded.encrypted_password;
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (app.sabit_uuid('kullanici:qa.merkez')::text, app.sabit_uuid('kullanici:qa.merkez'), jsonb_build_object('sub', app.sabit_uuid('kullanici:qa.merkez')::text, 'email', 'qa.merkez@kmyarena.app', 'email_verified', true), 'email', now(), now(), now())
on conflict (provider_id, provider) do nothing;
insert into public.kullanici (id, tur, ad, soyad, kvkk_onay_tarihi) values (app.sabit_uuid('kullanici:qa.merkez'), 'merkez', 'QA', 'Test', now()) on conflict (id) do nothing;
insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id) values (app.sabit_uuid('kullanici:qa.merkez'), 'merkez_sahip', null) on conflict do nothing;
