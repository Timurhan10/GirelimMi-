# Firebase Kurulumu — GirelimMi?

Bu proje **tamamen ücretsiz** Firebase (Spark) planıyla çalışır. Cloud Functions kullanılmaz; tüm güvenlik `firestore.rules` ile sağlanır. Aşağıdaki adımları sırayla yap.

## 1. Proje oluştur
1. https://console.firebase.google.com → **Proje ekle**.
2. Proje adı: `girelimmi` (veya istediğin). Google Analytics kapatabilirsin.

## 2. Web uygulaması ekle ve config'i bağla
1. Proje genel bakış → **</>** (Web) simgesine bas, bir uygulama kaydet.
2. Sana verilen `firebaseConfig` nesnesini kopyala.
3. `src/js/firebase-init.js` içindeki `firebaseConfig` bloğunu bununla **değiştir**.

## 3. Authentication
1. Sol menü → **Authentication** → **Başla**.
2. **Sign-in method** → **E-posta/Şifre**'yi **etkinleştir** → Kaydet.
3. (İsteğe bağlı) Şifre sıfırlama e-postaları otomatik çalışır.

## 4. Firestore Database
1. Sol menü → **Firestore Database** → **Veritabanı oluştur**.
2. Konum seç (örn. `eur3`), **production modunda** başlat.
3. **Rules** sekmesine `firestore.rules` içeriğini yapıştır → **Yayınla**.
   - Alternatif (CLI): `npm i -g firebase-tools` → `firebase login` → `.firebaserc` içindeki proje id'sini yaz → `firebase deploy --only firestore:rules,firestore:indexes`.

## 5. İlk yöneticiyi (admin) ayarla
1. `kayit_ol.html` üzerinden bir hesap aç (önce bir davet kodu lazım — bkz. adım 6).
2. Firestore → `users` koleksiyonu → kendi dokümanını bul → `isAdmin` alanını **true** yap.
   - Artık admin paneli, sonuçlandırma ve token yükleme yetkilerin açılır.

## 6. İlk davet kodu(ları)nı ekle
Kayıt davet kodu ile yapılır. İlk kodu elle ekle:
1. Firestore → **Koleksiyon başlat** → `inviteCodes`.
2. Doküman ID = kodun kendisi (örn. `GIRELIM2026`).
3. Alanlar: `used` (boolean) = `false`.
4. Sonraki kodları admin panelinden tek tıkla üretebilirsin.

## 7. Ayarlar (isteğe bağlı)
`src/js/config.js` içinde:
- `IBAN` ve `IBAN_NAME` → token satışı için kendi bilgilerin.
- `WELCOME_BONUS` → hediye başlangıç token'ı (kuralı da güncelle: `firestore.rules` içindeki `WELCOME_BONUS()` aynı değer olmalı).
- `COMMISSION_RATE` → komisyon (varsayılan %5).

## 8. Yayınlama (Vercel)
- GitHub reposu (`Timurhan10/GirelimMi-`) Vercel'e bağlanır; `main`'e her push otomatik yayınlanır.
- Güvenlik kuralları Vercel'e değil, Firebase'e `firebase deploy --only firestore` ile gider.

> **Not (gerçek para):** Token satışı IBAN ile yapılıyor. Bunun hukuki sorumluluğu sana aittir; sistemde token→para geri çekme yoktur.
