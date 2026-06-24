# GirelimMi? ⚡

Arkadaşlar arası **tahmin / iddia (lades) platformu**. _"Bir tıkla, birlikte gir."_

Bir kullanıcı bir soru ("GirelimMi?") açar, seçenekleri ve zamanları belirler, token yatırır; diğerleri bahis koyar. Bahis penceresi kapanınca kilitlenir, sonuç girilince havuz **parimutuel** mantıkla (%5 komisyonla) dağıtılır.

## Teknoloji
- **Ön yüz:** statik HTML + CSS + saf JS (çerçeve yok), Poppins fontu.
- **Backend:** Firebase **Authentication** + **Cloud Firestore** (tamamen ücretsiz Spark planı; Cloud Functions yok).
- **Güvenlik:** tüm bütünlük `firestore.rules` ile zorlanır — kullanıcı kendi bakiyesini artıramaz, bahis penceresi `request.time` ile kilitlenir, bahis tutarı `getAfter()` ile bakiyeden düşülmüş olmak zorundadır.

## Özellikler
- E-posta/şifre ile giriş, davet kodu ile kayıt, hediye başlangıç bakiyesi, şifre sıfırlama.
- Çok seçenekli GirelimMi? (2–5 seçenek, isimleri kurucu yazar).
- Üç zaman: **Başlangıç → Kapanış (kilit) → Bitiş (sonuç)**, durum zamandan türetilir.
- Kategoriler: Spor, Ekonomi, Siyaset, Eğlence, Diğer.
- Liderlik, canlı akış, genel + market sohbeti, bildirimler.
- Yönetici paneli: sonuçlandırma, davet kodu, kullanıcı yönetimi, token yükleme, denetim kaydı.
- Token satışı (IBAN + fiyat listesi; token yükleme yöneticide).

## Kurulum
Firebase'i bağlamak için adım adım rehber: **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)**.

Yerel önizleme:
```bash
python -m http.server 5173
# http://localhost:5173
```

## Yapı
```
index/login/kayit_ol/dashboard/profil.html   # sayfalar
assets/css/style.css                          # tasarım sistemi (turuncu/krem/antrasit)
assets/img/                                    # logo + favicon
src/js/  config, util, firebase-init, auth,
         app, markets, bets, chat,
         notifications, admin, profile
firestore.rules / firestore.indexes.json       # güvenlik & indexler
```

> **Not:** Gerçek para ile token satışı yapılıyor; hukuki sorumluluk işletene aittir. Token→para geri çekme yoktur.
