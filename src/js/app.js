// ======================================================
// GirelimMi? — APP.JS (başlangıç, durum, görünüm yönetimi)
// ======================================================
const STATE = {
    user: null, profile: null, isAdmin: false,
    markets: {},           // id -> market
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
        listenLeaderboard();
        startNotifications();
        startChat();
        startLiveFeed();

        // URL ?tab= ile görünüm
        const tab = new URLSearchParams(location.search).get("tab");
        if (tab && document.getElementById("view-" + tab)) switchView(tab);
    });
});

// ---------------- HEADER ----------------
function renderHeader() {
    const name = STATE.profile.nickname || STATE.profile.email;
    document.getElementById("user-name").textContent = name;
    document.getElementById("user-avatar").textContent = initials(name);
    document.getElementById("balance").textContent = fmtNum(STATE.profile.balance);
    document.getElementById("nav-admin").style.display = STATE.isAdmin ? "flex" : "none";
    document.getElementById("chat-clear").style.display = STATE.isAdmin ? "" : "none";
}

// users/{uid} canlı dinle (bakiye + admin)
function listenUserDoc() {
    db.collection("users").doc(STATE.user.uid).onSnapshot((snap) => {
        if (!snap.exists) return;
        const u = snap.data();
        STATE.profile = { uid: STATE.user.uid, ...u };
        STATE.isAdmin = !!u.isAdmin;
        document.getElementById("balance").textContent = fmtNum(u.balance);
        document.getElementById("nav-admin").style.display = STATE.isAdmin ? "flex" : "none";
        document.getElementById("chat-clear").style.display = STATE.isAdmin ? "" : "none";
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
    const titles = { aktif: "Aktif GirelimMi?", gecmis: "Geçmiş", yarat: "Yarat", liderlik: "Liderlik" };
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
function listenLeaderboard() {
    db.collection("users").orderBy("balance", "desc").limit(20).onSnapshot((snap) => {
        const rows = [];
        snap.forEach(d => rows.push(d.data()));
        STATE.leaderboard = rows;
        const el = document.getElementById("leaderboard");
        if (!rows.length) { el.innerHTML = `<div class="empty-state">Henüz oyuncu yok.</div>`; return; }
        el.innerHTML = rows.map((u, i) => `
            <div class="lb-row">
                <div class="lb-rank ${i < 3 ? 'top' : ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</div>
                <div class="avatar">${initials(u.nickname || u.email)}</div>
                <div class="lb-name">${escapeHtml(u.nickname || maskEmail(u.email))}</div>
                <div class="lb-bal">${fmtNum(u.balance)} <span class="muted" style="font-weight:400;font-size:11px;">token</span></div>
            </div>`).join("");
    }, (err) => console.error("Liderlik hatası:", err));
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
window.toggleSidebar = toggleSidebar;
window.filterCategory = filterCategory;
window.openTokenModal = openTokenModal;
window.closeTokenModal = closeTokenModal;
window.createTokenRequest = createTokenRequest;
window.logout = logout;
