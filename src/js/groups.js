// ======================================================
// GirelimMi? — GROUPS.JS (gruplar: oluştur / katıl / yönet)
// ======================================================
// STATE.myGroups: [{id, name, ownerUid, ownerNick, code}]
// STATE.currentGroup: 'genel' | groupId

async function loadMyGroups() {
    try {
        const u = await db.collection("users").doc(STATE.user.uid).get();
        const gids = (u.data() && u.data().groups) || [];
        const groups = [];
        for (const gid of gids) {
            try {
                const g = await db.collection("groups").doc(gid).get();
                if (g.exists) groups.push({ id: gid, ...g.data() });
            } catch (_) { /* üyelikten çıkarılmış olabilir; atla */ }
        }
        STATE.myGroups = groups;
    } catch (e) {
        console.warn("Gruplar yüklenemedi:", e);
        STATE.myGroups = [];
    }
    populateGroupSelectors();
    if (document.getElementById("groups-modal").classList.contains("show")) renderMyGroupsList();
}

function groupOptionsHtml() {
    return ['<option value="genel">🌍 Genel</option>']
        .concat((STATE.myGroups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`))
        .join("");
}

function populateGroupSelectors() {
    const html = groupOptionsHtml();
    const sel = document.getElementById("group-selector");
    if (sel) { sel.innerHTML = html; sel.value = STATE.currentGroup || "genel"; }
    const msel = document.getElementById("m-group");
    if (msel) { const cur = msel.value || "genel"; msel.innerHTML = html; msel.value = cur; }
}

function currentGroupName() {
    if (STATE.currentGroup === "genel") return "Genel";
    const g = (STATE.myGroups || []).find(x => x.id === STATE.currentGroup);
    return g ? g.name : "Genel";
}

async function onGroupChange(gid) {
    STATE.currentGroup = gid || "genel";
    const sel = document.getElementById("group-selector"); if (sel) sel.value = STATE.currentGroup;
    await loadCurrentGroupMembers();
    listenMarkets();        // markete yeniden abone ol (gruba göre)
    if (typeof renderTokenLeaderboard === "function") renderTokenLeaderboard();
    if (typeof renderCreatorLeaderboard === "function") renderCreatorLeaderboard();
    if (typeof reloadChatForGroup === "function") reloadChatForGroup();
}

// Liderlik kapsamı için grup üyelerinin uid listesi
async function loadCurrentGroupMembers() {
    if (STATE.currentGroup === "genel") { STATE.currentGroupMembers = null; return; }
    try {
        const ms = await db.collection("groups").doc(STATE.currentGroup).collection("members").get();
        const arr = []; ms.forEach(d => arr.push(d.id));
        STATE.currentGroupMembers = arr;
    } catch (e) { STATE.currentGroupMembers = []; }
}

// ---------------- MODAL ----------------
function openGroupsModal() {
    document.getElementById("groups-modal").classList.add("show");
    renderMyGroupsList();
    loadMyGroups();
}
function closeGroupsModal() { document.getElementById("groups-modal").classList.remove("show"); }

async function renderMyGroupsList() {
    const el = document.getElementById("my-groups-list");
    if (!STATE.myGroups || !STATE.myGroups.length) {
        el.innerHTML = `<div class="empty-state">Henüz bir grupta değilsin. Grup oluştur ya da bir kodla katıl.</div>`;
        return;
    }
    const blocks = await Promise.all(STATE.myGroups.map(async (g) => {
        const isOwner = g.ownerUid === STATE.user.uid;
        let members = [];
        try {
            const ms = await db.collection("groups").doc(g.id).collection("members").get();
            ms.forEach(d => members.push({ uid: d.id, ...d.data() }));
        } catch (_) {}
        const memberRows = members.map(m => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;padding:4px 0;">
                <span>${escapeHtml(m.nickname || m.uid)} ${m.role === "owner" ? '<span class="badge badge-turuncu" style="font-size:10px;">sahip</span>' : ""}</span>
                ${isOwner && m.uid !== STATE.user.uid ? `<button class="link-btn" style="color:#dc2626" onclick="removeMember('${g.id}','${m.uid}')">çıkar</button>` : ""}
            </div>`).join("");
        return `<div class="card" style="padding:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <strong>${escapeHtml(g.name)}</strong>
                ${isOwner ? '<span class="badge badge-turuncu">sahip</span>' : `<button class="btn btn-danger" style="padding:5px 10px;font-size:12px;" onclick="leaveGroup('${g.id}')">Ayrıl</button>`}
            </div>
            ${isOwner ? `<div class="iban-box" style="margin-top:10px;">Grup kodu: <code>${escapeHtml(g.code)}</code>
                <button class="link-btn" onclick="copyText('${escapeHtml(g.code)}')">kopyala</button></div>` : ""}
            <div style="margin-top:10px;border-top:1px solid var(--acik-gri);padding-top:8px;">
                <div class="muted" style="font-size:12px;margin-bottom:4px;">Üyeler (${members.length})</div>
                ${memberRows || '<span class="muted" style="font-size:12px;">—</span>'}
            </div>
        </div>`;
    }));
    el.innerHTML = blocks.join("");
}

function copyText(t) {
    navigator.clipboard?.writeText(t).then(() => toast("Kopyalandı: " + t, "ok")).catch(() => toast(t, "info"));
}

// ---------------- OLUŞTUR ----------------
async function promptCreateGroup() {
    const name = prompt("Grup adı (örn: Arkadaşlar, Aile):");
    if (!name || !name.trim()) return;
    await createGroup(name.trim());
}

async function createGroup(name) {
    if (!fbReadyGuard()) return;
    try {
        const gref = db.collection("groups").doc();
        const code = "GRP" + Math.random().toString(36).slice(2, 7).toUpperCase();
        const nick = STATE.profile.nickname || STATE.profile.email;
        // 1) grup, 2) sahip üyeliği, 3) kod, 4) kullanıcıya ekle (sırayla; kural get() için grup önce olmalı)
        await gref.set({ name, ownerUid: STATE.user.uid, ownerNick: nick, code, createdAt: FieldValue.serverTimestamp() });
        await gref.collection("members").doc(STATE.user.uid).set({ nickname: nick, role: "owner", joinedAt: FieldValue.serverTimestamp() });
        await db.collection("groupCodes").doc(code).set({ groupId: gref.id });
        await db.collection("users").doc(STATE.user.uid).update({ groups: FieldValue.arrayUnion(gref.id) });
        toast(`"${name}" grubu oluşturuldu. Kod: ${code}`, "ok");
        await loadMyGroups();
        STATE.currentGroup = gref.id;
        populateGroupSelectors();
        onGroupChange(gref.id);
    } catch (e) {
        console.error("Grup oluşturma hatası:", e);
        toast("Grup oluşturulamadı.", "err");
    }
}

// ---------------- KATIL ----------------
async function promptJoinGroup() {
    const code = prompt("Grup kodunu gir:");
    if (!code || !code.trim()) return;
    await joinGroup(code.trim());
}

async function joinGroup(code) {
    if (!fbReadyGuard()) return;
    try {
        const snap = await db.collection("groupCodes").doc(code).get();
        if (!snap.exists) { toast("Geçersiz grup kodu.", "err"); return; }
        const gid = snap.data().groupId;
        const nick = STATE.profile.nickname || STATE.profile.email;
        await db.collection("groups").doc(gid).collection("members").doc(STATE.user.uid)
            .set({ nickname: nick, role: "member", joinedAt: FieldValue.serverTimestamp() });
        await db.collection("users").doc(STATE.user.uid).update({ groups: FieldValue.arrayUnion(gid) });
        toast("Gruba katıldın! 🎉", "ok");
        await loadMyGroups();
        STATE.currentGroup = gid;
        populateGroupSelectors();
        onGroupChange(gid);
    } catch (e) {
        console.error("Gruba katılma hatası:", e);
        toast("Katılınamadı.", "err");
    }
}

// ---------------- AYRIL / ÇIKAR ----------------
async function leaveGroup(gid) {
    if (!confirm("Bu gruptan ayrılmak istediğine emin misin?")) return;
    try {
        await db.collection("groups").doc(gid).collection("members").doc(STATE.user.uid).delete();
        await db.collection("users").doc(STATE.user.uid).update({ groups: FieldValue.arrayRemove(gid) });
        if (STATE.currentGroup === gid) { STATE.currentGroup = "genel"; onGroupChange("genel"); }
        toast("Gruptan ayrıldın.", "ok");
        await loadMyGroups();
    } catch (e) { console.error(e); toast("İşlem başarısız.", "err"); }
}

async function removeMember(gid, uid) {
    if (!confirm("Bu üyeyi gruptan çıkar?")) return;
    try {
        await db.collection("groups").doc(gid).collection("members").doc(uid).delete();
        toast("Üye çıkarıldı.", "ok");
        renderMyGroupsList();
    } catch (e) { console.error(e); toast("İşlem başarısız.", "err"); }
}

window.onGroupChange = onGroupChange;
window.openGroupsModal = openGroupsModal;
window.closeGroupsModal = closeGroupsModal;
window.promptCreateGroup = promptCreateGroup;
window.promptJoinGroup = promptJoinGroup;
window.leaveGroup = leaveGroup;
window.removeMember = removeMember;
window.copyText = copyText;
