import { Bot, Crown, Flame, Lock, RotateCcw, Shield, Sparkles, Swords, Trophy } from "lucide-react";
import { TeklifFormu } from "./TeklifFormu";

const OZELLIKLER = [
  { ikon: Sparkles, renk: "#8b5cf6", baslik: "Seviyeye göre özgün sorular", metin: "Yapay zekâ MEB/ÖSYM kazanımlarına uygun soruyu üretir, ikinci bir model bağımsız çözerek doğrular. Her öğrenci kendi seviyesinde, kimse aynı soruyu iki kez görmez." },
  { ikon: Swords, renk: "#ff6a3d", baslik: "Düello ve Canlı Soru Saati", metin: "Sınıf arkadaşıyla gerçek zamanlı 5 soruluk düello, her akşam dershane çapında canlı yarışma. Rekabet soru çözdürür." },
  { ikon: Shield, renk: "#3fa9f5", baslik: "Klanlar ve boss savaşları", metin: "Öğrenciler klan kurar; klanın gücü yalnızca çözülen sorulardan gelir. Haftalık boss, klanın en zayıf konusundan çıkar." },
  { ikon: RotateCcw, renk: "#ff7ab6", baslik: "Hata defteri ve aralıklı tekrar", metin: "Yanlış yapılan her soru 1-3-7-21 gün aralıklarla geri gelir; konu kalıcı olana kadar." },
  { ikon: Bot, renk: "#2ee08a", baslik: "Sokratik asistan ve fotoğraftan çöz", metin: "Cevabı söylemeyen, sorularla düşündüren yapay zekâ asistanı. Takıldığı sorunun fotoğrafını çeken öğrenci benzerlerini çözerek öğrenir." },
  { ikon: Crown, renk: "#ffc53d", baslik: "Karakter, lig, rozet", metin: "Seviye atlayan karakterler, haftalık lig, 40+ rozet ve kozmetik mağaza. Satın alınabilen tek şey görünüm; avantaj yok." },
];

const SSS = [
  ["Sorular nereden geliyor, doğru mu?", "Sorular kazanım bazında yapay zekâ ile üretilir; ikinci bir model cevap anahtarını görmeden soruyu çözer, sonuç eşleşmezse soru öğrenciye hiç gösterilmez. Sayısal kontrol ve öğrenci hata bildirimleri de ayrıca işler; öğretmen onayıyla hatalı soru anında kaldırılır."],
  ["Öğrencilerin kişisel verileri güvende mi?", "Her dershanenin verisi veritabanı seviyesinde birbirinden ayrıdır. Yapay zekâ sağlayıcısına hiçbir kişisel veri gönderilmez. Öğrenciler birbirini yalnızca takma adla görür; özel mesaj yoktur. 18 yaş altı için veli onayı alınır."],
  ["Öğretmenlerimize ek iş çıkar mı?", "Hayır. Sorular hazır gelir; öğretmen tek tıkla sınıfın en zayıf üç konusuna uyarlamalı ödev verebilir. Isı haritası hangi öğrencinin hangi kazanımda zorlandığını gösterir."],
  ["LGS ve YKS ayrı mı?", "Evet. Dershane LGS, YKS ya da ikisini birden alır; öğrenci yalnızca kendi paketinin derslerini ve kazanımlarını görür. YKS'de TYT, AYT (SAY/EA/SÖZ/DİL) ve YDT kapsanır."],
  ["Pilot nasıl işliyor?", "30 gün ücretsiz: tek şube, en fazla 50 öğrenci. Süre sonunda kullanım ve gelişim raporu verilir; devam etmezseniz hesap salt okunur olur, hiçbir şey otomatik ücretlendirilmez."],
  ["Hangi cihazlarda çalışıyor?", "iOS, Android ve web. Öğretmen ve yönetici panelleri tarayıcıdan çalışır."],
];

export default function Tanitim() {
  return (
    <>
      <header className="ust">
        <div className="kap">
          <a href="#" className="logo"><i>K</i>KMY Arena</a>
          <nav aria-label="Bölümler"><a href="#ozellikler">Özellikler</a><a href="#ogretmen">Öğretmen ve yönetici</a><a href="#kvkk">Güvenlik</a><a href="#sss">SSS</a></nav>
          <a href="#pilot" className="dugme ana kucuk">30 gün ücretsiz dene</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="kap">
            <div>
              <span className="etiket"><b>●</b> LGS ve YKS dershaneleri için</span>
              <h1>Öğrencileriniz her gün soru çözsün. <em>Siz farkı ölçün.</em></h1>
              <p className="alt">Yapay zekânın her öğrenciye seviyesine göre ürettiği özgün sorular; düellolar, klan savaşları ve karakter gelişimiyle soru çözmeyi bir alışkanlığa dönüştürün. Öğretmen ve yöneticiye ölçülebilir, kazanım bazlı rapor.</p>
              <div className="eylem">
                <a href="#pilot" className="dugme ana">30 gün ücretsiz pilot →</a>
                <a href="#nasil" className="dugme cizgi">Nasıl çalışır?</a>
              </div>
              <div className="guven"><span>Kurulum yok</span><span>KVKK uyumlu altyapı</span><span>iOS · Android · Web</span></div>
            </div>
            <div style={{ position: "relative", justifySelf: "center" }}>
              <div className="telefon" aria-hidden>
                <div className="ekran">
                  <div className="ust-cubuk"><div className="ilerleme"><i /></div><span className="seri"><Flame size={13} style={{ verticalAlign: -2 }} /> 4</span></div>
                  <div className="soru-kart"><small style={{ color: "#a78bfa" }}>Matematik · M.8.1.3.2</small><div style={{ marginTop: 6 }}>Alanı 72 cm² olan bir karenin bir kenarı hangi iki ardışık tam sayı arasındadır?</div></div>
                  <div className="sik"><b>A</b>6 ile 7</div>
                  <div className="sik"><b>B</b>7 ile 8</div>
                  <div className="sik dogru"><b>✓</b>8 ile 9</div>
                  <div className="sik"><b>D</b>9 ile 10</div>
                  <div className="xp">+18 XP</div>
                </div>
              </div>
              <div className="yuzen a"><Swords size={16} color="#ff6a3d" style={{ verticalAlign: -3 }} /> Düello: 3 – 1 kazandın!</div>
              <div className="yuzen b"><Trophy size={16} color="#ffc53d" style={{ verticalAlign: -3 }} /> Altın lig · 2. sıra</div>
              <div className="yuzen c"><Shield size={16} color="#2ee08a" style={{ verticalAlign: -3 }} /> Klan boss'u yenildi</div>
            </div>
          </div>
        </section>

        <section className="blok" style={{ paddingTop: 30 }}>
          <div className="kap sayilar gorunur">
            <div className="sayi"><strong>1,5 sn</strong><span>Soruya erişim süresi</span></div>
            <div className="sayi"><strong>539</strong><span>MEB/ÖSYM kazanımı</span></div>
            <div className="sayi"><strong>2 model</strong><span>Her soru bağımsız doğrulanır</span></div>
            <div className="sayi"><strong>0</strong><span>Tekrar eden soru</span></div>
          </div>
        </section>

        <section className="blok" id="nasil">
          <div className="kap">
            <div className="baslik-blok gorunur"><span className="ust-etiket">Sorun</span><h2>Öğrenci soru çözmüyor, siz kimin nerede takıldığını göremiyorsunuz</h2><p>Kâğıt test kitapları yorucu, dijital soru bankaları sıkıcı. KMY Arena soru çözmeyi her gün geri dönülen bir oyuna, sonucunu da kazanım bazlı veriye çevirir.</p></div>
            <div className="izgara adimlar">
              <div className="kart gorunur"><h3>Öğrenci girer, seviyesi ölçülür</h3><p>Kısa bir tespit sınavı her kazanımda başlangıç seviyesini belirler.</p></div>
              <div className="kart gorunur"><h3>Her gün kendi seviyesinde soru</h3><p>Zorluk anlık ayarlanır: ne sıkacak kadar kolay ne bıraktıracak kadar zor.</p></div>
              <div className="kart gorunur"><h3>Öğretmen tek ekranda görür</h3><p>Isı haritası, dikkat listesi ve en sık yapılan yanlışlar; tek tıkla telafi ödevi.</p></div>
            </div>
          </div>
        </section>

        <section className="blok" id="ozellikler">
          <div className="kap">
            <div className="baslik-blok gorunur"><span className="ust-etiket">Öğrenci tarafı</span><h2>Bırakamayacakları bir arena</h2></div>
            <div className="izgara">
              {OZELLIKLER.map((o) => (
                <div key={o.baslik} className="kart gorunur">
                  <div className="ikon" style={{ background: `${o.renk}26`, color: o.renk }}><o.ikon size={26} strokeWidth={2.4} /></div>
                  <h3>{o.baslik}</h3><p>{o.metin}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="blok" id="ogretmen">
          <div className="kap iki">
            <div className="kart gorunur">
              <span className="ust-etiket">Öğretmen paneli</span><h2 style={{ fontSize: 28 }}>Sınıfınızın röntgeni</h2>
              <ul className="liste-k">
                <li>Öğrenci × kazanım ısı haritası</li><li>En çok yanlış yapılan kazanımlar ve seçilen yanlış şıklar</li>
                <li>Uyarlamalı ödev; tek tıkla zayıf konulara telafi</li><li>Öğrenci 360°: çalışma süresi, gelişim, ödev, risk sinyalleri</li>
                <li>Topluluk ve şikâyet yönetimi tek kutuda</li>
              </ul>
            </div>
            <div className="kart gorunur">
              <span className="ust-etiket">Yönetici paneli</span><h2 style={{ fontSize: 28 }}>Dershanenizin nabzı</h2>
              <ul className="liste-k">
                <li>Günlük ve haftalık aktiflik, şube karşılaştırması</li><li>Erken uyarı: bırakma riski olan öğrenciler, rehberlik takibi</li>
                <li>Öğretmen kullanım raporları</li><li>Veliye otomatik haftalık özet</li><li>Kendi logonuz ve renklerinizle</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="blok" id="kvkk">
          <div className="kap">
            <div className="kart kvkk gorunur" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24, alignItems: "center" }}>
              <div className="ikon" style={{ width: 72, height: 72, fontSize: 34, background: "#2ee08a26", color: "#2ee08a" }}><Lock size={34} /></div>
              <div>
                <h2 style={{ fontSize: 28 }}>Çocukların verisi için tasarlandı</h2>
                <ul className="liste-k" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <li>Her dershane veritabanı seviyesinde izole</li><li>Yapay zekâya kişisel veri gitmez</li>
                  <li>Öğrenciler yalnızca takma adla görünür, özel mesaj yok</li><li>18 yaş altı için veli onayı, uygulama içinden hesap silme</li>
                  <li>Küfür, kişisel bilgi ve zorbalık filtresi, şikâyet sistemi</li><li>Destek gerektiren ifadelerde rehber öğretmene uyarı</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="blok" id="sss">
          <div className="kap" style={{ maxWidth: 860 }}>
            <div className="baslik-blok gorunur"><span className="ust-etiket">Sık sorulanlar</span><h2>Merak edilenler</h2></div>
            {SSS.map(([s, c]) => <details key={s} className="gorunur"><summary>{s}</summary><p>{c}</p></details>)}
            <details className="gorunur"><summary>Fiyat ne kadar?</summary><p>Öğrenci başı aylık lisans; şube paketi ve yıllık ödemede indirim. Dershanenizin büyüklüğüne göre teklif hazırlıyoruz — formdan “Teklif / demo” seçin.</p></details>
          </div>
        </section>

        <section className="blok" id="pilot">
          <div className="kap">
            <div className="form-kutu gorunur">
              <div>
                <span className="ust-etiket">30 gün ücretsiz</span>
                <h2 style={{ fontSize: 36 }}>Bir şubede deneyin, farkı rakamla görün</h2>
                <ul className="liste-k">
                  <li>Tek şube, en fazla 50 öğrenci</li><li>Kurulum ve eğitim bizden</li><li>30. günde kullanım ve gelişim raporu</li><li>Kredi kartı yok, otomatik ücret yok</li>
                </ul>
              </div>
              <TeklifFormu />
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="kap"><span>© {new Date().getFullYear()} KMY Arena · KMYAI altyapısıyla</span><span><a href="#kvkk">KVKK</a> · <a href="#sss">SSS</a> · <a href="#pilot">İletişim</a></span></div>
      </footer>
    </>
  );
}
