import { Belge, ILETISIM } from "../Belge";

export const metadata = { title: "Kullanım Koşulları — KMY Arena" };

export default function Kosullar() {
  return (
    <Belge baslik="Kullanım Koşulları" guncelleme="14 Kasım 2026">
      <h2>1. Hizmet</h2>
      <p>KMY Arena, {ILETISIM.unvan} tarafından dershanelere lisansla sunulan, yapay zekâ destekli ve oyunlaştırılmış bir soru çözme platformudur. Uygulamaya yalnızca dershanenin verdiği davet koduyla kayıt olunur. Ticari koşullar dershane ile yapılan lisans sözleşmesinde düzenlenir.</p>
      <h2>2. Hesap</h2>
      <p>Hesap bilgilerinizi gizli tutmak ve hesabınızla yapılan işlemlerden sorumlu olmak size aittir. Hesabınızı başkasıyla paylaşmayın.</p>
      <h2>3. Davranış kuralları</h2>
      <ul>
        <li>Küfür, hakaret, zorbalık, ayrımcılık ve uygunsuz içerik paylaşmak yasaktır.</li>
        <li>Kendinizin veya başkasının kişisel bilgilerini (telefon, adres, sosyal medya hesabı) paylaşmayın.</li>
        <li>Başka bir öğrencinin yerine soru çözmek, hile yazılımı kullanmak veya sistemi kötüye kullanmak yasaktır.</li>
        <li>Kurallara aykırı içerik kaldırılabilir; dershane bilgilendirilir ve hesap kısıtlanabilir.</li>
      </ul>
      <h2>4. Yapay zekâ içeriği</h2>
      <p>Sorular yapay zekâ ile üretilir ve ikinci bir modelle bağımsız olarak doğrulanır; yine de hata içerebilir. Hatalı olduğunu düşündüğünüz soruyu uygulamadaki <b>Hata bildir</b> düğmesiyle bildirin; öğretmen onayıyla kaldırılır. Asistan ve fotoğraftan çöz yanıtları öğretmeninizin yerini tutmaz.</p>
      <h2>5. Sanal ödüller</h2>
      <p>XP, Altın, Kupa, rozet ve kozmetik eşyalar yalnızca uygulama içinde geçerlidir; gerçek parayla alınıp satılamaz, paraya çevrilemez ve hesap silindiğinde sona erer.</p>
      <h2>6. Fikri haklar</h2>
      <p>Uygulama, tasarımı, karakterleri ve üretilen soru havuzu {ILETISIM.unvan}’a aittir. Kullanıcı içerikleri, hizmetin sunulması için gerektiği ölçüde kullanılır.</p>
      <h2>7. Değişiklikler ve iletişim</h2>
      <p>Bu koşullar güncellenebilir; önemli değişiklikler uygulama içinde duyurulur. Sorularınız için: <a href={`mailto:${ILETISIM.eposta}`}>{ILETISIM.eposta}</a>.</p>
    </Belge>
  );
}
