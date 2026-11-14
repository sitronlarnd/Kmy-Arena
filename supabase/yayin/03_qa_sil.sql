-- Geçici QA merkez hesabını ve test sırasında oluşan kayıtları siler
delete from auth.users where email = 'qa.merkez@kmyarena.app';
