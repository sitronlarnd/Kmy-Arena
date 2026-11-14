import { Belge, ILETISIM } from "../Belge";

export const metadata = { title: "Hesap silme — KMY Arena" };

export default function HesapSilme() {
  return (
    <Belge baslik="KMY Arena hesabınızı silme" guncelleme="14 Kasım 2026">
      <h2>Uygulamadan</h2>
      <ol>
        <li>KMY Arena uygulamasını açın ve giriş yapın.</li>
        <li><b>Profil</b> sekmesine gidin, en alttaki <b>Hesabımı sil</b> düğmesine dokunun.</li>
        <li>Onaylamak için düğmeye tekrar dokunun. Oturumunuz kapanır ve hesabınız devre dışı kalır.</li>
      </ol>
      <h2>Uygulamaya erişemiyorsanız</h2>
      <p>Kayıtlı olduğunuz dershaneye başvurun ya da hesabınıza kayıtlı e-posta adresinden <a href={`mailto:${ILETISIM.eposta}?subject=Hesap%20silme`}>{ILETISIM.eposta}</a> adresine “Hesap silme” konulu e-posta gönderin.</p>
      <h2>Ne silinir, ne kalır?</h2>
      <ul>
        <li><b>30 gün sonra kalıcı olarak silinir:</b> ad, soyad, e-posta, takma ad, cevap geçmişi, beceri seviyeleri, oyun ilerlemesi, rozetler, asistan sohbetleri, topluluk ve klan sohbeti içerikleri.</li>
        <li><b>Kalır:</b> kimseyle ilişkilendirilemeyen toplu istatistikler (ör. bir sorunun kaç kez doğru çözüldüğü) ve yasal yükümlülük gereği en fazla 2 yıl saklanan güvenlik kayıtları.</li>
        <li>30 gün içinde dershanenize başvurarak silme talebini geri alabilirsiniz.</li>
      </ul>
    </Belge>
  );
}
