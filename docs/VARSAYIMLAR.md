# Varsayımlar ve şartnameden sapmalar

Şartname (PDF) ile proje sahibinin sonradan aldığı kararlar çeliştiğinde **kararlar geçerlidir**.
Belirsiz kalan noktalarda en makul varsayım yapıldı ve buraya yazıldı.

## Proje sahibinin kararları (PDF'i geçersiz kılar)

| # | Konu | PDF | Karar / uygulama |
|---|---|---|---|
| 1 | Soru havuzu | "Soru havuzu yok", soru gösterildikten sonra bir daha kimseye sunulmaz | AI sürekli üretir; doğrulanmış her soru **platform geneli havuza** girer ve farklı öğrencilere tekrar sunulur. Aynı öğrenci aynı soruyu asla iki kez görmez (`soru_gosterim` birincil anahtarı). Düelloda yalnızca taze/az kullanılmış sorular (`HAVUZ_AYARLARI`). Zorluk 20+ cevapla yeniden kalibre edilir (`olculmusZorluk`). Üretim yalnızca havuz yetmediğinde tetiklenir. Hedef: AI maliyetinde %90+ düşüş. |
| 2 | Kapsam | Prototip, demo için minimum fazlar | Faz 0-7'nin tamamı, her faz çalışır ve test edilmiş biter. |
| 3 | Altyapı | Fastify + Socket.IO + Redis + BullMQ, Docker Compose, tek sunucu | **Sunucusuz:** Vercel Pro (Expo web, Next.js paneller, tanıtım, API) + Supabase Cloud Pro Frankfurt. Ayrıntı aşağıda. |
| 4 | AI modelleri | Üretici ve doğrulayıcı farklı model aileleri | **2026-11-13 (maliyet kararı):** üretici ve doğrulayıcı `claude-haiku-5-5` (üretimin yedeği `claude-haiku-4-5`; doğrulamanın yedeği yok: ulaşılamazsa soru atılır). Öğretmen için soru ürettirme ve asistan/görsel/veli raporu `claude-sonnet-5-5`. claude-sonnet-4-6 kullanılmaz; gemini-3.6-flash kısa süre denendi, proje sahibinin kararıyla geri alındı (0015). Model adları KMYAI'deki adlardır; ortam değişkeninden ve Merkez Panelden (`ai_gorev_ayari`, sürümlü) değişir. |
| 5 | Satış | Teklif formu + pilot butonu | "30 gün ücretsiz pilot" ana satış aracı; pilot sonunda dershaneye otomatik etki raporu (Faz 7, Vercel Cron). |

## Sunucusuz mimaride bileşen karşılıkları

| PDF'teki bileşen | Yerine |
|---|---|
| Fastify oyun/AI sunucusu | `apps/api` (Vercel fonksiyonları) + Postgres fonksiyonları |
| Socket.IO düello odaları | Supabase Realtime (Broadcast + Presence). İstemci yalnızca **dinler**; cevaplar HTTP ile API'ye gider, kontrol ve puanlama sunucuda yapılır, sonucu sunucu yayınlar. `packages/realtime` soyutlaması sayesinde 500 eşzamanlı bağlantı aşılınca ayrı küçük bir sunucuya geçiş yalnızca yeni bir sağlayıcı yazmayı gerektirir. |
| Redis AI soru tamponu | `soru` tablosu (havuz) + kısmi indeksler |
| Redis eşleştirme kuyruğu | Postgres tablosu + `FOR UPDATE SKIP LOCKED` (Faz 3) |
| Redis sıralama (sorted set) | Postgres sorguları / gerektiğinde materialized view (Faz 2) |
| Redis oran sınırlama | Postgres tabanlı sayaç (Faz 1) |
| BullMQ işleri | Vercel Cron (`apps/api/vercel.json`) + Supabase pg_cron |
| Docker Compose | Yok; yerel geliştirme `supabase start` ile |

## Diğer varsayımlar

1. **Üretici ve doğrulayıcı aynı model (`claude-haiku-5-5`).** PDF farklı aile istiyordu; proje sahibi maliyet nedeniyle bu modeli seçti. PDF farklı aile istiyordu. Bağımsızlık şöyle korunur: ayrı çağrı, ayrı prompt, doğrulayıcı cevap anahtarını ve çözümü GÖRMEDEN soruyu baştan çözer, sıcaklık 0 (üretici 0,8); sayısal sonuç sunucuda mathjs ile, biçim ve şık kuralları kodla ayrıca denetlenir. Hata bildirimi oranı izlenir (Merkez Panel); yükselirse doğrulayıcı farklı bir modele alınabilir.
2. **AI soruları platform genelidir** (`soru.dershane_id` boş). Öğretmen soruları dershaneye aittir ve günlük akışa girmez.
3. **Öğretmenin dershane geneli akademik okuma yetkisi yoktur.** Öğrenci verisine yalnızca atandığı sınıflar üzerinden erişir (PDF: "atanmadığı sınıfların bireysel verisini göremez"). Testlerde yakalanan bir hata üzerine düzeltildi.
4. **Merkez Panel işlemleri** sunucuda service role ile, yetki kontrolü ve denetim kaydıyla yapılır; RLS'te merkez ekibine genel istisna yoktur.
5. **Rehber öğretmen** Faz 0'da dershane genelinde görür. Öğrenci bazlı atama (`risk_skoru.atanan_rehber`) Faz 6'da daraltılır.
6. **Zorluk ölçeği:** PDF formülüyle (d = 800 + 130 × (zorluk − 1)) başlangıç θ = 1000 olan öğrenci için E = 0,70 hedefi zorluk ≈ 1'e denk gelir; yani tespit sınavı yapılmadan herkes en kolay sorudan başlar. Başlangıç θ'yı tespit sınavı belirleyecek (Faz 1). Gerekirse `zorlukTabanPuan` Merkez Panelden ayarlanabilir.
7. **Seviye eğrisi** PDF'te yoktu: seviye L için toplam XP = 100 × (L − 1)^1,6.
8. **Davet kodu:** 8 karakter, karışan karakterler (I, O, 0, 1) yok, varsayılan 30 gün geçerli.
9. **Veli onayı:** 18 yaş ve üstü öğrenci ile personel/veliler için otomatik verilir; 18 altı öğrencide veli onaylayana kadar sosyal özellikler kapalı.
10. **Hedef yaş beyanı 13+.** 7. sınıf öğrencileri (12-13 yaş) için durum avukat ve mağaza politikalarıyla netleştirilecek.
11. **Müfredat** (2026-11-13): LGS 6 ders / 173 kazanım (8. sınıf öğretim programları), TYT 10 ders / 204, AYT 10 ders / 145, YDT 1 ders / 17 — toplam 539. 2027 sınavları mevcut programla yapılır (Maarif uyumlu soru modeli 2028'de). Kaynak `scripts/mufredat_veri.py` → `seed/mufredat/*.json` → `supabase/seed/01_mufredat.sql`. Faz 0'dan gelen kodlar (M.8.*, TYT.M.* vb.) korunur; yeni kazanımlar **platform kodu** alır (ör. `LGS.FEN.03.02`), resmî MEB kodu değildir. YKS'de kazanım = dershanelerin kullandığı konu/alt konu. Ön koşul ünite içinde sıralı. 2028 YKS kuşağı (Maarif) için müfredat güncellemesi gerekecek.
12. **Seed:** Deneme sonuçları, klanlar ve düello kayıtları ilgili tabloların geldiği fazlarda eklenir.
13. **Test aracı:** Birim testleri Node'un yerleşik `node:test`'i ile yazıldı (ek bağımlılık yok), `tsx` ile çalışır.
14. **Next.js 16:** Oturum yenileme `middleware.ts` yerine yeni adıyla `proxy.ts` içinde.
15. **Expo paket sürümleri:** SDK 57 sürümlerine sabitlendi (`~`). SDK yükseltmesinde `pnpm --filter @kmy/mobile surumleri-duzelt` çalıştırılır ve `pnpm-workspace.yaml` içindeki `overrides` SDK listesine göre güncellenir.
16. **Takma ad filtresi** Faz 0'da yalnızca biçim denetimi (3-20 karakter, harf/rakam/nokta/alt çizgi). Küfür ve kişisel bilgi filtresi Faz 1'de.
17. **Cevap tablosu** aylık bölümlenir; bölümler pg_cron (yoksa Vercel Cron) ile her ayın 25'inde bir sonraki ay için oluşturulur. Varsayılan bölüm güvenlik ağıdır.
18. **Soru üretim zaman aşımı 90 sn** (şartname: 20 sn). Şartname soruların öğrenci isteği anında üretildiğini varsayıyordu; havuz kararıyla (#1) üretim arka planda yapılır ve öğrenciyi bekletmez. Canlı testte `claude-sonnet-4-6` 20 sn'de bitiremedi (her denemede yedek modele düştü). Öğrencinin beklediği süre (havuzdan soru) 1,5 sn hedefinde kalır.
19. **Doğru şık harfi hat tarafından seçilir** ve üreticiye söylenir; harfler kazanım bazında en az kullanılandan dağıtılır (şartnamedeki "doğru şık dengeli dağılmış" filtresi bu şekilde garanti edilir).
20. **Türkçe yazım denetimi** ayrı bir yazım denetleyicisiyle değil, doğrulayıcı modelin "yazım hatası" bulgusuyla yapılır (Türkçe için güvenilir, sunucusuz çalışan bir denetleyici yok). Ek olarak kural tabanlı filtreler: şık sayısı, aynı şıklar, şık uzunluk dengesi, olumsuz kökün kalın yazılması, dengesiz LaTeX, şıkların soru metninde tekrarı.
21. **Süre hilesi:** istemcinin bildirdiği çözüm süresi, sunucunun gösterim → cevap arasında ölçtüğü süreye ±2 sn sıkıştırılır; çok hızlı cevaplar (tahmini sürenin %15'inden kısa) ne beceriyi ne XP'yi etkiler.
22. **Tespit sınavı:** ders başına 10 soru, E ≈ 0,5 hedefli (en bilgilendirici), azalan K (160 → 40). Bitince dersin henüz çözülmemiş kazanımları tespit θ'sıyla başlar. Öğretmenin yeniden ataması Faz 6'da.
23. **Hata bildirimi eşiği:** bir soru en az 3 bildirim alır ve bildirim/gösterim oranı %5'i geçerse gece işi onu akıştan çeker (`emekli`, "inceleme bekliyor"). Öğretmen onayı ve XP iadesi Faz 6 panelinde.
24. **Panel → API adresi:** `NEXT_PUBLIC_API_URL` tanımlı değilse şimdilik `https://api-bice-phi-66.vercel.app` kullanılır; alan adı bağlanınca ortam değişkeni girilmeli.
25. **LGS / YKS paketleri:** `paket.sinav_gruplari` ({LGS}, {YKS} veya ikisi). Öğrencinin grubu: elle atama (`kullanici.sinav_grubu`) → sınıfının sınav türü → paketin tek grubu; grup dershanenin paketinde yoksa öğrenciye hiçbir ders açılmaz. YKS alanı (SAY/EA/SÖZ/DİL) AYT/YDT derslerini daraltır: SAY → AYT Mat, Geo, Fizik, Kimya, Biyoloji; EA → Mat, Geo, Edebiyat, Tarih, Coğrafya; SÖZ → Edebiyat, Tarih, Coğrafya, Felsefe Grubu, Din; DİL → YDT. Alan boşsa tüm AYT dersleri. Atama ekranı Faz 6 (dershane paneli).
26. **Havuz ön ısıtma kapsamı:** cron yalnızca lisansı süren dershanelerin paketlerindeki sınav gruplarını ön ısıtır (kolay bantlarda kazanım başına 2 soru), son 7 günde çözülen kazanımlarda bant başına 8 soruya tamamlar ve bir çalıştırmada (10 dk) en fazla 10 soru üretir (`HAVUZ_AYARLARI.cronMaxSoru`).
27. **Lig puanı haftalık XP'dir** (Kupa yalnızca düello/klan savaşında, Faz 3). Şartnamedeki "haftalık lig: benzer seviyedeki 20-30 kişi" grubu dershane içi ve aynı lig kademesindeki öğrencilerden, ilk XP kazanıldığında otomatik kurulur; küçük dershanelerde grup 20'den küçük olabilir.
28. **Animasyonlar** Lottie yerine React Native Animated ile (ek paket ve lisanslı animasyon dosyası gerekmez). Karakterler emoji tabanlı; ileride özgün çizimlerle değiştirilebilir.
29. **Oyun kataloğu** (rozet, görev, eşya) `packages/shared` içinde tek kaynak; veritabanı yalnızca kodları tutar. Fiyat/ödül değerlerinin Merkez Panelden değiştirilmesi Faz 6'da.
30. **Seri ve hafta** Europe/Istanbul saatine göre; hafta pazartesi başlar. Sezon 1, 2026-11-02 haftasıyla başlar.
31. **KMYAI hız sınırı:** istekler arası en az 3 sn (platform geneli). Saatte en fazla ~1200 istek; havuz cron'u 10 dakikada en fazla 4 soru üretir. CLIProxy kapasitesine göre `uygulama_ayari.ai_istek_araligi_ms` değiştirilebilir.
32. **Düello cevapları beceri puanını (θ) değiştirmez**; yalnız Kupa, XP ve ilerleme sayaçlarını etkiler (hız baskısı ölçümü bozmasın diye).
33. **Gerçek zaman:** Realtime yalnız "değişti" dürtüsü taşır; durum her zaman sunucudan okunur (yoklama 1 sn). Bu, anahtar sızıntısını ve istemci hilesini önler.
34. **Sınıf turnuvası** (şartnamede öğretmen başlatır) Faz 6 öğretmen paneliyle birlikte yapılacak.
35. **Bir öğrencinin aynı anda tek aktif düellosu** olur; kuyruk isteği varsa mevcut düelloya yönlendirir.
36. **Klan katkısı** her sayılan cevaptır (doğru/yanlış); boss ve savaş etkisi yalnız doğru cevaptan gelir. Savaş penceresinde her sayılan soru bir hak harcar (savaş için ayrı mod yok; öğrenci bölgenin dersinden soru çözer).
37. **Strateji özelliği** savaşta en fazla %10 etki artışı verir ("bölge savunma gücü"nün sade karşılığı); düello sonucunu etkileyen hiçbir özellik yoktur.
38. **Savaşa giriş** için klanın en az 5 üyesi olmalı; tek kalan klan o hafta eşleşmez. Canlı klan düellosu (Pazar 20:00 bayrak yarışı), dershane takımı / aylık dershaneler arası turnuva ve dershane sezon ödülleri Faz 6 panelleriyle birlikte yapılacak.
39. **Klan adı onayı** varsayılan olarak otomatik filtreyle yapılır; dershane `ayarlar.klan_onayi` açarsa öğretmen onayı beklenir. Öğretmenin sınıf bazlı klan kurması ve onay ekranı Faz 6 öğretmen panelinde.
40. **Moderasyon filtresi** kelime listesi + kalıp tabanlıdır (Türkçe normalizasyon, leet, harf tekrarı). Görsel moderasyonu Faz 5'te (fotoğraf yükleme ile) eklenecek.
41. **Topluluk AI** ön değerlendirmesi isteği bekletmemek için `after()` ile yanıt sonrası çalışır; KMYAI kapalıysa cevap öğretmen/öğrenci kabulüne kalır, hiçbir akış AI'ya bağımlı değildir.
42. **Risk puanı** basit kurallarla (0-100): 7+ gün hareketsizlik, son hafta doğruluk düşüşü, geciken ödev, hiç başlamamış. Makine öğrenmesi modeli yerine açıklanabilir kurallar seçildi; nedenler panelde metin olarak görünür.
43. **Push bildirimleri** Expo Push ile (0023). Sessiz saat varsayılanı 22:00–08:00 (Türkiye); sessiz saatte biriken bildirim sabah gönderilir, 12 saatten eskisi atılır. EAS proje kimliği olmadan (eas init öncesi) uygulama bildirimsiz çalışır.
44. **Veliye haftalık e-posta** şablon metinle (AI yok, kişisel veri sağlayıcıya gitmez); Resend anahtarı ve doğrulanmış gönderen alan adı tanımlanınca gönderilmeye başlar. Veli uygulamadan kapatabilir.
45. **Öğretmenin sınıf klanı kurması, sınıf turnuvası, dershaneler arası turnuva ve dershane sezon ödülleri** ertelendi; mevcut klan/düello altyapısının üzerine eklenebilir.
46. **Fiyat** tanıtım sitesinde gösterilmez ("Teklif alın"); öğrenci başı aylık lisans varsayıldı. Ödeme alma (iyzico vb.) kapsam dışı; lisans durumu Merkez panelinden elle yönetilir.
47. **Hesap silme** 30 gün bekletmeli (yanlışlıkla silmeye karşı); bu sürede hesap kapalıdır, geri alma dershane yöneticisi aracılığıyla.
48. **18 yaş altı sosyal özellikler** (topluluk sorusu/cevabı, klan sohbeti) veli onayı olmadan sunucuda reddedilir; doğum yılı bilinmeyen öğrenci reşit değil sayılır.
49. **Canlı veritabanı** 2026-11-14'te demodan çıkarıldı; yalnızca merkez sahibi ve mağaza inceleme dershanesi kaldı. Demo verisi yalnızca yerel testte kullanılır.
50. **Bayi/alt bayi sistemi** şartnamede isteğe bağlı olduğu için yapılmadı; dershaneler doğrudan merkezden yönetilir.
51. **Turnuva maçları** eşzamansız düellodur (her maç 24 saat içinde); maçı oynamayan taraf hükmen yenilir, ikisi de oynamazsa sıralamada üstteki geçer.
52. **Mağaza eşyalarının görseli** uygulama paketindedir; merkez panelinden fiyat/indirim/görünürlük değişir, yeni görsel için uygulama güncellemesi gerekir.
53. **AI maliyeti** model başı token fiyatı × kullanım ile hesaplanır; fiyatlar `/merkez/sistem`'den girilir, TL karşılığı `USD_TL_KURU` ile. Kâr marjı dershanenin aylık ücretine göre gösterilir.
54. **Merkez paneli** 2FA zorunlu; hata izleme (Sentry) entegre edilmedi, hatalar Vercel günlüklerinden ve `/merkez/sistem` sağlık ekranından izlenir.
55. **Deneme sonuçları** Excel/CSV ile öğrenci no veya ad-soyad eşleşerek alınır; eşleşmeyen satırlar atlanır ve listelenir.

