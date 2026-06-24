// ======================================================
// GirelimMi? — PROFILE.JS
// ======================================================
let PROF = { user: null, profile: null };

requireAuth(async (user, profile) => {
    PROF.user = user; PROF.profile = profile;
    const name = profile.nickname || profile.email;
    document.getElementById("p-avatar").textContent = initials(name);
    document.getElementById("p-name").textContent = name;
    document.getElementById("p-email").textContent = profile.email || "";
    document.getElementById("p-balance").textContent = fmtNum(profile.balance);
    document.getElementById("balance").textContent = fmtNum(profile.balance);
    await renderMyBets(user.uid);
});

async function renderMyBets(uid) {
    const el = document.getElementById("my-bets");
    try {
        // Tüm marketleri ve kendi bahislerimi çek
        const [betsSnap, marketsSnap] = await Promise.all([
            db.collection("bets").where("uid", "==", uid).get(),
            db.collection("markets").get(),
        ]);
        const markets = {}; marketsSnap.forEach(d => markets[d.id] = { id: d.id, ...d.data() });

        // Bahisler + açtığım marketlerin seed bahisleri
        const entries = [];
        betsSnap.forEach(d => { const b = d.data(); entries.push({ ...b, _t: toDate(b.createdAt)?.getTime() || 0 }); });
        Object.values(markets).forEach(m => {
            if (m.seed && m.seed.uid === uid) {
                const o = (m.options || []).find(x => x.key === m.seed.optionKey);
                entries.push({ marketId: m.id, optionKey: m.seed.optionKey, optionName: o ? o.name : "", amount: m.seed.amount, _seed: true, _t: toDate(m.createdAt)?.getTime() || 0 });
            }
        });
        entries.sort((a, b) => b._t - a._t);

        let wins = 0, created = 0;
        Object.values(markets).forEach(m => { if (m.createdBy === uid) created++; });

        if (!entries.length) { el.innerHTML = `<div class="empty-state">Henüz bahsin yok.</div>`; }
        else {
            el.innerHTML = entries.map(b => {
                const m = markets[b.marketId];
                if (!m) return "";
                let resultBadge = `<span class="badge badge-gri">Bekliyor</span>`;
                if (m.resolved) {
                    const won = m.winningOption === b.optionKey;
                    if (won) wins++;
                    resultBadge = won
                        ? `<span class="badge" style="background:rgba(22,163,74,.12);color:#16a34a;">Kazandı</span>`
                        : `<span class="badge" style="background:rgba(220,38,38,.1);color:#dc2626;">Kaybetti</span>`;
                }
                return `<div class="card" style="padding:14px;">
                    <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                        <div>
                            <div style="font-weight:600;">${escapeHtml(m.title)} ${b._seed ? '<span class="badge badge-turuncu" style="font-size:10px;">kurucu</span>' : ''}</div>
                            <div class="muted" style="font-size:13px;margin-top:4px;">Seçim: <b>${escapeHtml(b.optionName)}</b> · ${fmtNum(b.amount)} token</div>
                        </div>
                        ${resultBadge}
                    </div>
                </div>`;
            }).join("");
        }
        document.getElementById("p-bets").textContent = entries.length;
        document.getElementById("p-wins").textContent = wins;
        document.getElementById("p-created").textContent = created;
    } catch (e) {
        console.error("Bahis geçmişi hatası:", e);
        el.innerHTML = `<div class="empty-state">Yüklenemedi.</div>`;
    }
}

async function changePassword() {
    const cur = document.getElementById("cur-pass").value;
    const np = document.getElementById("new-pass").value;
    const msg = document.getElementById("pass-msg");
    msg.className = "form-msg";
    if (!cur || !np) { msg.textContent = "Her iki alanı da doldur."; msg.classList.add("error"); return; }
    if (np.length < 6) { msg.textContent = "Yeni şifre en az 6 karakter."; msg.classList.add("error"); return; }
    try {
        const cred = firebase.auth.EmailAuthProvider.credential(PROF.user.email, cur);
        await PROF.user.reauthenticateWithCredential(cred);
        await PROF.user.updatePassword(np);
        msg.textContent = "Şifre güncellendi."; msg.classList.add("ok");
        document.getElementById("cur-pass").value = ""; document.getElementById("new-pass").value = "";
    } catch (e) {
        console.error(e);
        msg.textContent = e.code === "auth/wrong-password" || e.code === "auth/invalid-credential" ? "Mevcut şifre hatalı." : "Güncellenemedi.";
        msg.classList.add("error");
    }
}

window.changePassword = changePassword;
window.logout = logout;
