// ======================================================
// GirelimMi? — CHAT.JS (genel + market sohbeti)
// ======================================================
let chatChannel = "global";
let chatMarketId = null;
let chatMarketTitle = "";
let chatUnsub = null;

function startChat() { switchChat("global"); }

function listenChannel(channelKey) {
    if (chatUnsub) chatUnsub();
    const body = document.getElementById("chat-body");
    body.innerHTML = `<div class="empty-state"><i class="fa-solid fa-spinner spin"></i></div>`;
    chatUnsub = db.collection("chat")
        .where("channel", "==", channelKey)
        .orderBy("createdAt", "asc").limit(100)
        .onSnapshot((snap) => {
            const msgs = []; snap.forEach(d => msgs.push(d.data()));
            body.innerHTML = msgs.length ? msgs.map(mm => `
                <div class="chat-msg"><span class="cm-name">${escapeHtml(mm.nickname || "?")}:</span>${escapeHtml(mm.text)}</div>`).join("")
                : `<div class="empty-state">İlk mesajı sen yaz!</div>`;
            body.scrollTop = body.scrollHeight;
        }, (e) => { console.error("Sohbet hatası:", e); body.innerHTML = `<div class="empty-state">Sohbet yüklenemedi.</div>`; });
}

function switchChat(tab) {
    chatChannel = tab;
    document.querySelectorAll(".chat-tab").forEach(t => t.classList.toggle("active", t.dataset.ch === tab));
    listenChannel(tab === "market" && chatMarketId ? "market_" + chatMarketId : "global");
}

function openMarketChat(marketId, title) {
    chatMarketId = marketId; chatMarketTitle = title;
    const tab = document.getElementById("chat-tab-market");
    tab.style.display = ""; tab.textContent = "📊 " + (title.length > 12 ? title.slice(0, 12) + "…" : title);
    document.getElementById("chat-panel").classList.remove("min");
    document.getElementById("chat-min-icon").className = "fa-solid fa-minus";
    switchChat("market");
}

async function sendChat() {
    if (!fbReadyGuard()) return;
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    const channelKey = chatChannel === "market" && chatMarketId ? "market_" + chatMarketId : "global";
    input.value = "";
    try {
        await db.collection("chat").add({
            channel: channelKey, uid: STATE.user.uid,
            nickname: STATE.profile.nickname || STATE.profile.email,
            text, createdAt: FieldValue.serverTimestamp(),
        });
    } catch (e) { console.error(e); toast("Mesaj gönderilemedi.", "err"); input.value = text; }
}

function toggleChatMin() {
    const p = document.getElementById("chat-panel");
    p.classList.toggle("min");
    document.getElementById("chat-min-icon").className = p.classList.contains("min") ? "fa-solid fa-plus" : "fa-solid fa-minus";
}

async function clearChat() {
    if (!STATE.isAdmin) return;
    if (!confirm("Bu kanaldaki tüm mesajlar silinsin mi?")) return;
    const channelKey = chatChannel === "market" && chatMarketId ? "market_" + chatMarketId : "global";
    try {
        const snap = await db.collection("chat").where("channel", "==", channelKey).get();
        const batch = db.batch(); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
        toast("Sohbet temizlendi.", "ok");
    } catch (e) { console.error(e); toast("Temizlenemedi.", "err"); }
}

window.switchChat = switchChat;
window.openMarketChat = openMarketChat;
window.sendChat = sendChat;
window.toggleChatMin = toggleChatMin;
window.clearChat = clearChat;
