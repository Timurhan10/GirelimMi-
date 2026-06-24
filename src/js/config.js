// ======================================================
// GirelimMi? — UYGULAMA AYARLARI
// Bu değerleri buradan değiştirebilirsin.
// ======================================================
const APP_CONFIG = {
    BRAND: "GirelimMi?",
    SLOGAN: "Bir tıkla, birlikte gir.",

    // Ekonomi
    COMMISSION_RATE: 0.05,     // %5 komisyon (sistem havuzu)
    MIN_BET: 0,                // alt limit yok (0 = bakiye yettiği sürece serbest)
    MAX_BET: 0,                // üst limit yok (0 = limitsiz)

    // Kayıt
    INVITE_REQUIRED: true,     // davet kodu zorunlu
    WELCOME_BONUS: 100,        // her yeni kullanıcıya hediye başlangıç bakiyesi (token)

    // Kategoriler & bahis seçenekleri
    CATEGORIES: ["Spor", "Ekonomi", "Siyaset", "Eğlence", "Diğer"],
    MAX_OPTIONS: 5,            // çok seçenekli bahiste en fazla seçenek
    MIN_OPTIONS: 2,

    // Token satın alma (gerçek para) — IBAN ve fiyat listesi
    TOKEN_TIERS: [
        { tl: 100,  token: 1000 },
        { tl: 200,  token: 2000 },
        { tl: 500,  token: 6500 },
        { tl: 1000, token: 15000 },
    ],
    IBAN: "TR00 0000 0000 0000 0000 0000 00",   // TODO: gerçek IBAN
    IBAN_NAME: "Ad Soyad",                        // TODO: hesap sahibi

    // İlk yöneticinin e-postası (Firebase Console'dan admins koleksiyonuna da eklenir)
    ROOT_ADMIN_EMAIL: "",
};
