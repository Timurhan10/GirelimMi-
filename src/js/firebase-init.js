// ======================================================
// GirelimMi? — FIREBASE BAŞLATMA
// ------------------------------------------------------
// 1) Firebase Console > Proje Ayarları > "Web uygulaması" ekle
// 2) Sana verilen firebaseConfig nesnesini AŞAĞIYA yapıştır
// 3) Authentication > Sign-in method > E-posta/Şifre'yi etkinleştir
// 4) Firestore Database oluştur (production modunda) ve firestore.rules'u yayınla
// Ayrıntılar: FIREBASE_SETUP.md
// ======================================================
const firebaseConfig = {
    apiKey: "YAPISTIR",
    authDomain: "YAPISTIR.firebaseapp.com",
    projectId: "YAPISTIR",
    storageBucket: "YAPISTIR.appspot.com",
    messagingSenderId: "YAPISTIR",
    appId: "YAPISTIR",
};

let auth = null, db = null, FB_READY = false;
try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YAPISTIR") {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        FB_READY = true;
    } else {
        console.warn("⚠️ Firebase yapılandırması eksik. src/js/firebase-init.js dosyasına config yapıştırın.");
    }
} catch (e) {
    console.error("Firebase başlatma hatası:", e);
}

// Firestore alan yolu kısayolları
const FieldValue = (typeof firebase !== "undefined" && firebase.firestore) ? firebase.firestore.FieldValue : null;
const Timestamp = (typeof firebase !== "undefined" && firebase.firestore) ? firebase.firestore.Timestamp : null;

function fbReadyGuard() {
    if (!FB_READY) {
        toast("Firebase yapılandırması eksik. FIREBASE_SETUP.md adımlarını tamamlayın.", "err");
        return false;
    }
    return true;
}
