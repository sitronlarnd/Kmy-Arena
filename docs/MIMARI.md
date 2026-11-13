# Mimari

```
                 ┌──────────────────────── Vercel Pro (fra1) ────────────────────────┐
 iOS/Android ──► │ apps/mobile (Expo web)   apps/panel   apps/landing   apps/api      │
 (EAS Build)     │                                                     │  Cron işleri │
                 └─────────────────────────────────────────────────────┼──────────────┘
        │ anon anahtar + kullanıcı JWT (RLS)                           │ service role (yalnızca sunucu)
        ▼                                                              ▼
 ┌──────────────────── Supabase Cloud Pro (Frankfurt) ─────────────────────────────┐
 │ Auth · Postgres (RLS, RBAC, Postgres fonksiyonları, pg_cron) · Storage · Realtime │
 └───────────────────────────────────────────────────────────────────────────────────┘
                                                               │
                                     apps/api ──► KMYAI (https://www.kmyai.cloud/api/v1, Claude)
```

## Temel kurallar

1. **İstemci yalnızca anon anahtarı bilir.** Okuma çoğunlukla doğrudan Supabase'den (RLS korumalı), yazma ve oyun mantığı API/Postgres fonksiyonlarından.
2. **Cevap anahtarı istemciye gitmez.** Öğrencinin `soru` tablosuna RLS erişimi yoktur. Sorular API'den `dogru`, çözüm ve çeldirici notları çıkarılarak gelir; cevaptan sonra çözüm ayrıca istenir.
3. **Puan, XP, Altın, Kupa, beceri yalnızca sunucuda hesaplanır** (`packages/shared/src/formuller.ts`). İlgili tablolarda istemcinin yazma ayrıcalığı kaldırılmıştır.
4. **Tenant ayrımı veritabanında.** Kullanıcı verisi içeren her tabloda `dershane_id` ve RLS politikası var. `supabase/tests/01_rls_test.sql`, `dershane_id` sütunu olan **her** tabloyu otomatik tarar.
5. **RBAC veritabanında.** `rol`, `yetki`, `rol_yetki` (varsayılan + dershane bazlı ince ayar), `kullanici_rol` (dershane/şube kapsamı). Kod tarafındaki tek kaynak `packages/shared/src/rbac.ts`; SQL tohumuyla eşliği testle denetlenir.
6. **Özellik bayrakları:** dershane kaydı > paket > genel kayıt (yüzde ile kademeli yayın) > kapalı. Aynı mantık TS'de (`ozellikAcikMi`) ve SQL'de (`app.ozellik_acik_mi`) var; kova fonksiyonunun eşliği testli.

## Soru havuzu akışı (Faz 1'de tamamlanır)

```
Vercel Cron (havuz-doldur) ─► her (kazanım, zorluk bandı) için stok kontrolü (uretimIhtiyaci)
   └─► gerekirse KMYAI üretici (claude-sonnet-4-6) ─► doğrulayıcı (claude-sonnet-5-5, anahtarı görmeden)
         └─► kalite filtreleri + mathjs ─► soru.durum = 'dogrulandi'
Öğrenci "Soru Çöz" ─► API: görmediği, doğrulanmış, hedef bantta soru (önce kullanılmış olanlar)
   └─► soru_gosterim (PK: kullanıcı+soru) ─► cevap ─► Elo güncelleme ─► 20+ cevapta kalibrasyon
Düello ─► yalnızca taze (≤3 gösterim, düelloda hiç kullanılmamış) sorular
```

## Gerçek zamanlı katman

`packages/realtime` iki arayüz tanımlar: `RealtimeSaglayici` (istemci dinler) ve `SunucuYayinci`
(sunucu yayınlar). Bugün Supabase Realtime (REST broadcast, kalıcı WebSocket gerekmez);
500 eşzamanlı bağlantı aşıldığında ayrı küçük bir sunucu için yalnızca yeni bir uygulama yazılır.

## AI katmanı

`packages/ai/src/kmyai-istemci.ts` tek adaptördür: OpenAI uyumlu `/chat/completions`, görev bazlı
zaman aşımı, 2 yeniden deneme, yedek modele geçiş, her denemenin `ai_cagri_log`'a yazılması,
giden içerikte bilinen kişisel değer varsa isteği göndermeden reddetme.
Model ayarı önceliği: dershane > paket > genel (Merkez Panel) > ortam değişkeni > koddaki varsayılan.
