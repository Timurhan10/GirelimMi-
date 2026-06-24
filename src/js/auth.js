// ======================================================
// GirelimMi? — KİMLİK DOĞRULAMA (Firebase Auth + Firestore)
// ======================================================

function setMsg(text, kind = "error") {
    const el = document.getElementById("msg");
    if (el) { el.textContent = text || ""; el.className = "form-msg " + (kind || ""); }
}

function authErrorText(e) {
    const c = e && e.code ? e.code : "";
    const map = {
        "auth/invalid-email": "Geçersiz e-posta adresi.",
        "auth/user-not-found": "Hatalı e-posta veya şifre.",
        "auth/wrong-password": "Hatalı e-posta veya şifre.",
        "auth/invalid-credential": "Hatalı e-posta veya şifre.",
        "auth/email-already-in-use": "Bu e-posta zaten kayıtlı.",
        "auth/weak-password": "Şifre en az 6 karakter olmalı.",
        "auth/too-many-requests": "Çok fazla deneme. Lütfen biraz bekleyin.",
        "auth/network-request-failed": "Ağ hatası. Bağlantını kontrol et.",
    };
    return map[c] || (e && e.message) || "Bir hata oluştu.";
}

function validateNickname(n) {
    if (!n || n.length < 3 || n.length > 20) return false;
    return /^[a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]+$/.test(n);
}

// ---------------- GİRİŞ ----------------
async function handleLogin() {
    if (!fbReadyGuard()) return;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) { setMsg("Lütfen tüm alanları doldur."); return; }

    const btn = document.getElementById("login-btn");
    btn.disabled = true; setMsg("Giriş yapılıyor...", "");
    try {
        await auth.signInWithEmailAndPassword(email, password);
        location.replace("dashboard.html");
    } catch (e) {
        setMsg(authErrorText(e));
        btn.disabled = false;
    }
}

// ---------------- ŞİFRE SIFIRLAMA ----------------
async function handlePasswordReset() {
    if (!fbReadyGuard()) return;
    const email = document.getElementById("email").value.trim();
    if (!email) { setMsg("Önce e-posta adresini gir, sonra 'Şifremi unuttum'a bas."); return; }
    try {
        await auth.sendPasswordResetEmail(email);
        setMsg("Şifre sıfırlama bağlantısı e-postana gönderildi.", "ok");
    } catch (e) {
        setMsg(authErrorText(e));
    }
}

// ---------------- KAYIT ----------------
async function handleRegister() {
    if (!fbReadyGuard()) return;
    const invite = document.getElementById("reg-invite").value.trim();
    const nickname = document.getElementById("reg-nickname").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const pass = document.getElementById("reg-password").value;
    const pass2 = document.getElementById("reg-password2").value;

    if ((APP_CONFIG.INVITE_REQUIRED && !invite) || !nickname || !email || !pass || !pass2) {
        setMsg("Lütfen tüm alanları doldur."); return;
    }
    if (!validateNickname(nickname)) { setMsg("Kullanıcı adı 3-20 karakter, sadece harf/rakam olmalı."); return; }
    if (pass !== pass2) { setMsg("Şifreler uyuşmuyor."); return; }
    if (pass.length < 6) { setMsg("Şifre en az 6 karakter olmalı."); return; }

    const btn = document.getElementById("register-btn");
    btn.disabled = true; setMsg("Hesap oluşturuluyor...", "");
    const nickKey = nickname.toLowerCase();

    try {
        // 1) Davet kodu kontrolü (tek doküman get; public okunabilir)
        if (APP_CONFIG.INVITE_REQUIRED) {
            const inviteSnap = await db.collection("inviteCodes").doc(invite).get();
            if (!inviteSnap.exists || inviteSnap.data().used) {
                setMsg("Geçersiz veya kullanılmış davet kodu."); btn.disabled = false; return;
            }
        }
        // 2) Nickname benzersizliği (tek doküman get)
        const nickSnap = await db.collection("nicknames").doc(nickKey).get();
        if (nickSnap.exists) { setMsg("Bu kullanıcı adı alınmış, başka birini dene."); btn.disabled = false; return; }

        // 3) Auth kullanıcısı oluştur (artık oturum açık)
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        const u = cred.user;
        try { await u.updateProfile({ displayName: nickname }); } catch (_) {}

        // 4) Profil + davet kodu tüketimi + nickname rezervasyonu (atomik batch)
        const batch = db.batch();
        batch.set(db.collection("users").doc(u.uid), {
            email, nickname,
            balance: APP_CONFIG.WELCOME_BONUS,   // güvenlik kuralları bu değeri üst sınırla doğrular
            isAdmin: false,
            createdAt: FieldValue.serverTimestamp(),
        });
        batch.set(db.collection("nicknames").doc(nickKey), { uid: u.uid });
        if (APP_CONFIG.INVITE_REQUIRED) {
            batch.update(db.collection("inviteCodes").doc(invite), {
                used: true, usedBy: u.uid, usedAt: FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();

        toast(`Hoş geldin, ${nickname}! ${fmtNum(APP_CONFIG.WELCOME_BONUS)} hediye token hesabında.`, "ok");
        location.replace("dashboard.html");
    } catch (e) {
        console.error("Kayıt hatası:", e);
        // Auth kullanıcısı oluşturulduysa ama profil yazımı başarısızsa geri al
        if (auth.currentUser) { try { await auth.currentUser.delete(); } catch (_) {} }
        setMsg(authErrorText(e));
        btn.disabled = false;
    }
}

// ---------------- ÇIKIŞ ----------------
function logout() {
    if (!FB_READY) { location.replace("login.html"); return; }
    auth.signOut().finally(() => location.replace("login.html"));
}

// ---------------- OTURUM KORUMASI (korunan sayfalarda kullanılır) ----------------
// callback(user, profile) çağrılır; profili users/{uid} dokümanından getirir.
function requireAuth(callback) {
    if (!FB_READY) { location.replace("login.html"); return; }
    auth.onAuthStateChanged(async (user) => {
        if (!user) { location.replace("login.html"); return; }
        try {
            const snap = await db.collection("users").doc(user.uid).get();
            const profile = snap.exists ? { uid: user.uid, ...snap.data() } : { uid: user.uid, email: user.email, balance: 0 };
            if (typeof callback === "function") callback(user, profile);
        } catch (e) {
            console.error("Profil yükleme hatası:", e);
            if (typeof callback === "function") callback(user, { uid: user.uid, email: user.email, balance: 0 });
        }
    });
}
