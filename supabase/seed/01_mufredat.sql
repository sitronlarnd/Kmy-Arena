-- OTOMATİK ÜRETİLDİ: scripts/mufredat-sql.ts — elle düzenleme, JSON'u düzenle.

insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_matematik'), 'lgs_matematik', 'Matematik', 'LGS', 'zeka', 0)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:M.8.1.1'), app.sabit_uuid('ders:lgs_matematik'), 'M.8.1.1', 'Çarpanlar ve Katlar', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.1.1'), app.sabit_uuid('unite:M.8.1.1'), 'M.8.1.1.1', 'Verilen pozitif tam sayıların pozitif tam sayı çarpanlarını bulur ve üslü ifadelerin çarpımı şeklinde yazar.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.1.2'), app.sabit_uuid('unite:M.8.1.1'), 'M.8.1.1.2', 'İki doğal sayının EBOB ve EKOK''unu hesaplar, ilgili problemleri çözer.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.1.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.1.3'), app.sabit_uuid('unite:M.8.1.1'), 'M.8.1.1.3', 'Verilen iki doğal sayının aralarında asal olup olmadığını belirler.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.1.2')], 2)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:M.8.1.2'), app.sabit_uuid('ders:lgs_matematik'), 'M.8.1.2', 'Üslü İfadeler', 8, 1)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.2.1'), app.sabit_uuid('unite:M.8.1.2'), 'M.8.1.2.1', 'Tam sayıların, tam sayı kuvvetlerini hesaplar.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.2.2'), app.sabit_uuid('unite:M.8.1.2'), 'M.8.1.2.2', 'Üslü ifadelerle ilgili temel kuralları anlar, birbirine denk ifadeler oluşturur.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.2.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.2.3'), app.sabit_uuid('unite:M.8.1.2'), 'M.8.1.2.3', 'Sayıların ondalık gösterimlerini 10''un tam sayı kuvvetlerini kullanarak çözümler.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.2.2')], 2)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:M.8.1.3'), app.sabit_uuid('ders:lgs_matematik'), 'M.8.1.3', 'Kareköklü İfadeler', 8, 2)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.3.1'), app.sabit_uuid('unite:M.8.1.3'), 'M.8.1.3.1', 'Tam kare pozitif tam sayılarla bu sayıların karekökleri arasındaki ilişkiyi belirler.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.2.1')], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:M.8.1.3.2'), app.sabit_uuid('unite:M.8.1.3'), 'M.8.1.3.2', 'Tam kare olmayan kareköklü bir ifadenin değerinin hangi iki doğal sayı arasında olduğunu belirler.', 8, 'LGS', array[app.sabit_uuid('kazanim:M.8.1.3.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_fen'), 'lgs_fen', 'Fen Bilimleri', 'LGS', 'enerji', 1)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:F.8.1'), app.sabit_uuid('ders:lgs_fen'), 'F.8.1', 'Mevsimler ve İklim', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:F.8.1.1.1'), app.sabit_uuid('unite:F.8.1'), 'F.8.1.1.1', 'Mevsimlerin oluşumuna yönelik tahminlerde bulunur.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:F.8.1.2.1'), app.sabit_uuid('unite:F.8.1'), 'F.8.1.2.1', 'İklim ve hava olayları arasındaki farkı açıklar.', 8, 'LGS', '{}'::uuid[], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_turkce'), 'lgs_turkce', 'Türkçe', 'LGS', 'bilgelik', 2)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:T.8.3'), app.sabit_uuid('ders:lgs_turkce'), 'T.8.3', 'Okuma', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:T.8.3.14'), app.sabit_uuid('unite:T.8.3'), 'T.8.3.14', 'Metinle ilgili sorular sorar ve cevaplar.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:T.8.3.24'), app.sabit_uuid('unite:T.8.3'), 'T.8.3.24', 'Okuduğu metindeki ana fikri ve yardımcı fikirleri belirler.', 8, 'LGS', '{}'::uuid[], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_inkilap'), 'lgs_inkilap', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'LGS', 'strateji', 3)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:İTA.8.1'), app.sabit_uuid('ders:lgs_inkilap'), 'İTA.8.1', 'Bir Kahraman Doğuyor', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:İTA.8.1.1'), app.sabit_uuid('unite:İTA.8.1'), 'İTA.8.1.1', 'Avrupa''daki gelişmelerin Osmanlı Devleti''ne etkilerini kavrar.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_din'), 'lgs_din', 'Din Kültürü ve Ahlak Bilgisi', 'LGS', 'strateji', 4)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:DKAB.8.1'), app.sabit_uuid('ders:lgs_din'), 'DKAB.8.1', 'Kader İnancı', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:DKAB.8.1.1'), app.sabit_uuid('unite:DKAB.8.1'), 'DKAB.8.1.1', 'Evrendeki düzen ile kader arasında ilişki kurar.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:lgs_ingilizce'), 'lgs_ingilizce', 'İngilizce', 'LGS', 'ceviklik', 5)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:E8.1'), app.sabit_uuid('ders:lgs_ingilizce'), 'E8.1', 'Friendship', 8, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:E8.1.R1'), app.sabit_uuid('unite:E8.1'), 'E8.1.R1', 'Arkadaşlıkla ilgili kısa metinlerde belirli bilgileri bulur.', 8, 'LGS', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:tyt_matematik'), 'tyt_matematik', 'Temel Matematik', 'TYT', 'zeka', 0)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:TYT.M.1'), app.sabit_uuid('ders:tyt_matematik'), 'TYT.M.1', 'Temel Kavramlar ve Sayılar', 12, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.M.1.1'), app.sabit_uuid('unite:TYT.M.1'), 'TYT.M.1.1', 'Sayı kümelerini ve temel kavramları kullanarak işlem yapar.', 12, 'TYT', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.M.1.2'), app.sabit_uuid('unite:TYT.M.1'), 'TYT.M.1.2', 'Bölünebilme kurallarını kullanarak problem çözer.', 12, 'TYT', array[app.sabit_uuid('kazanim:TYT.M.1.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.M.1.3'), app.sabit_uuid('unite:TYT.M.1'), 'TYT.M.1.3', 'Rasyonel ve ondalık sayılarla işlem yapar.', 12, 'TYT', array[app.sabit_uuid('kazanim:TYT.M.1.1')], 2)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:TYT.M.2'), app.sabit_uuid('ders:tyt_matematik'), 'TYT.M.2', 'Problemler', 12, 1)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.M.2.1'), app.sabit_uuid('unite:TYT.M.2'), 'TYT.M.2.1', 'Sayı ve kesir problemlerini çözer.', 12, 'TYT', array[app.sabit_uuid('kazanim:TYT.M.1.3')], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.M.2.2'), app.sabit_uuid('unite:TYT.M.2'), 'TYT.M.2.2', 'Yüzde, kâr-zarar ve faiz problemlerini çözer.', 12, 'TYT', array[app.sabit_uuid('kazanim:TYT.M.2.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.ders (id, kod, ad, sinav_turu, ozellik, sira) values (app.sabit_uuid('ders:tyt_turkce'), 'tyt_turkce', 'Türkçe', 'TYT', 'bilgelik', 1)
  on conflict (kod) do update set ad = excluded.ad, ozellik = excluded.ozellik, sira = excluded.sira;
insert into public.unite (id, ders_id, kod, ad, sinif_duzeyi, sira) values (app.sabit_uuid('unite:TYT.T.1'), app.sabit_uuid('ders:tyt_turkce'), 'TYT.T.1', 'Paragraf', 12, 0)
  on conflict (kod) do update set ad = excluded.ad, sinif_duzeyi = excluded.sinif_duzeyi, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.T.1.1'), app.sabit_uuid('unite:TYT.T.1'), 'TYT.T.1.1', 'Paragrafta ana düşünceyi belirler.', 12, 'TYT', '{}'::uuid[], 0)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
insert into public.kazanim (id, unite_id, kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, sira) values (app.sabit_uuid('kazanim:TYT.T.1.2'), app.sabit_uuid('unite:TYT.T.1'), 'TYT.T.1.2', 'Paragrafta yardımcı düşünceleri ve anlatım biçimlerini belirler.', 12, 'TYT', array[app.sabit_uuid('kazanim:TYT.T.1.1')], 1)
  on conflict (kod) do update set aciklama = excluded.aciklama, on_kosullar = excluded.on_kosullar, sira = excluded.sira;
