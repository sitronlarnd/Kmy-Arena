import { Belge, ILETISIM } from "../Belge";

export const metadata = { title: "Gizlilik ve KVKK Aydınlatma Metni — KMY Arena" };

export default function Gizlilik() {
  return (
    <Belge baslik="Gizlilik Politikası ve KVKK Aydınlatma Metni" guncelleme="14 Kasım 2026">
      <h2>1. Kim sorumlu?</h2>
      <p>KMY Arena, dershanelere lisansla sunulan bir eğitim platformudur. Öğrenci, veli ve öğretmen verileri bakımından <b>veri sorumlusu</b> öğrencinin kayıtlı olduğu dershanedir; {ILETISIM.unvan} (“KMY Arena”) dershane adına ve talimatıyla veriyi işleyen <b>veri işleyen</b>dir. Tanıtım sitesindeki teklif formunda paylaşılan bilgiler bakımından veri sorumlusu {ILETISIM.unvan}’dır.</p>

      <h2>2. Hangi verileri işliyoruz?</h2>
      <ul>
        <li><b>Hesap:</b> ad, soyad, e-posta, takma ad, sınıf/şube, sınav grubu (LGS/YKS), kullanıcı rolü.</li>
        <li><b>Öğrenme verisi:</b> çözülen sorular, verilen cevaplar, süreler, kazanım bazında seviye, ödevler, rozet ve oyun ilerlemesi.</li>
        <li><b>Kullanıcı içeriği:</b> topluluk soruları ve cevapları, klan sohbeti, asistan sohbetleri, şikâyetler.</li>
        <li><b>Teknik:</b> oturum bilgisi, cihaz türü, hata kayıtları, (izin verilirse) bildirim jetonu.</li>
      </ul>
      <p>TC kimlik numarası, adres, konum, rehber, mikrofon, reklam kimliği ve okul adı <b>istenmez ve toplanmaz</b>. Uygulamada reklam ve uygulama içi satın alma yoktur.</p>

      <h2>3. Hangi amaçla ve hukuki sebeple?</h2>
      <p>Verileri; eğitim hizmetinin sunulması, öğrencinin seviyesine uygun soru seçilmesi, öğretmen ve dershaneye gelişim raporu verilmesi, güvenliğin ve kötüye kullanımın önlenmesi amaçlarıyla, KVKK m.5/2 (c) sözleşmenin ifası, (ç) hukuki yükümlülük ve (f) meşru menfaat sebeplerine; 18 yaş altı kullanıcılarda sosyal özellikler için veli açık rızasına dayanarak işleriz.</p>

      <h2>4. Yapay zekâ</h2>
      <p>Sorular, ipuçları ve asistan yanıtları yapay zekâ modelleriyle üretilir. Yapay zekâ sağlayıcısına <b>kimliğinizi belirleyen hiçbir bilgi gönderilmez</b>: ad, takma ad ve e-posta giden içerikte bulunursa istek otomatik engellenir; serbest metinlerden e-posta, telefon, kimlik numarası ve bağlantılar silinir.</p>
      <p><b>Fotoğraftan çöz:</b> çektiğiniz fotoğraf yalnızca o anki işlem için kullanılır ve <b>saklanmaz</b>. Yüz, kimlik bilgisi veya uygunsuz içerik görülen fotoğraf işlenmeden reddedilir.</p>

      <h2>5. Kimler görebilir?</h2>
      <ul>
        <li>Diğer öğrenciler yalnızca takma adınızı, karakterinizi ve oyun skorlarınızı görür. Özel mesajlaşma yoktur.</li>
        <li>Öğretmenleriniz ve dershane yöneticileri öğrenme verilerinizi görür; veliniz yalnızca özet bilgileri görür.</li>
        <li>Destek gerektirebilecek bir ifade (ör. kendine zarar) algılanırsa yalnızca dershanenin rehber öğretmenine bildirim gider.</li>
        <li>Her dershanenin verisi veritabanı düzeyinde diğerlerinden ayrıdır.</li>
      </ul>

      <h2>6. Yurt dışına aktarım</h2>
      <p>Veriler, altyapı hizmet sağlayıcılarımızın (Supabase — veritabanı, Vercel — sunucu) Avrupa Birliği’ndeki (Frankfurt) veri merkezlerinde saklanır. Bu aktarım KVKK m.9’a uygun mekanizmalarla yapılır.</p>

      <h2>7. Saklama süresi ve silme</h2>
      <ul>
        <li>Asistan sohbetleri 180 gün, topluluk içerikleri lisans süresince, güvenlik kayıtları 2 yıl saklanır.</li>
        <li>Hesabınızı uygulamada <b>Profil → Hesabımı sil</b> ile silebilirsiniz. Hesap hemen kapanır, 30 gün sonra kişisel verileriniz kalıcı olarak silinir. Ayrıntı: <a href="/hesap-silme">Hesap silme</a>.</li>
        <li>Dershanenin lisansı sona erdiğinde veriler dershanenin talimatına göre silinir veya anonimleştirilir.</li>
      </ul>

      <h2>8. Haklarınız</h2>
      <p>KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silme, itiraz etme ve zararın giderilmesini isteme haklarına sahipsiniz. Başvurularınızı önce dershanenize, ayrıca <a href={`mailto:${ILETISIM.eposta}`}>{ILETISIM.eposta}</a> adresine iletebilirsiniz; en geç 30 gün içinde yanıtlanır.</p>

      <h2>9. Çocuklar</h2>
      <p>KMY Arena ortaokul ve lise öğrencilerine yöneliktir. 18 yaş altı öğrencilerde topluluk ve klan sohbeti gibi sosyal özellikler veli onayı alınana kadar kapalıdır. Küfür, kişisel bilgi ve zorbalık filtresi, şikâyet ve gizleme sistemi tüm kullanıcılar için açıktır.</p>
    </Belge>
  );
}
