// ======================================================
// GirelimMi? — NOTIFICATIONS.JS
// ======================================================
let NOTIS = [];

function startNotifications() {
    db.collection("notifications")
        .where("to", "==", STATE.user.uid)
        .onSnapshot((snap) => {
            NOTIS = []; snap.forEach(d => NOTIS.push({ id: d.id, ...d.data() }));
            NOTIS.sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
            NOTIS = NOTIS.slice(0, 30);
            renderNotifications();
        }, (e) => console.error("Bildirim hatası:", e));
}

function renderNotifications() {
    const unread = NOTIS.filter(n => !n.read).length;
    const badge = document.getElementById("noti-badge");
    badge.textContent = unread;
    badge.classList.toggle("show", unread > 0);

    const list = document.getElementById("noti-list");
    if (!NOTIS.length) { list.innerHTML = `<div class="empty-state">Bildirim yok.</div>`; return; }
    list.innerHTML = NOTIS.map(n => `
        <div class="noti ${n.read ? '' : 'unread'}" onclick="markNotificationRead('${n.id}')">
            <span class="nt-title">${escapeHtml(n.title || "Bildirim")}</span>
            <span class="nt-msg">${escapeHtml(n.message || "")}</span>
            <span class="nt-time">${timeAgo(n.createdAt)}</span>
        </div>`).join("");
}

function toggleNotifications() {
    document.getElementById("noti-menu").classList.toggle("show");
}

async function markNotificationRead(id) {
    try { await db.collection("notifications").doc(id).update({ read: true }); }
    catch (e) { console.warn(e); }
}

async function markAllNotificationsRead() {
    const batch = db.batch();
    NOTIS.filter(n => !n.read).forEach(n => batch.update(db.collection("notifications").doc(n.id), { read: true }));
    try { await batch.commit(); } catch (e) { console.warn(e); }
}

// Tek kullanıcıya bildirim
async function notifyUser(uid, { title, message }) {
    try {
        await db.collection("notifications").add({
            to: uid, read: false, title, message, createdAt: FieldValue.serverTimestamp(),
        });
    } catch (e) { console.warn("Bildirim gönderilemedi:", e); }
}

// Tüm adminlere bildirim
async function notifyAdmins({ title, message }) {
    try {
        const snap = await db.collection("users").where("isAdmin", "==", true).get();
        const batch = db.batch();
        snap.forEach(d => batch.set(db.collection("notifications").doc(), {
            to: d.id, read: false, title, message, createdAt: FieldValue.serverTimestamp(),
        }));
        await batch.commit();
    } catch (e) { console.warn("Admin bildirimi gönderilemedi:", e); }
}

// Dışarı tıklayınca dropdown kapansın
document.addEventListener("click", (e) => {
    const dd = document.getElementById("noti-menu");
    if (dd && dd.classList.contains("show") && !e.target.closest(".dropdown")) dd.classList.remove("show");
});

window.toggleNotifications = toggleNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;
