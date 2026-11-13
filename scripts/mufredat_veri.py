# -*- coding: utf-8 -*-
"""
KMY Arena müfredatı — tek kaynak (bu dosya → seed/mufredat/*.json → 01_mufredat.sql).

Kapsam (2026-2027 eğitim yılı, 2027 sınavları):
  • LGS: 8. sınıf öğretim programları (MEB). Maarif Modeli 8. sınıfa henüz gelmedi.
  • YKS: TYT, AYT, YDT konu kapsamı (2027 YKS mevcut programla yapılır;
    Maarif uyumlu soru modeli 2028'de başlar).

Kodlar: Faz 0'dan gelen M.8.*, F.8.*, T.8.*, İTA.8.*, DKAB.8.*, E8.*, TYT.M.*, TYT.T.*
kodları korunur (havuzdaki sorular bunlara bağlı). Yeni kazanımlar PLATFORM kodu
alır: <SINAV>.<DERS>.<ünite>.<sıra> (ör. LGS.FEN.03.02). Resmî MEB kodu değildir;
Merkez Panel > Müfredat (Faz 6) ile resmî kodlar eşlenebilir.
YKS'de "kazanım" = dershanelerin kullandığı konu/alt konu birimidir.
Ön koşul: ünite içinde her kazanım bir öncekine bağlanır.
"""
import json, os

def u(ad, sinif, kazanimlar, kod=None, mevcut=None):
    return {"ad": ad, "sinif": sinif, "k": kazanimlar, "kod": kod, "mevcut": mevcut or []}

LGS = {
 "lgs_turkce": ("Türkçe", "bilgelik", "TR", [
  u("Okuma (Faz 0)", 8, [], kod="T.8.3"),
  u("Sözcükte Anlam", 8, ["Bağlamdan yararlanarak bilinmeyen kelime ve kelime gruplarının anlamını tahmin eder.", "Kelimelerin gerçek, mecaz ve terim anlamlarını ayırt eder.", "Deyim, atasözü ve özdeyişlerin metne katkısını belirler.", "Eş anlamlı, zıt anlamlı ve eş sesli kelimeleri ayırt eder.", "Söz sanatlarını (benzetme, kişileştirme, abartma, karşıtlık, konuşturma) belirler."]),
  u("Cümlede Anlam", 8, ["Cümlede anlam ilişkilerini (neden-sonuç, amaç-sonuç, koşul) belirler.", "Öznel ve nesnel yargıları ayırt eder.", "Örtülü anlamı ve ön kabulü belirler.", "Karşılaştırma, ihtimal, kesinlik, tahmin bildiren ifadeleri ayırt eder.", "Cümle yorumlama ve cümle birleştirme sorularını çözer."]),
  u("Paragraf", 8, ["Paragrafın konusunu ve ana düşüncesini belirler.", "Paragrafta yardımcı düşünceleri belirler.", "Paragrafın yapısını (giriş, gelişme, sonuç) ve cümle sıralamasını belirler.", "Anlatım biçimlerini (açıklama, tartışma, betimleme, öyküleme) belirler.", "Düşünceyi geliştirme yollarını (tanımlama, örnekleme, karşılaştırma, tanık gösterme, sayısal veri) belirler.", "Paragrafta akışı bozan cümleyi bulur."]),
  u("Görsel Okuma ve Sözel Mantık", 8, ["Grafik, tablo ve görsellerden çıkarım yapar.", "Sözel mantık ve muhakeme sorularını çözer."]),
  u("Fiilimsiler", 8, ["İsim-fiil, sıfat-fiil ve zarf-fiilleri belirler ve cümleye kattığı anlamı açıklar."]),
  u("Cümlenin Ögeleri", 8, ["Yüklem ve özneyi belirler.", "Nesne, yer tamlayıcısı ve zarf tamlayıcısını belirler.", "Ara söz ve cümle dışı unsurları belirler."]),
  u("Fiilde Çatı", 8, ["Fiillerin etken-edilgen çatısını belirler.", "Fiillerin geçişli-geçişsiz çatısını belirler."]),
  u("Cümle Türleri", 8, ["Yüklemine, anlamına ve yapısına göre cümle türlerini ayırt eder."]),
  u("Yazım ve Noktalama", 8, ["Yazım kurallarını uygular.", "Noktalama işaretlerini doğru kullanır."]),
  u("Metin Türleri ve Anlatım Bozuklukları", 8, ["Metin türlerini (hikâye, masal, fabl, biyografi, deneme, makale, gezi yazısı) ayırt eder.", "Anlatım bozukluklarını belirler ve düzeltir."]),
 ]),
 "lgs_matematik": ("Matematik", "zeka", "MAT", [
  u("Çarpanlar ve Katlar", 8, [], kod="M.8.1.1"),
  u("Üslü İfadeler", 8, ["Verilen bir sayıyı 10'un farklı tam sayı kuvvetlerini kullanarak ifade eder.", "Çok büyük ve çok küçük sayıları bilimsel gösterimle ifade eder ve karşılaştırır."], kod="M.8.1.2"),
  u("Kareköklü İfadeler", 8, ["Kareköklü bir ifadeyi a√b şeklinde yazar ve katsayıyı kök içine alır.", "Kareköklü ifadelerde çarpma ve bölme işlemlerini yapar.", "Kareköklü ifadelerde toplama ve çıkarma işlemlerini yapar.", "Kareköklü bir ifade ile çarpıldığında sonucu doğal sayı yapan çarpanlara örnek verir.", "Ondalık ifadelerin kareköklerini belirler.", "Gerçek sayıları tanır; rasyonel ve irrasyonel sayılarla ilgili çıkarımlar yapar."], kod="M.8.1.3"),
  u("Veri Analizi", 8, ["En fazla üç veri grubuna ait çizgi ve sütun grafiklerini yorumlar.", "Verileri sütun, daire veya çizgi grafiği ile gösterir ve bu gösterimler arasında dönüşüm yapar."]),
  u("Basit Olayların Olma Olasılığı", 8, ["Bir olaya ait olası durumları belirler.", "Daha fazla, eşit, daha az olasılıklı olayları ayırt eder.", "Eşit şansa sahip olaylarda her bir çıktının olasılık değerini belirler.", "Basit olayların olma olasılığını hesaplar."]),
  u("Cebirsel İfadeler ve Özdeşlikler", 8, ["Basit cebirsel ifadeleri anlar ve farklı biçimlerde yazar.", "Cebirsel ifadelerin çarpımını yapar.", "Özdeşlikleri modellerle açıklar.", "Cebirsel ifadeleri çarpanlara ayırır."]),
  u("Doğrusal Denklemler", 8, ["Birinci dereceden bir bilinmeyenli denklemleri çözer.", "Koordinat sistemini özellikleriyle tanır ve sıralı ikilileri gösterir.", "Aralarında doğrusal ilişki bulunan iki değişkenden birinin diğerine bağlı olarak nasıl değiştiğini tablo ve denklemle ifade eder.", "Doğrusal denklemlerin grafiğini çizer.", "Doğrusal ilişki içeren gerçek hayat durumlarına ait denklem, tablo ve grafiği oluşturur ve yorumlar.", "Doğrunun eğimini modellerle açıklar, doğrusal denklemleri ve grafiklerini eğimle ilişkilendirir."]),
  u("Eşitsizlikler", 8, ["Birinci dereceden bir bilinmeyenli eşitsizlik içeren gerçek hayat durumlarına uygun matematik cümleleri yazar.", "Birinci dereceden bir bilinmeyenli eşitsizlikleri sayı doğrusunda gösterir.", "Birinci dereceden bir bilinmeyenli eşitsizlikleri çözer."]),
  u("Üçgenler", 8, ["Üçgende kenarortay, açıortay ve yüksekliği inşa eder.", "Üçgenin iki kenar uzunluğunun toplamı veya farkı ile üçüncü kenarının uzunluğunu ilişkilendirir.", "Üçgenin kenar uzunlukları ile bu kenarların karşısındaki açıların ölçülerini ilişkilendirir.", "Yeterli sayıda elemanının ölçüleri verilen bir üçgeni çizer.", "Pisagor bağıntısını oluşturur ve ilgili problemleri çözer."]),
  u("Eşlik ve Benzerlik", 8, ["Eşlik ve benzerliği ilişkilendirir, eş ve benzer şekillerin kenar ve açı özelliklerini belirler.", "Benzer çokgenlerin benzerlik oranını belirler, bir çokgene eş ve benzer çokgenler oluşturur."]),
  u("Dönüşüm Geometrisi", 8, ["Nokta, doğru parçası ve diğer düzlemsel şekillerin öteleme sonucundaki görüntülerini çizer.", "Nokta, doğru parçası ve diğer düzlemsel şekillerin yansıma sonucundaki görüntülerini oluşturur.", "Çokgenlerin öteleme ve yansımalar sonucunda ortaya çıkan görüntüsünü oluşturur."]),
  u("Geometrik Cisimler", 8, ["Dik prizmaları tanır, temel elemanlarını belirler ve açınımını çizer.", "Dik dairesel silindirin temel elemanlarını belirler, açınımını çizer ve yüzey alanını hesaplar.", "Dik dairesel silindirin hacmini hesaplar.", "Dik piramidi tanır, temel elemanlarını belirler ve açınımını çizer.", "Dik koniyi tanır, temel elemanlarını belirler ve açınımını çizer."]),
 ]),
 "lgs_fen": ("Fen Bilimleri", "enerji", "FEN", [
  u("Mevsimler ve İklim", 8, ["Dünya'nın Güneş etrafındaki dolanımı ve eksen eğikliğinin mevsimlere etkisini açıklar.", "İklim biliminin (klimatoloji) ve meteorolojinin uğraş alanlarını açıklar.", "Hava olaylarının oluşumunda rüzgârın ve basınç farkının etkisini açıklar."], kod="F.8.1"),
  u("DNA ve Genetik Kod", 8, ["Nükleotid, gen, DNA ve kromozom kavramlarını açıklar ve aralarında ilişki kurar.", "DNA'nın yapısını ve kendini eşlemesini açıklar.", "Kalıtımla ilgili kavramları (gen, alel, baskın, çekinik, genotip, fenotip, saf döl, melez) tanımlar.", "Tek karakter çaprazlamaları yapar ve sonuçlarını olasılıkla ifade eder.", "Akraba evliliklerinin genetik hastalıklara etkisini tartışır.", "Mutasyon ve modifikasyonu ayırt eder.", "Adaptasyon ve doğal seçilim kavramlarını açıklar.", "Biyoteknolojik uygulamaları ve olası etkilerini tartışır."]),
  u("Basınç", 8, ["Katı basıncını etkileyen değişkenleri deneyle belirler.", "Sıvı basıncını etkileyen değişkenleri deneyle belirler.", "Gaz ve sıvı basıncının günlük hayattaki ve teknolojideki uygulamalarını açıklar."]),
  u("Madde ve Endüstri", 8, ["Periyodik sistemde elementlerin sınıflandırılmasını (metal, ametal, yarı metal, soy gaz) açıklar.", "Fiziksel ve kimyasal değişimleri ayırt eder.", "Kimyasal tepkimeleri ve kütlenin korunumunu açıklar.", "Asitlerin ve bazların genel özelliklerini, pH ölçeğini ve nötrleşmeyi açıklar.", "Maddenin ısı alışverişi, öz ısı, hâl değişimi ve ısınma-soğuma grafiklerini yorumlar.", "Türkiye'de kimya endüstrisinin önemini açıklar."]),
  u("Basit Makineler", 8, ["Basit makinelerin (kaldıraç, makara, palanga, eğik düzlem, çıkrık, dişli, kasnak, vida) işlevini açıklar ve kuvvet kazancını hesaplar.", "Basit makinelerin kuvvet ve yoldan kazanç ilişkisini ve iş prensibini açıklar."]),
  u("Enerji Dönüşümleri ve Çevre Bilimi", 8, ["Besin zinciri, besin ağı ve enerji piramidini açıklar.", "Fotosentez olayını ve etkileyen faktörleri açıklar.", "Solunum (oksijenli ve oksijensiz) olayını açıklar.", "Madde döngülerini (su, karbon, oksijen, azot) açıklar ve çevre sorunlarıyla ilişkilendirir.", "Sürdürülebilir kalkınma ve geri dönüşümün önemini açıklar."]),
  u("Elektrik Yükleri ve Elektrik Enerjisi", 8, ["Cisimlerin elektriklenme yollarını (sürtünme, dokunma, etki) açıklar.", "Elektrik yüklü cisimler arasındaki etkileşimi açıklar.", "Elektroskopla yük türünü ve topraklamayı açıklar.", "Elektrik enerjisinin ısı, ışık ve hareket enerjisine dönüşümünü açıklar.", "Elektrik enerjisinin üretimi, iletimi ve bilinçli tüketimini açıklar."]),
 ]),
 "lgs_inkilap": ("T.C. İnkılap Tarihi ve Atatürkçülük", "strateji", "ITA", [
  u("Bir Kahraman Doğuyor", 8, ["20. yüzyıl başlarında Osmanlı Devleti'nin siyasi ve sosyal durumunu açıklar.", "Mustafa Kemal'in çocukluk ve öğrenim hayatından hareketle onun kişilik özelliklerinin oluşumunu açıklar.", "Mustafa Kemal'in askerlik hayatındaki başarılarını ve Trablusgarp, Balkan savaşlarını açıklar."], kod="İTA.8.1"),
  u("Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar", 8, ["Birinci Dünya Savaşı'nın sebeplerini ve Osmanlı Devleti'nin savaşa girişini açıklar.", "Osmanlı Devleti'nin savaştığı cepheleri ve Çanakkale Savaşları'nın önemini açıklar.", "Mondros Ateşkes Antlaşması ve işgaller karşısında Türk milletinin tepkisini açıklar.", "Cemiyetleri (yararlı ve zararlı) ayırt eder.", "Mustafa Kemal'in Samsun'a çıkışı, genelgeler ve kongreleri açıklar.", "Misak-ı Millî ve Son Osmanlı Mebusan Meclisi'ni açıklar.", "TBMM'nin açılışını ve karşılaştığı ayaklanmaları açıklar.", "Sevr Antlaşması'nı ve millî mücadeleye etkisini açıklar."]),
  u("Millî Bir Destan: Ya İstiklal Ya Ölüm!", 8, ["Doğu ve Güney cephelerindeki mücadeleleri ve sonuçlarını açıklar.", "Düzenli ordunun kurulması, I. ve II. İnönü, Sakarya Meydan Muharebesi'ni açıklar.", "Tekâlif-i Millîye emirlerini ve halkın fedakârlığını açıklar.", "Büyük Taarruz, Mudanya Ateşkes ve Lozan Barış Antlaşması'nı açıklar.", "Millî Mücadele döneminde kültür ve sanattaki gelişmeleri açıklar."]),
  u("Atatürkçülük ve Çağdaşlaşan Türkiye", 8, ["Saltanatın kaldırılması, Cumhuriyetin ilanı ve halifeliğin kaldırılmasını açıklar.", "Hukuk alanındaki inkılapları açıklar.", "Eğitim ve kültür alanındaki inkılapları açıklar.", "Toplumsal alanda yapılan inkılapları açıklar.", "Ekonomi alanındaki gelişmeleri açıklar.", "Atatürk ilkelerini (cumhuriyetçilik, milliyetçilik, halkçılık, devletçilik, laiklik, inkılapçılık) açıklar."]),
  u("Demokratikleşme Çabaları", 8, ["Çok partili hayata geçiş denemelerini (Terakkiperver Cumhuriyet Fırkası, Serbest Cumhuriyet Fırkası) açıklar.", "Cumhuriyete yönelik tehditleri (Şeyh Sait İsyanı, İzmir Suikast Girişimi, Menemen Olayı) açıklar."]),
  u("Atatürk Dönemi Türk Dış Politikası", 8, ["Atatürk dönemi dış politikanın temel ilkelerini açıklar.", "Lozan'dan kalan sorunları (Musul, nüfus mübadelesi, yabancı okullar, Boğazlar) açıklar.", "Montrö Boğazlar Sözleşmesi, Balkan Antantı, Sadabat Paktı ve Hatay'ın anavatana katılmasını açıklar."]),
  u("Atatürk'ün Ölümü ve Sonrası", 8, ["Atatürk'ün ölümü ve manevi mirasını açıklar.", "İkinci Dünya Savaşı'nın Türkiye'ye etkilerini açıklar.", "Çok partili siyasi hayata geçişi açıklar."]),
 ]),
 "lgs_din": ("Din Kültürü ve Ahlak Bilgisi", "strateji", "DIN", [
  u("Kader İnancı", 8, ["Kader, kaza, ecel, rızık, tevekkül kavramlarını açıklar.", "İnsanın iradesi ile kader arasındaki ilişkiyi açıklar.", "Ayetel Kürsi'yi okur, anlamını açıklar."], kod="DKAB.8.1"),
  u("Zekât ve Sadaka", 8, ["İslam'ın paylaşma ve yardımlaşmaya verdiği önemi açıklar.", "Zekât ve sadaka ibadetlerini, kimlere verileceğini açıklar.", "Zekâtın bireysel ve toplumsal faydalarını açıklar."]),
  u("Din ve Hayat", 8, ["Dinin temel gayesini ve insan hayatındaki yerini açıklar.", "Dinin korunmasını emrettiği temel değerleri (can, akıl, nesil, mal, din) açıklar."]),
  u("Hz. Muhammed'in Örnekliği", 8, ["Hz. Muhammed'in doğruluk, güvenilirlik, merhamet ve adalet gibi örnek davranışlarını açıklar."]),
  u("Kur'an-ı Kerim ve Özellikleri", 8, ["Kur'an-ı Kerim'in ana konularını ve temel özelliklerini açıklar.", "Kur'an-ı Kerim'de geçen kıssaları ve verdiği mesajları açıklar."]),
 ]),
 "lgs_ingilizce": ("İngilizce", "ceviklik", "ING", [
  u("Friendship", 8, ["Davet etme, daveti kabul etme ve reddetme, özür dileme ifadelerini anlar.", "Bir arkadaşı tanımlayan kısa metinlerde belirli bilgileri bulur."], kod="E8.1"),
  u("Teen Life", 8, ["Tercihleri ifade etme, beğeni ve beğenmeme bildiren ifadeleri anlar.", "Günlük rutinlerle ilgili kısa metinlerde ana fikri belirler."]),
  u("In the Kitchen", 8, ["Bir sürecin aşamalarını (yemek tarifi) anlatan metinleri anlar ve sıralar."]),
  u("On the Phone", 8, ["Telefon konuşmalarında kullanılan kalıpları anlar.", "Telefon konuşmasında eksik bırakılan ifadeyi tamamlar."]),
  u("The Internet", 8, ["İnternet kullanımıyla ilgili kabul, ret ve öneri ifadelerini anlar."]),
  u("Adventures", 8, ["Karşılaştırma ve tercih bildiren ifadeleri anlar.", "Macera sporlarıyla ilgili metinlerden çıkarım yapar."]),
  u("Tourism", 8, ["Deneyimleri ve yer tanımlarını anlatan metinleri anlar."]),
  u("Chores", 8, ["Görev ve sorumlulukları ifade eden (have to, must) yapıları anlar."]),
  u("Science", 8, ["Bilimsel gelişmeler ve süreçleri anlatan metinlerdeki edilgen yapıları anlar."]),
  u("Natural Forces", 8, ["Doğal afetlerle ilgili tahmin, sebep-sonuç ifadelerini anlar."]),
 ]),
}

TYT = {
 "tyt_turkce": ("Türkçe", "bilgelik", "TR", [
  u("Paragraf", 10, ["Paragrafta konu ve başlık belirler.", "Paragrafta yapı: giriş-gelişme-sonuç cümlelerini, cümle sıralamasını ve akışı bozan cümleyi belirler.", "Anlatım biçimlerini ve düşünceyi geliştirme yollarını belirler."], kod="TYT.T.1"),
  u("Sözcükte ve Cümlede Anlam", 9, ["Sözcükte anlam: gerçek, mecaz, terim, yan anlam; deyim ve atasözü.", "Sözcükler arası anlam ilişkileri ve söz sanatları.", "Cümlede anlam: öznel-nesnel yargı, neden-sonuç, amaç-sonuç, koşul, örtülü anlam.", "Cümle yorumlama, cümle tamamlama ve cümle birleştirme."]),
  u("Ses ve Yazım Bilgisi", 9, ["Ses olaylarını (ünlü düşmesi, ünsüz yumuşaması, benzeşme, türeme vb.) belirler.", "Yazım kurallarını uygular.", "Noktalama işaretlerini doğru kullanır."]),
  u("Sözcük Yapısı ve Sözcük Türleri", 10, ["Kök, gövde, yapım ve çekim eklerini ayırt eder; basit, türemiş ve birleşik sözcükleri belirler.", "İsim, sıfat ve isim/sıfat tamlamalarını belirler.", "Zamir ve zarfları belirler.", "Edat, bağlaç ve ünlemleri belirler.", "Fiilde kip, kişi, yapı ve ek fiili belirler.", "Fiilimsileri (isim-fiil, sıfat-fiil, zarf-fiil) belirler."]),
  u("Cümle Bilgisi", 10, ["Cümlenin ögelerini belirler.", "Fiilde çatıyı belirler.", "Cümle türlerini belirler.", "Anlatım bozukluklarını belirler ve düzeltir."]),
 ]),
 "tyt_matematik": ("Temel Matematik", "zeka", "MAT", [
  u("Temel Kavramlar ve Sayılar", 9, ["Sayı basamakları ve çözümleme ile işlem yapar.", "Asal sayılar, asal çarpanlara ayırma ve faktöriyel ile işlem yapar.", "EBOB-EKOK ile problem çözer.", "Basit eşitsizlikler ve sıralama ile işlem yapar.", "Mutlak değer içeren ifade ve denklemleri çözer.", "Üslü sayılarla işlem yapar.", "Köklü sayılarla işlem yapar.", "Çarpanlara ayırma ve özdeşliklerle ifadeleri sadeleştirir.", "Oran ve orantı ile problem çözer.", "Birinci dereceden denklemleri çözer."], kod="TYT.M.1"),
  u("Problemler", 9, ["Yaş problemlerini çözer.", "İşçi ve havuz problemlerini çözer.", "Karışım problemlerini çözer.", "Hareket problemlerini çözer.", "Grafik ve tablo problemlerini çözer.", "Rutin olmayan (mantıksal akıl yürütme) problemleri çözer."], kod="TYT.M.2"),
  u("Kümeler, Mantık ve Fonksiyonlar", 9, ["Kümelerde işlemleri yapar ve küme problemlerini çözer.", "Kartezyen çarpımı belirler.", "Önermeler, bağlaçlar ve niceleyicilerle mantık işlemleri yapar.", "Fonksiyon kavramı, tanım ve görüntü kümesini belirler.", "Bileşke ve ters fonksiyon işlemlerini yapar.", "Fonksiyon grafiklerini yorumlar."]),
  u("Polinomlar ve İkinci Dereceden Denklemler", 10, ["Polinom kavramı ve polinomlarla işlemleri yapar.", "Polinom bölmesi ve kalan teoremini uygular.", "İkinci dereceden denklemleri çözer, kökler ile katsayılar arasındaki ilişkiyi kullanır."]),
  u("Sayma ve Olasılık", 10, ["Toplama ve çarpma yoluyla sayma yapar.", "Permütasyon ile sayma problemlerini çözer.", "Kombinasyon ile sayma problemlerini çözer.", "Binom açılımını yapar.", "Basit olayların olasılığını hesaplar."]),
  u("Veri ve İstatistik", 9, ["Merkezî eğilim ve yayılım ölçülerini hesaplar.", "Verileri grafiklerle gösterir ve yorumlar."]),
 ]),
 "tyt_geometri": ("Geometri", "zeka", "GEO", [
  u("Doğruda ve Üçgende Açılar", 9, ["Doğruda ve paralel doğrularda açı özelliklerini kullanır.", "Üçgende iç ve dış açı özelliklerini kullanır."]),
  u("Özel Üçgenler", 9, ["Dik üçgen ve Pisagor bağıntısını kullanır.", "Özel dik üçgenler (30-60-90, 45-45-90) ile problem çözer.", "İkizkenar ve eşkenar üçgen özelliklerini kullanır.", "Dik üçgende trigonometrik oranları kullanır."]),
  u("Üçgende Temel Elemanlar", 9, ["Açıortay özelliklerini kullanır.", "Kenarortay özelliklerini ve ağırlık merkezini kullanır.", "Üçgende eşlik ve benzerliği kullanır.", "Üçgende açı-kenar bağıntılarını kullanır.", "Üçgende alan formüllerini kullanır."]),
  u("Çokgenler ve Dörtgenler", 10, ["Çokgenlerin açı ve köşegen özelliklerini kullanır.", "Dörtgenlerin genel özelliklerini kullanır.", "Paralelkenar, eşkenar dörtgen, dikdörtgen ve kare özelliklerini kullanır.", "Yamuk ve deltoid özelliklerini kullanır."]),
  u("Çember ve Daire", 10, ["Çemberde açı ve uzunluk özelliklerini kullanır.", "Dairenin çevresi, alanı ve daire dilimini hesaplar."]),
  u("Analitik Geometri ve Katı Cisimler", 10, ["Noktanın analitiği: iki nokta arası uzaklık ve orta nokta hesaplar.", "Doğrunun analitiği: eğim ve doğru denklemi yazar.", "Prizma ve piramidin alan ve hacmini hesaplar.", "Silindir, koni ve kürenin alan ve hacmini hesaplar."]),
 ]),
 "tyt_fizik": ("Fizik", "enerji", "FIZ", [
  u("Fizik Bilimine Giriş ve Madde", 9, ["Fiziğin alt dalları, temel ve türetilmiş büyüklükleri, skaler ve vektörel büyüklükleri ayırt eder.", "Kütle, hacim, özkütle ilişkisini kullanır.", "Dayanıklılık, adezyon, kohezyon ve kılcallığı açıklar."]),
  u("Hareket ve Kuvvet", 9, ["Konum, yol, yer değiştirme, sürat ve hızı açıklar.", "Düzgün doğrusal hareket ve ivmeli hareket grafiklerini yorumlar.", "Newton'un hareket yasalarını uygular.", "Sürtünme kuvvetini açıklar."]),
  u("İş, Güç ve Enerji", 9, ["İş, güç ve enerji kavramlarını ilişkilendirir.", "Mekanik enerjinin korunumunu ve enerji dönüşümlerini açıklar.", "Verimi hesaplar ve enerji kaynaklarını sınıflandırır."]),
  u("Isı, Sıcaklık ve Genleşme", 9, ["Isı, sıcaklık ve iç enerji kavramlarını ayırt eder.", "Öz ısı, ısı sığası ve hâl değişimini hesaplar.", "Isı aktarım yollarını ve genleşmeyi açıklar."]),
  u("Elektrostatik ve Elektrik", 10, ["Elektriklenme çeşitlerini ve Coulomb kuvvetini açıklar.", "Elektrik akımı, potansiyel fark ve direnci ilişkilendirir (Ohm yasası).", "Seri ve paralel bağlı dirençlerin eşdeğerini hesaplar.", "Elektrik enerjisi ve gücünü hesaplar.", "Mıknatıs ve manyetik alanı açıklar."]),
  u("Basınç ve Kaldırma Kuvveti", 10, ["Katı, sıvı ve gaz basıncını açıklar.", "Kaldırma kuvvetini ve yüzme-batma koşullarını açıklar.", "Bernoulli ilkesini açıklar."]),
  u("Dalgalar ve Optik", 10, ["Dalga çeşitlerini ve temel dalga büyüklüklerini açıklar.", "Yay, su ve ses dalgalarının özelliklerini açıklar.", "Aydınlanma, gölge ve yansıma kurallarını uygular.", "Düzlem ve küresel aynalarda görüntüyü belirler.", "Kırılma, mercekler ve prizmaları açıklar.", "Renk ve renklerin oluşumunu açıklar."]),
 ]),
 "tyt_kimya": ("Kimya", "enerji", "KIM", [
  u("Kimya Bilimi", 9, ["Kimyanın alt disiplinlerini, kimyasal sembolleri ve laboratuvar güvenliğini açıklar."]),
  u("Atom ve Periyodik Sistem", 9, ["Atom modellerinin gelişimini açıklar.", "Atomun yapısını (proton, nötron, elektron, izotop) açıklar.", "Periyodik sistemde elementlerin özelliklerinin değişimini açıklar."]),
  u("Kimyasal Türler Arası Etkileşimler", 9, ["İyonik ve kovalent bağları açıklar.", "Metalik bağı açıklar.", "Zayıf etkileşimleri (hidrojen bağı, van der Waals) açıklar.", "Fiziksel ve kimyasal değişimleri ayırt eder."]),
  u("Maddenin Hâlleri", 9, ["Katı, sıvı, gaz ve plazma hâllerinin özelliklerini açıklar.", "Hâl değişimlerini ve buhar basıncını açıklar."]),
  u("Kimyanın Temel Kanunları ve Hesaplamalar", 10, ["Kütlenin korunumu, sabit ve katlı oranlar kanunlarını uygular.", "Mol kavramını ve mol hesaplamalarını yapar.", "Kimyasal tepkime türlerini ve denkleştirmeyi açıklar.", "Tepkimelerde sınırlayıcı bileşen ve verim hesabı yapar."]),
  u("Karışımlar", 10, ["Homojen ve heterojen karışımları ayırt eder.", "Derişim birimlerini (kütlece yüzde, molarite) hesaplar.", "Karışımların ayrılma yöntemlerini açıklar."]),
  u("Asitler, Bazlar ve Tuzlar", 10, ["Asit ve bazların özelliklerini ve tepkimelerini açıklar.", "Tuzların oluşumunu ve kullanım alanlarını açıklar."]),
  u("Kimya Her Yerde ve Doğa", 10, ["Yaygın günlük hayat kimyasallarını (temizlik maddeleri, polimerler, kozmetik) açıklar.", "Su, hava ve toprak kirliliğini açıklar."]),
 ]),
 "tyt_biyoloji": ("Biyoloji", "enerji", "BIO", [
  u("Yaşam Bilimi Biyoloji", 9, ["Canlıların ortak özelliklerini açıklar.", "Canlıların yapısındaki inorganik bileşikleri açıklar.", "Karbonhidrat, lipit ve proteinleri açıklar.", "Enzimler, vitaminler, nükleik asitler ve ATP'yi açıklar."]),
  u("Hücre", 9, ["Hücre zarı ve organellerin yapı ve görevlerini açıklar.", "Hücre zarından madde geçişlerini açıklar."]),
  u("Canlılar Dünyası", 9, ["Canlıların sınıflandırılmasında kullanılan ölçütleri açıklar.", "Canlı âlemlerinin genel özelliklerini açıklar.", "Virüslerin özelliklerini açıklar."]),
  u("Hücre Bölünmeleri ve Üreme", 10, ["Mitoz bölünmeyi ve eşeysiz üremeyi açıklar.", "Mayoz bölünmeyi ve eşeyli üremeyi açıklar."]),
  u("Kalıtım", 10, ["Mendel ilkelerini ve kalıtım kavramlarını açıklar.", "Çaprazlama problemlerini çözer.", "Eş baskınlık, çok alellilik ve kan gruplarını açıklar.", "Eşeye bağlı kalıtımı ve soy ağaçlarını yorumlar."]),
  u("Ekosistem Ekolojisi", 10, ["Ekosistemin bileşenlerini ve madde-enerji akışını açıklar.", "Madde döngülerini açıklar.", "Güncel çevre sorunlarını ve biyoçeşitliliğin korunmasını açıklar."]),
 ]),
 "tyt_tarih": ("Tarih", "strateji", "TAR", [
  u("Tarih ve Zaman", 9, ["Tarih biliminin yöntemini, kaynaklarını ve zaman hesaplamalarını açıklar."]),
  u("İlk ve Orta Çağlarda Türk Dünyası", 9, ["İlk uygarlıkları ve yazının icadını açıklar.", "İlk Türk devletlerinin siyasi, sosyal ve kültürel özelliklerini açıklar."]),
  u("İslam Medeniyetinin Doğuşu ve İlk Türk-İslam Devletleri", 9, ["İslamiyet'in doğuşunu ve Dört Halife, Emevi, Abbasi dönemlerini açıklar.", "Türklerin İslamiyet'i kabulünü ve ilk Türk-İslam devletlerini açıklar.", "Büyük Selçuklu ve Türkiye Selçuklu devletlerini açıklar."]),
  u("Osmanlı Devleti: Kuruluş ve Yükselme", 10, ["Beylikten devlete Osmanlı'nın kuruluşunu açıklar.", "Dünya gücü Osmanlı'yı (fetihler, kurumlar) açıklar.", "Osmanlı devlet teşkilatı, toplum ve ekonomi yapısını açıklar."]),
  u("Değişen Dünya ve Osmanlı", 10, ["Değişim çağında Avrupa'yı (Rönesans, Reform, coğrafi keşifler) açıklar.", "17. ve 18. yüzyılda Osmanlı'daki değişimi ve ıslahatları açıklar.", "Uluslararası ilişkilerde denge stratejisini (1774-1914) açıklar.", "Devrimler çağında devlet-toplum ilişkilerini açıklar."]),
  u("20. Yüzyıl Başlarında Osmanlı ve Millî Mücadele", 11, ["20. yüzyıl başlarında Osmanlı Devleti ve dünyayı açıklar.", "I. Dünya Savaşı ve Osmanlı cephelerini açıklar.", "Millî Mücadele'nin hazırlık dönemini açıklar.", "Kurtuluş Savaşı'nda cepheleri ve Lozan'ı açıklar."]),
  u("Atatürkçülük ve Türk İnkılabı", 12, ["Türk inkılabını (siyasi, hukuki, eğitim, toplumsal, ekonomik) açıklar.", "Atatürk ilkelerini açıklar.", "Atatürk dönemi dış politikasını açıklar."]),
 ]),
 "tyt_cografya": ("Coğrafya", "strateji", "COG", [
  u("Doğal Sistemler", 9, ["Doğa ve insan etkileşimini açıklar.", "Dünya'nın şekli ve hareketlerinin sonuçlarını açıklar.", "Coğrafi konum (mutlak ve göreceli) kavramlarını açıklar.", "Harita bilgisi: ölçek, izohips, projeksiyonlar.", "Atmosfer ve iklim elemanlarını açıklar.", "İklim tiplerini ve Türkiye'nin iklimini açıklar.", "İç ve dış kuvvetleri ve yer şekillerini açıklar.", "Türkiye'nin yer şekillerini açıklar."]),
  u("Beşerî Sistemler", 10, ["Nüfusun dağılışını ve nüfus piramitlerini yorumlar.", "Göçün nedenlerini ve sonuçlarını açıklar.", "Yerleşme tiplerini açıklar.", "Ekonomik faaliyetleri sınıflandırır."]),
  u("Küresel Ortam ve Çevre", 10, ["Bölge türlerini ve uluslararası ulaşım hatlarını açıklar.", "Doğal afetleri ve korunma yollarını açıklar.", "Çevre sorunlarını açıklar."]),
 ]),
 "tyt_felsefe": ("Felsefe", "strateji", "FEL", [
  u("Felsefeyi Tanıma ve Felsefe Alanları", 10, ["Felsefenin anlamını, bilgi türleri içindeki yerini ve felsefi düşüncenin özelliklerini açıklar.", "Bilgi felsefesinin temel problemlerini açıklar.", "Varlık felsefesinin temel problemlerini açıklar.", "Ahlak felsefesinin temel problemlerini açıklar.", "Sanat felsefesinin temel problemlerini açıklar.", "Din felsefesinin temel problemlerini açıklar.", "Siyaset felsefesinin temel problemlerini açıklar.", "Bilim felsefesinin temel problemlerini açıklar."]),
  u("Felsefe Tarihi", 11, ["MÖ 6. yüzyıl - MS 2. yüzyıl felsefesini açıklar.", "MS 2. yüzyıl - 15. yüzyıl felsefesini açıklar.", "15. - 17. yüzyıl felsefesini açıklar.", "18. - 19. yüzyıl felsefesini açıklar.", "20. yüzyıl felsefesini açıklar."]),
 ]),
 "tyt_din": ("Din Kültürü ve Ahlak Bilgisi", "strateji", "DIN", [
  u("İnanç ve İbadet", 9, ["Bilgi ve inanç ilişkisini açıklar.", "İslam'da ibadet anlayışını ve temel ibadetleri açıklar.", "Allah-insan ilişkisini açıklar."]),
  u("Ahlak, Değerler ve Hz. Muhammed", 10, ["Ahlak ve değerleri açıklar.", "Hz. Muhammed'in hayatını ve gençliğe örnekliğini açıklar.", "Kur'an'a göre Hz. Muhammed'i açıklar."]),
  u("Din, Toplum ve Düşünce", 11, ["İslam düşüncesinde yorumları (itikadi, siyasi, fıkhi) açıklar.", "Anadolu'da İslam ve tasavvufi yorumları açıklar.", "Dünya dinlerini (Yahudilik, Hristiyanlık, Hint ve Çin dinleri) açıklar.", "Güncel dini meseleleri açıklar."]),
 ]),
}

AYT = {
 "ayt_matematik": ("Matematik", "zeka", "MAT", ["SAY", "EA"], [
  u("Fonksiyonlar ve Polinomlar", 11, ["Fonksiyonların özelliklerini ve dönüşümlerini uygular.", "Polinomlarla ileri işlemler ve çarpanlara ayırma yapar.", "İkinci dereceden eşitsizlikleri çözer."]),
  u("İkinci Dereceden Fonksiyonlar", 11, ["Parabolün grafiğini çizer ve yorumlar.", "Parabol ile doğrunun birbirine göre durumlarını inceler."]),
  u("Trigonometri", 11, ["Yönlü açılar ve birim çemberi kullanır.", "Trigonometrik fonksiyonları ve grafiklerini yorumlar.", "Kosinüs ve sinüs teoremlerini uygular.", "Toplam-fark ve iki kat açı formüllerini uygular.", "Trigonometrik denklemleri çözer."]),
  u("Üstel ve Logaritmik Fonksiyonlar", 12, ["Üstel fonksiyonları ve grafiklerini yorumlar.", "Logaritma fonksiyonunu ve özelliklerini kullanır.", "Üstel ve logaritmik denklem ve eşitsizlikleri çözer."]),
  u("Diziler", 12, ["Gerçek sayı dizilerini tanımlar.", "Aritmetik ve geometrik dizilerle problem çözer."]),
  u("Limit ve Süreklilik", 12, ["Limit kavramını ve limit özelliklerini kullanır.", "Belirsizlik durumlarında limit hesaplar.", "Sürekliliği inceler."]),
  u("Türev", 12, ["Türev kavramını ve türev alma kurallarını uygular.", "Türevin geometrik yorumunu (teğet) kullanır.", "Artan-azalan fonksiyonları ve ekstremumları belirler.", "Türev ile optimizasyon problemlerini çözer.", "Fonksiyon grafiklerini türev yardımıyla çizer."]),
  u("İntegral", 12, ["Belirsiz integral ve integral alma yöntemlerini uygular.", "Belirli integrali ve özelliklerini kullanır.", "İntegral ile alan hesaplar."]),
  u("Olasılık", 11, ["Koşullu olasılığı hesaplar.", "Bağımsız ve bağımlı olayların olasılığını hesaplar."]),
 ]),
 "ayt_geometri": ("Geometri", "zeka", "GEO", ["SAY", "EA"], [
  u("Dönüşümler ve Analitik Geometri", 11, ["Doğrunun analitik incelemesini yapar.", "Analitik düzlemde öteleme, yansıma ve dönme dönüşümlerini uygular."]),
  u("Çember ve Daire", 11, ["Çemberde açı, kiriş, teğet özelliklerini kullanır.", "Çemberin analitik incelemesini yapar."]),
  u("Katı Cisimler", 12, ["Uzayda doğru ve düzlemlerin birbirine göre durumlarını belirler.", "Katı cisimlerin alan ve hacim hesaplarını yapar."]),
 ]),
 "ayt_fizik": ("Fizik", "enerji", "FIZ", ["SAY"], [
  u("Kuvvet ve Hareket", 11, ["Vektörleri ve bileşenlerini kullanır.", "Bağıl hareketi açıklar.", "Newton'un hareket yasalarını uygular.", "Bir boyutta sabit ivmeli hareketi inceler.", "İki boyutta hareketi (atışlar) inceler.", "Enerji ve hareket ilişkisini açıklar.", "İtme ve çizgisel momentumu uygular.", "Tork, denge ve kütle merkezini uygular.", "Basit makineleri inceler."]),
  u("Elektrik ve Manyetizma", 11, ["Elektriksel kuvvet ve elektrik alanı açıklar.", "Elektriksel potansiyel ve potansiyel enerjiyi açıklar.", "Düzgün elektrik alan ve sığayı açıklar.", "Manyetizmayı ve elektromanyetik indüksiyonu açıklar.", "Alternatif akım ve transformatörleri açıklar."]),
  u("Çembersel ve Harmonik Hareket", 12, ["Düzgün çembersel hareketi açıklar.", "Dönerek öteleme ve açısal momentumu açıklar.", "Kütle çekim ve Kepler yasalarını açıklar.", "Basit harmonik hareketi açıklar."]),
  u("Dalga Mekaniği", 12, ["Su dalgalarında kırınım ve girişimi açıklar.", "Işığın kırınımı, girişimi ve Doppler olayını açıklar.", "Elektromanyetik dalgaları açıklar."]),
  u("Modern Fizik", 12, ["Atom modellerini ve atom fiziğine girişi açıklar.", "Radyoaktivite ve büyük patlama teorisini açıklar.", "Özel görelilik, fotoelektrik ve Compton olayını açıklar.", "Modern fiziğin teknolojideki uygulamalarını açıklar."]),
 ]),
 "ayt_kimya": ("Kimya", "enerji", "KIM", ["SAY"], [
  u("Modern Atom Teorisi", 11, ["Kuantum sayılarını ve elektron dizilimlerini belirler.", "Periyodik özellikleri açıklar."]),
  u("Gazlar", 11, ["Gaz yasalarını ve ideal gaz denklemini uygular.", "Kinetik teori, gaz karışımları ve gerçek gazları açıklar."]),
  u("Sıvı Çözeltiler ve Çözünürlük", 11, ["Çözünme sürecini ve derişim birimlerini kullanır.", "Koligatif özellikleri açıklar.", "Çözünürlük ve etkileyen faktörleri açıklar."]),
  u("Kimyasal Tepkimelerde Enerji ve Hız", 11, ["Tepkime ısısı ve Hess yasasını uygular.", "Bağ enerjilerini kullanır.", "Tepkime hızını ve etkileyen faktörleri açıklar."]),
  u("Kimyasal Denge", 11, ["Denge sabitini hesaplar ve Le Chatelier ilkesini uygular.", "Asit-baz dengesi ve pH hesaplarını yapar.", "Tampon çözeltiler ve titrasyonu açıklar.", "Çözünürlük dengesini (Kçç) hesaplar."]),
  u("Kimya ve Elektrik", 12, ["Redoks tepkimelerini denkleştirir.", "Elektrot potansiyelleri ve pilleri açıklar.", "Elektroliz ve korozyonu açıklar."]),
  u("Karbon Kimyası", 12, ["Karbon kimyasına girişi ve hibritleşmeyi açıklar.", "Hidrokarbonları adlandırır ve özelliklerini açıklar.", "Fonksiyonel grupları (alkol, eter, karbonil, karboksilik asit, ester) açıklar.", "Enerji kaynakları ve bilimsel gelişmeleri açıklar."]),
 ]),
 "ayt_biyoloji": ("Biyoloji", "enerji", "BIO", ["SAY"], [
  u("İnsan Fizyolojisi", 11, ["Sinir sistemini açıklar.", "Endokrin sistemi açıklar.", "Duyu organlarını açıklar.", "Destek ve hareket sistemini açıklar.", "Sindirim sistemini açıklar.", "Dolaşım ve bağışıklık sistemini açıklar.", "Solunum sistemini açıklar.", "Üriner sistemi açıklar.", "Üreme sistemi ve embriyonik gelişimi açıklar."]),
  u("Komünite ve Popülasyon Ekolojisi", 11, ["Komünite ekolojisini ve süksesyonu açıklar.", "Popülasyon ekolojisini açıklar."]),
  u("Genden Proteine", 12, ["Nükleik asitleri ve DNA eşlenmesini açıklar.", "Genetik şifre ve protein sentezini açıklar.", "Biyoteknoloji ve gen mühendisliğini açıklar."]),
  u("Canlılarda Enerji Dönüşümleri", 12, ["Fotosentezi açıklar.", "Kemosentezi açıklar.", "Hücresel solunumu (oksijenli, oksijensiz, fermantasyon) açıklar."]),
  u("Bitki Biyolojisi ve Canlılar ile Çevre", 12, ["Bitkilerin yapısını, madde taşınmasını ve üremesini açıklar.", "Canlılar ve çevre ilişkisini açıklar."]),
 ]),
 "ayt_edebiyat": ("Türk Dili ve Edebiyatı", "bilgelik", "EDB", ["EA", "SOZ"], [
  u("Edebiyat Bilgisi", 9, ["Anlam bilgisi ve edebi sanatları belirler.", "Şiir bilgisi: nazım birimi, ölçü, uyak ve redif belirler.", "Nazım biçimleri ve türlerini ayırt eder.", "Edebi akımları açıklar.", "Metin türlerini (roman, hikâye, tiyatro, deneme, makale, fıkra, eleştiri) ayırt eder."]),
  u("İslamiyet Öncesi ve Geçiş Dönemi", 9, ["İslamiyet öncesi Türk edebiyatını açıklar.", "Geçiş dönemi eserlerini açıklar."]),
  u("Halk ve Divan Edebiyatı", 10, ["Halk edebiyatını (anonim, âşık, tekke) açıklar.", "Divan edebiyatını, nazım şekillerini ve şairlerini açıklar."]),
  u("Tanzimat'tan Millî Edebiyata", 11, ["Tanzimat edebiyatını açıklar.", "Servet-i Fünun ve Fecr-i Ati edebiyatını açıklar.", "Millî edebiyatı açıklar."]),
  u("Cumhuriyet Dönemi ve Dünya Edebiyatı", 12, ["Cumhuriyet dönemi şiirini açıklar.", "Cumhuriyet dönemi roman ve hikâyesini açıklar.", "Cumhuriyet dönemi tiyatrosunu açıklar.", "Dünya edebiyatının önemli eser ve yazarlarını açıklar."]),
 ]),
 "ayt_tarih": ("Tarih", "strateji", "TAR", ["EA", "SOZ"], [
  u("Osmanlı Tarihi", 10, ["Osmanlı kültür ve medeniyetini açıklar.", "Osmanlı'da yenileşme ve demokratikleşme hareketlerini açıklar."]),
  u("Millî Mücadele ve Atatürk Dönemi", 11, ["Millî Mücadele dönemini ayrıntılı açıklar.", "Atatürk dönemi iç ve dış politikayı açıklar.", "İki savaş arası dönemde dünyayı açıklar."]),
  u("20. Yüzyıl ve Günümüz", 12, ["II. Dünya Savaşı ve Türkiye'yi açıklar.", "Soğuk Savaş dönemini açıklar.", "Yumuşama dönemi ve sonrasını açıklar.", "Küreselleşen dünyayı açıklar."]),
 ]),
 "ayt_cografya": ("Coğrafya", "strateji", "COG", ["EA", "SOZ"], [
  u("Doğal Sistemler ve Ekosistemler", 11, ["Biyoçeşitliliği ve ekosistemlerin işleyişini açıklar.", "Enerji akışı ve madde döngülerini açıklar."]),
  u("Beşerî Sistemler", 11, ["Nüfus politikalarını açıklar.", "Türkiye'de nüfus ve yerleşmeyi açıklar.", "Ekonomik faaliyetler ve doğal kaynakları açıklar.", "Türkiye ekonomisini (tarım, sanayi, enerji, turizm) açıklar."]),
  u("Küresel Ortam: Bölgeler ve Ülkeler", 12, ["Türkiye'nin işlevsel bölgelerini açıklar.", "Küresel ticareti açıklar.", "Kültür bölgeleri ve ülkeleri açıklar.", "Çevre ve toplum ilişkisini açıklar."]),
 ]),
 "ayt_felsefe_grubu": ("Felsefe Grubu", "strateji", "FEG", ["SOZ"], [
  u("Mantık", 11, ["Klasik mantıkta kavram, önerme ve çıkarımı açıklar.", "Sembolik mantıkta önermeler ve doğruluk tablolarını kullanır."]),
  u("Psikoloji", 11, ["Psikolojinin temel süreçlerini (algı, öğrenme, bellek, düşünme) açıklar.", "Ruh sağlığının temellerini açıklar."]),
  u("Sosyoloji", 11, ["Birey ve toplum ilişkisini açıklar.", "Toplumsal yapı, değişme ve kurumları açıklar."]),
 ]),
 "ayt_din": ("Din Kültürü ve Ahlak Bilgisi", "strateji", "DIN", ["SOZ"], [
  u("Dünya ve Ahiret", 12, ["Dünya ve ahiret inancını açıklar.", "Kur'an'a göre hz. Muhammed ve Kur'an'da bazı kavramları açıklar.", "İnançla ilgili meseleleri açıklar."]),
  u("İslam ve Bilim", 12, ["İslam medeniyetinde bilimsel gelişmeleri açıklar.", "Anadolu'da İslam'ı açıklar."]),
 ]),
}

YDT = {
 "ydt_ingilizce": ("İngilizce", "ceviklik", "ING", ["DIL"], [
  u("Kelime ve Dil Bilgisi", 12, ["Bağlama uygun kelime ve deyimi seçer (vocabulary).", "Zamanları (tenses) bağlama uygun kullanır.", "Kipleri (modals) bağlama uygun kullanır.", "Edilgen yapıyı (passive) kullanır.", "Koşul cümlelerini (if clauses) kullanır.", "Sıfat ve isim cümleciklerini (relative, noun clauses) kullanır.", "Fiilimsi yapılarını (gerund, infinitive) kullanır.", "Bağlaç ve geçiş ifadelerini (conjunctions, transitions) kullanır.", "Edat ve öbek fiilleri (prepositions, phrasal verbs) kullanır."]),
  u("Okuma ve Anlama", 12, ["Boşluk doldurma (cloze test) sorularını çözer.", "Cümle tamamlama sorularını çözer.", "Okuma parçasından çıkarım yapar (reading comprehension).", "Paragraf tamamlama ve anlam bütünlüğünü bozan cümleyi bulur.", "Diyalog tamamlama sorularını çözer.", "Verilen cümleye en yakın anlamlı cümleyi bulur (restatement)."]),
  u("Çeviri", 12, ["İngilizceden Türkçeye en uygun çeviriyi seçer.", "Türkçeden İngilizceye en uygun çeviriyi seçer."]),
 ]),
}

kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
eski = {}
for f in ["lgs.json", "tyt.json"]:
    d = json.load(open(os.path.join(kok, "seed", "mufredat", f), encoding="utf-8"))
    for ders in d["dersler"]:
        for un in ders["uniteler"]:
            eski[un["kod"]] = un

def uret(sinav, tablo, on_ek, sinif_varsayilan=None):
    dersler = []
    for dkod, tanim in tablo.items():
        if len(tanim) == 4:
            ad, ozellik, kisa, uniteler = tanim; alanlar = None
        else:
            ad, ozellik, kisa, alanlar, uniteler = tanim
        dj = {"kod": dkod, "ad": ad, "ozellik": ozellik, "uniteler": []}
        if alanlar: dj["alanlar"] = alanlar
        for ui, un in enumerate(uniteler, 1):
            ukod = un["kod"] or f"{on_ek}.{kisa}.{ui:02d}"
            kaz = []
            if un["kod"] and un["kod"] in eski:
                kaz = [dict(k) for k in eski[un["kod"]]["kazanimlar"]]
            onceki = kaz[-1]["kod"] if kaz else None
            for ki, ack in enumerate(un["k"], len(kaz) + 1):
                kkod = f"{on_ek}.{kisa}.{ui:02d}.{ki:02d}"
                kaz.append({"kod": kkod, "aciklama": ack, "on_kosullar": [onceki] if onceki else []})
                onceki = kkod
            ad_ = un["ad"]
            if un["kod"] in eski and ad_.endswith("(Faz 0)"):
                ad_ = eski[un["kod"]]["ad"]
            dj["uniteler"].append({"kod": ukod, "ad": ad_, "sinif_duzeyi": un["sinif"], "kazanimlar": kaz})
        dersler.append(dj)
    return dersler

NOT = ("Kaynak: scripts/mufredat_veri.py (elle düzenleme; o dosyayı düzenleyip yeniden üret). "
       "Faz 0 kodları (M.8.*, F.8.*, T.8.*, İTA.8.*, DKAB.8.*, E8.*, TYT.M.*, TYT.T.*) korunur; "
       "diğerleri platform kodudur, resmî MEB kodu değildir.")
for dosya, sinav, tablo, on_ek in [("lgs.json", "LGS", LGS, "LGS"), ("tyt.json", "TYT", TYT, "TYT"), ("ayt.json", "AYT", AYT, "AYT"), ("ydt.json", "YDT", YDT, "YDT")]:
    veri = {"_not": NOT, "sinav_turu": sinav, "dersler": uret(sinav, tablo, on_ek)}
    with open(os.path.join(kok, "seed", "mufredat", dosya), "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)
    n = sum(len(u_["kazanimlar"]) for d_ in veri["dersler"] for u_ in d_["uniteler"])
    print(dosya, len(veri["dersler"]), "ders", n, "kazanım")
