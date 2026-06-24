// ======================================================
// GirelimMi? — ADMIN.JS (yönetici paneli)
// ======================================================
let adminUnsubs = [];

function openAdminPanel() {
    if (!STATE.isAdmin) { toast("Yetkin yok.", "err"); return; }
    document.getElementById("admin-modal").classList.add("show");
    startAdminListeners();
}
function closeAdminPanel() {
    document.getElementById("admin-modal").classList.remove("show");
    adminUnsubs.forEach(u => u && u()); adminUnsubs = [];
}

function startAdminListeners() {
    adminUnsubs.forEach(u => u && u()); adminUnsubs = [];

    // Bekleyen istekler
    adminUnsubs.push(db.collection("tokenRequests").where("status", "==", "Bekliyor")
        .onSnapshot((snap) => {
            const reqs = []; snap.forEach(d => reqs.push({ id: d.id, ...d.data() }));
            const el = document.getElementById("admin-requests");
            el.innerHTML = reqs.length ? reqs.map(r => `
                <div class="price-row">
                    <div><strong>${escapeHtml(r.nickname || r.email)}</strong><br><span class="muted" style="font-size:12px;">${escapeHtml(r.email || "")} · ${timeAgo(r.createdAt)}</span></div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-soft" style="padding:6px 12px;font-size:13px;" onclick="approveToken('${r.id}','${r.uid}')">Token Yükle</button>
                        <button class="btn btn-danger" style="padding:6px 10px;font-size:13px;" onclick="rejectRequest('${r.id}')"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>`).join("") : `<div class="empty-state">Bekleyen istek yok.</div>`;
        }, e => console.error(e)));

    // Davet kodları (kullanılmamış)
    adminUnsubs.push(db.collection("inviteCodes").onSnapshot((snap) => {
        const codes = []; snap.forEach(d => { const c = d.data(); if (!c.used) codes.push(d.id); });
        const el = document.getElementById("admin-codes");
        el.innerHTML = codes.length ? codes.map(c => `
            <div class="badge badge-turuncu" style="flex:none;">
                ${escapeHtml(c)}
                <button class="link-btn" style="color:var(--turuncu-koyu)" onclick="deleteInviteCode('${c}')"><i class="fa-solid fa-xmark"></i></button>
            </div>`).join("") : `<div class="empty-state" style="flex:1;">Kullanılmamış kod yok.</div>`;
    }, e => console.error(e)));

    // Kullanıcılar
    adminUnsubs.push(db.collection("users").orderBy("balance", "desc").onSnapshot((snap) => {
        const rows = []; snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
        document.getElementById("admin-users").innerHTML = rows.map(u => `
            <tr>
                <td>${escapeHtml(u.nickname || "—")} ${u.isAdmin ? '<span class="badge badge-gri">admin</span>' : ''}</td>
                <td>${escapeHtml(u.email || "")}</td>
                <td>${fmtNum(u.balance)}</td>
                <td style="text-align:right;white-space:nowrap;">
                    <button class="btn btn-soft" style="padding:5px 10px;font-size:12px;" onclick="setTokensManual('${u.id}', ${u.balance || 0})">Bakiye</button>
                    <button class="btn btn-danger" style="padding:5px 9px;font-size:12px;" onclick="deleteUser('${u.id}','${escapeHtml(u.nickname || u.email)}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`).join("");
    }, e => console.error(e)));
}

async function approveToken(reqId, uid) {
    const amount = parseInt(prompt("Yüklenecek token miktarı:"));
    if (isNaN(amount) || amount <= 0) return;
    try {
        const ref = db.collection("users").doc(uid);
        await db.runTransaction(async (tx) => {
            const s = await tx.get(ref);
            tx.update(ref, { balance: (s.data().balance || 0) + amount });
        });
        await db.collection("tokenRequests").doc(reqId).update({ status: "Onaylandı", approvedAmount: amount, approvedAt: FieldValue.serverTimestamp() });
        await db.collection("auditLog").add({ type: "grant", to: uid, amount, by: STATE.user.uid, at: FieldValue.serverTimestamp() });
        await notifyUser(uid, { title: "💰 Token yüklendi", message: `Hesabına ${fmtNum(amount)} token eklendi.` });
        toast("Token yüklendi.", "ok");
    } catch (e) { console.error(e); toast("Yüklenemedi.", "err"); }
}

async function rejectRequest(reqId) {
    try { await db.collection("tokenRequests").doc(reqId).update({ status: "Reddedildi" }); toast("Reddedildi.", "ok"); }
    catch (e) { console.error(e); toast("İşlenemedi.", "err"); }
}

async function setTokensManual(uid, current) {
    const v = prompt("Yeni bakiye:", current);
    if (v === null) return;
    const amount = parseInt(v);
    if (isNaN(amount) || amount < 0) return toast("Geçersiz.", "err");
    try {
        await db.collection("users").doc(uid).update({ balance: amount });
        await db.collection("auditLog").add({ type: "setBalance", to: uid, amount, by: STATE.user.uid, at: FieldValue.serverTimestamp() });
        toast("Bakiye güncellendi.", "ok");
    } catch (e) { console.error(e); toast("Güncellenemedi.", "err"); }
}

async function generateInviteCode() {
    const code = "GM" + Math.random().toString(36).slice(2, 7).toUpperCase();
    try {
        await db.collection("inviteCodes").doc(code).set({ used: false, createdBy: STATE.user.uid, createdAt: FieldValue.serverTimestamp() });
        toast("Yeni kod: " + code, "ok");
    } catch (e) { console.error(e); toast("Kod üretilemedi.", "err"); }
}

async function deleteInviteCode(code) {
    try { await db.collection("inviteCodes").doc(code).delete(); } catch (e) { console.error(e); }
}

async function deleteUser(uid, name) {
    if (!confirm(`${name} kullanıcısının profili silinsin mi? (Auth kaydı Firebase Console'dan ayrıca silinmeli)`)) return;
    try { await db.collection("users").doc(uid).delete(); toast("Profil silindi.", "ok"); }
    catch (e) { console.error(e); toast("Silinemedi.", "err"); }
}

window.openAdminPanel = openAdminPanel;
window.closeAdminPanel = closeAdminPanel;
window.approveToken = approveToken;
window.rejectRequest = rejectRequest;
window.setTokensManual = setTokensManual;
window.generateInviteCode = generateInviteCode;
window.deleteInviteCode = deleteInviteCode;
window.deleteUser = deleteUser;
