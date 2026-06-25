// ======================================================
// GirelimMi? — APP.JS (başlangıç, durum, görünüm yönetimi)
// ======================================================
const STATE = {
    user: null, profile: null, isAdmin: false,
    markets: {},           // id -> market
    usersById: {},         // uid -> user (liderlik + avatar için)
    view: "aktif",
    filter: "Tümü",
    leaderboard: [],
};

document.addEventListener("DOMContentLoaded", () => {
    requireAuth((user, profile) => {
        STATE.user = user;
        STATE.profile = profile;
        STATE.isAdmin = !!profile.isAdmin;

        renderHeader();
        buildCategoryChips();
        buildCreateForm();
        buildTokenModal();

        listenUserDoc();
        listenMarkets();
        listenUsersIndex();
        startNotifications();
        startChat();
        startLiveFeed();
        if (window.HorseRaceGame) window.HorseRaceGame.attach();   // At yarışı oyununu token sistemine bağla

        // URL ?tab= ile görünüm
        const tab = new URLSearchParams(location.search).get("tab");
        if (tab && document.getElementById("view-" + tab)) switchView(tab);
    });
});

// ---------------- HEADER ----------------
function renderHeader() {
    const name = STATE.profile.nickname || STATE.profile.email;
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-avatar").innerHTML = avatarInner(STATE.profile);
    document.getElementById("nav-admin").style.display = STATE.isAdmin ? "flex" : "none";
    document.getElementById("chat-clear").style.display = STATE.isAdmin ? "" : "none";
    renderBalanceUI();
}

// Admin token'ı hiçbir yerde görünmesin: bakiye hapı + "Token Al" butonları gizlenir.
function renderBalanceUI() {
    const admin = STATE.isAdmin;
    const balEl = document.getElementById("balance");
    if (balEl) balEl.textContent = admin ? "∞" : fmtNum(STATE.profile.balance);
    [["balance-pill", !admin], ["topbar-token-btn", !admin], ["nav-token-btn", !admin]]
        .forEach(([id, on]) => { const el = document.getElementById(id); if (el) el.style.display = on ? "" : "none"; });
}

// users/{uid} canlı dinle (bakiye + admin)
function listenUserDoc() {
    db.collection("users").doc(STATE.user.uid).onSnapshot((snap) => {
        if (!snap.exists) return;
        const u = snap.data();
        STATE.profile = { uid: STATE.user.uid, ...u };
        STATE.isAdmin = !!u.isAdmin;
        document.getElementById("user-avatar").innerHTML = avatarInner(STATE.profile);
        document.getElementById("nav-admin").style.display = STATE.isAdmin ? "flex" : "none";
        document.getElementById("chat-clear").style.display = STATE.isAdmin ? "" : "none";
        renderBalanceUI();
    });
}

// ---------------- GÖRÜNÜM ----------------
function switchView(view) {
    STATE.view = view;
    document.querySelectorAll(".view").forEach(v => v.style.display = "none");
    const el = document.getElementById("view-" + view);
    if (el) el.style.display = "";
    document.querySelectorAll(".nav-item[data-view]").forEach(b =>
        b.classList.toggle("active", b.dataset.view === view));
    const titles = { aktif: "GirelimMi?", gecmis: "Geçmiş", yarat: "Yarat", liderlik: "Liderlik", oyunlar: "Oyunlar" };
    document.getElementById("page-title").textContent = titles[view] || "GirelimMi?";
    toggleSidebar(false);
    renderGrids();
}

function toggleSidebar(open) {
    document.getElementById("sidebar").classList.toggle("open", open);
    document.getElementById("sidebar-backdrop").classList.toggle("show", open);
}

// ---------------- KATEGORİ FİLTRE ----------------
function buildCategoryChips() {
    const cats = ["Tümü", ...APP_CONFIG.CATEGORIES];
    const icons = { "Tümü": "fa-globe", "Spor": "fa-trophy", "Ekonomi": "fa-chart-line", "Siyaset": "fa-landmark", "Eğlence": "fa-gamepad", "Diğer": "fa-ellipsis" };
    const html = cats.map(c =>
        `<button class="chip ${c === 'Tümü' ? 'active' : ''}" data-cat="${c}" onclick="filterCategory('${c}')">
            <i class="fa-solid ${icons[c] || 'fa-tag'}"></i> ${c}
        </button>`).join("");
    document.getElementById("chips-aktif").innerHTML = html;
    document.getElementById("chips-gecmis").innerHTML = html.replace(/active/, "");
}

function filterCategory(cat) {
    STATE.filter = cat;
    document.querySelectorAll(`#view-${STATE.view} .chip`).forEach(ch =>
        ch.classList.toggle("active", ch.dataset.cat === cat));
    renderGrids();
}

// ---------------- MARKET DİNLE & RENDER ----------------
function listenMarkets() {
    db.collection("markets").onSnapshot((snap) => {
        STATE.markets = {};
        snap.forEach(doc => { STATE.markets[doc.id] = { id: doc.id, ...doc.data() }; });
        renderGrids();
        renderCreatorLeaderboard();
    }, (err) => console.error("Market dinleme hatası:", err));
}

function renderGrids() {
    const all = Object.values(STATE.markets);
    const now = Date.now();
    const passFilter = (m) => STATE.filter === "Tümü" || m.category === STATE.filter;

    const active = all.filter(m => !m.resolved && passFilter(m))
        .sort((a, b) => (toDate(a.bettingClosesAt) || 0) - (toDate(b.bettingClosesAt) || 0));
    const past = all.filter(m => m.resolved && passFilter(m))
        .sort((a, b) => (toDate(b.resolvesAt) || 0) - (toDate(a.resolvesAt) || 0));

    const gA = document.getElementById("grid-aktif");
    const gP = document.getElementById("grid-gecmis");
    gA.innerHTML = active.length ? active.map(m => generateMarketCardHTML(m, now)).join("")
        : `<div class="empty-state">Bu kategoride aktif GirelimMi? yok. <br><button class="link-btn" onclick="switchView('yarat')">Hadi bir tane oluştur!</button></div>`;
    gP.innerHTML = past.length ? past.map(m => generateMarketCardHTML(m, now)).join("")
        : `<div class="empty-state">Geçmiş GirelimMi? yok.</div>`;
}

// ---------------- LİDERLİK ----------------
// Tüm kullanıcıları dinle (token sıralaması + açan sıralamasında nick/avatar/admin bilgisi için)
function listenUsersIndex() {
    db.collection("users").onSnapshot((snap) => {
        STATE.usersById = {};
        snap.forEach(d => { STATE.usersById[d.id] = { uid: d.id, ...d.data() }; });
        renderTokenLeaderboard();
        renderCreatorLeaderboard();
    }, (err) => console.error("Kullanıcı dinleme hatası:", err));
}

// Tek bir liderlik satırı (avatar + isim + değer). Adminler çağrı öncesi elenir.
function lbRowHTML(i, u, valueHTML) {
    const rank = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    const name = u.nickname || maskEmail(u.email) || "—";
    return `<div class="lb-row">
        <div class="lb-rank ${i < 3 ? 'top' : ''}">${rank}</div>
        <div class="avatar">${avatarInner(u)}</div>
        <div class="lb-name">${escapeHtml(name)}</div>
        <div class="lb-bal">${valueHTML}</div>
    </div>`;
}

// Token (bakiye) sıralaması — adminler hariç
function renderTokenLeaderboard() {
    const el = document.getElementById("leaderboard");
    if (!el) return;
    const rows = Object.values(STATE.usersById)
        .filter(u => !u.isAdmin)
        .sort((a, b) => (b.balance || 0) - (a.balance || 0))
        .slice(0, 20);
    el.innerHTML = rows.length
        ? rows.map((u, i) => lbRowHTML(i, u, `${fmtNum(u.balance)} <span class="muted" style="font-weight:400;font-size:11px;">token</span>`)).join("")
        : `<div class="empty-state">Henüz oyuncu yok.</div>`;
}

// En çok GirelimMi? açan sıralaması — adminler hariç
function renderCreatorLeaderboard() {
    const el = document.getElementById("leaderboard-acan");
    if (!el) return;
    const info = {};
    Object.values(STATE.markets).forEach(m => {
        if (!m.createdBy) return;
        if (!info[m.createdBy]) info[m.createdBy] = { count: 0, nick: m.creatorNick };
        info[m.createdBy].count++;
    });
    const rows = Object.entries(info).map(([uid, v]) => {
        const u = STATE.usersById[uid] || {};
        return { uid, count: v.count, nickname: u.nickname || v.nick, email: u.email, photoURL: u.photoURL, isAdmin: !!u.isAdmin };
    }).filter(r => !r.isAdmin)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    el.innerHTML = rows.length
        ? rows.map((u, i) => lbRowHTML(i, u, `${fmtNum(u.count)} <span class="muted" style="font-weight:400;font-size:11px;">GirelimMi?</span>`)).join("")
        : `<div class="empty-state">Henüz açılan GirelimMi? yok.</div>`;
}

function switchLeaderboard(tab) {
    document.querySelectorAll("#lb-tabs .chip").forEach(c => c.classList.toggle("active", c.dataset.lb === tab));
    document.getElementById("lb-pane-token").style.display = tab === "token" ? "" : "none";
    document.getElementById("lb-pane-acan").style.display = tab === "acan" ? "" : "none";
}

// ---------------- TOKEN MODAL ----------------
function buildTokenModal() {
    document.getElementById("token-tiers").innerHTML = APP_CONFIG.TOKEN_TIERS.map(t =>
        `<div class="price-row"><span class="tl">${fmtNum(t.tl)} TL</span><span class="tk">${fmtNum(t.token)} Token</span></div>`).join("");
    document.getElementById("iban-no").textContent = APP_CONFIG.IBAN;
    document.getElementById("iban-name").textContent = APP_CONFIG.IBAN_NAME;
    document.getElementById("iban-desc").textContent = STATE.profile.nickname || STATE.profile.email;
}
function openTokenModal() { document.getElementById("token-modal").classList.add("show"); }
function closeTokenModal() { document.getElementById("token-modal").classList.remove("show"); }

async function createTokenRequest() {
    try {
        await db.collection("tokenRequests").add({
            uid: STATE.user.uid,
            nickname: STATE.profile.nickname || STATE.profile.email,
            email: STATE.profile.email,
            type: "token",
            status: "Bekliyor",
            createdAt: FieldValue.serverTimestamp(),
        });
        await notifyAdmins({ title: "💰 Token İsteği", message: `${STATE.profile.nickname || STATE.profile.email} ödeme bildirdi.` });
        toast("İsteğin yöneticiye iletildi.", "ok");
        closeTokenModal();
    } catch (e) { console.error(e); toast("İstek gönderilemedi.", "err"); }
}

// Global erişim
window.switchView = switchView;
window.switchLeaderboard = switchLeaderboard;
window.toggleSidebar = toggleSidebar;
window.filterCategory = filterCategory;
window.openTokenModal = openTokenModal;
window.closeTokenModal = closeTokenModal;
window.createTokenRequest = createTokenRequest;
window.logout = logout;
