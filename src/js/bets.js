// ======================================================
// GirelimMi? — BETS.JS (bahis modalı + transaction)
// ======================================================
let activeBet = { marketId: null, key: null, name: null };

function openBetModal(marketId, key, name) {
    const m = STATE.markets[marketId];
    if (!m) return;
    if (marketStatus(m) !== "aktif") { toast("Bu GirelimMi? bahise kapalı.", "info"); return; }
    activeBet = { marketId, key, name };
    document.getElementById("bet-title").textContent = m.title;
    document.getElementById("bet-choice").textContent = name;
    document.getElementById("bet-amount").value = "";
    document.getElementById("bet-modal").classList.add("show");
    setTimeout(() => document.getElementById("bet-amount").focus(), 50);
}
function closeBetModal() { document.getElementById("bet-modal").classList.remove("show"); }

async function confirmBet() {
    if (!fbReadyGuard() || !activeBet.marketId) return;
    const amount = parseInt(document.getElementById("bet-amount").value);
    if (isNaN(amount) || amount <= 0) return toast("Geçerli bir miktar gir.", "err");
    if (!STATE.isAdmin && amount > (STATE.profile.balance || 0)) return toast("Yetersiz bakiye.", "err");

    const btn = document.getElementById("bet-confirm");
    btn.disabled = true;
    const userRef = db.collection("users").doc(STATE.user.uid);
    const marketRef = db.collection("markets").doc(activeBet.marketId);
    const betRef = db.collection("bets").doc();
    try {
        await db.runTransaction(async (tx) => {
            // Admin sınırsız: bakiye düşülmez; sadece havuz ve bahis kaydı güncellenir.
            const mSnap = await tx.get(marketRef);
            const uSnap = STATE.isAdmin ? null : await tx.get(userRef);
            if (!mSnap.exists) throw new Error("GirelimMi? bulunamadı.");
            const m = mSnap.data();
            if (marketStatus(m) !== "aktif") throw new Error("Bahis kapandı.");
            if (!STATE.isAdmin) {
                const bal = uSnap.data().balance || 0;
                if (amount > bal) throw new Error("Yetersiz bakiye.");
                tx.update(userRef, { balance: bal - amount });
            }

            const pools = Object.assign({}, m.pools || {});
            pools[activeBet.key] = (pools[activeBet.key] || 0) + amount;
            tx.update(marketRef, { pools, totalPool: (m.totalPool || 0) + amount });
            tx.set(betRef, {
                marketId: activeBet.marketId, uid: STATE.user.uid,
                nickname: STATE.profile.nickname || STATE.profile.email,
                optionKey: activeBet.key, optionName: activeBet.name,
                amount, createdAt: FieldValue.serverTimestamp(),
            });
        });

        const m = STATE.markets[activeBet.marketId];
        await addLiveBet(`${STATE.profile.nickname || "Biri"} "${m ? m.title : ''}" → ${activeBet.name} (${fmtNum(amount)} token)`);
        // Market sahibine bildirim
        if (m && m.createdBy && m.createdBy !== STATE.user.uid) {
            notifyUser(m.createdBy, { title: "📊 Yeni bahis", message: `${STATE.profile.nickname || "Biri"}, "${m.title}" üzerine ${fmtNum(amount)} token yatırdı.` });
        }
        toast(`${fmtNum(amount)} token yatırıldı! Seçim: ${activeBet.name}`, "ok");
        closeBetModal();
    } catch (e) {
        console.error("Bahis hatası:", e);
        toast(e.message || "Bahis yapılamadı.", "err");
    } finally {
        btn.disabled = false;
    }
}

window.openBetModal = openBetModal;
window.closeBetModal = closeBetModal;
window.confirmBet = confirmBet;
