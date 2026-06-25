// ======================================================
// GirelimMi? — MARKETS.JS (kart, oluşturma, sonuçlandırma, canlı akış)
// ======================================================

// ---------------- MARKET KARTI ----------------
function generateMarketCardHTML(m, now = Date.now()) {
    const status = marketStatus(m, now);
    const pools = m.pools || {};
    const total = m.totalPool || Object.values(pools).reduce((s, v) => s + (v || 0), 0);
    const options = m.options || [];
    const canBet = status === "aktif";

    // Parimutuel: bir seçeneğe yatırılan 1 token'ın tahmini net kazancı (%)
    // = dağıtılacak havuz / o seçeneğin havuzu - 1. (Komisyon düşülmüş)
    const commission = (m.commissionRate != null) ? m.commissionRate : APP_CONFIG.COMMISSION_RATE;
    const distributed = total * (1 - commission);

    const optRows = options.map(o => {
        const pool = pools[o.key] || 0;
        const pct = total > 0 ? Math.round(pool / total * 100) : 0;
        const isWin = m.resolved && m.winningOption === o.key;
        const clickable = canBet ? `onclick="openBetModal('${m.id}','${o.key}', this.dataset.name)"` : "";
        // Tahmini kazanç notu yalnızca bahis açıkken ve havuz oluşmuşken gösterilir.
        let oddsNote = "";
        if (canBet && total > 0 && pool > 0) {
            const profitPct = Math.round((distributed / pool - 1) * 100);
            oddsNote = `<span class="opt-odds" title="Bu seçeneğe yatırılan token başına tahmini kazanç">≈ %${profitPct} kazanç</span>`;
        } else if (canBet && total > 0 && pool === 0) {
            oddsNote = `<span class="opt-odds" title="Bu seçeneğe ilk bahsi sen yaparsın">ilk bahis</span>`;
        }
        return `<div class="opt-row ${canBet ? '' : 'disabled'} ${isWin ? 'win' : ''}" data-name="${escapeHtml(o.name)}" ${clickable}>
                    <span class="opt-bar" style="width:${pct}%"></span>
                    <span class="opt-name">${isWin ? '🏆 ' : ''}${escapeHtml(o.name)}</span>
                    <span class="opt-pct">${pct}% · ${fmtNum(pool)}${oddsNote}</span>
                </div>`;
    }).join("");

    const statusCls = { aktif: "aktif", yaklasan: "yaklasan", kilitli: "kilitli", sonuclandi: "sonuclandi" }[status];
    const timeLine = status === "yaklasan"
        ? `<i class="fa-solid fa-hourglass-start"></i> Başlangıç: ${fmtDateTime(m.startsAt)}`
        : status === "aktif"
        ? `<i class="fa-solid fa-lock"></i> Kilit: ${fmtDateTime(m.bettingClosesAt)}`
        : status === "kilitli"
        ? `<i class="fa-solid fa-flag-checkered"></i> Sonuç: ${fmtDateTime(m.resolvesAt)}`
        : `<i class="fa-solid fa-check"></i> Sonuçlandı: ${fmtDateTime(m.resolvesAt)}`;

    const isOwnerOrAdmin = STATE.isAdmin || m.createdBy === STATE.user.uid;
    let actions = `<button class="btn btn-ghost" style="padding:8px 14px;font-size:13px;" onclick="openMarketChat('${m.id}','${escapeHtml(m.title).replace(/'/g, "")}')"><i class="fa-solid fa-comments"></i> Yorumlar</button>`;
    if (status === "kilitli" && STATE.isAdmin) {
        actions += `<button class="btn btn-primary" style="padding:8px 14px;font-size:13px;" onclick="openResolveModal('${m.id}')"><i class="fa-solid fa-gavel"></i> Sonuçlandır</button>`;
    }
    if (STATE.isAdmin) {
        actions += `<button class="btn btn-danger" style="padding:8px 12px;font-size:13px;" onclick="deleteMarket('${m.id}')"><i class="fa-solid fa-trash"></i></button>`;
    }

    return `<div class="market-card">
        <div class="mc-top">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <span class="badge badge-turuncu">${escapeHtml(m.category || "Diğer")}</span>
                ${m.groupId && m.groupId !== "genel" ? `<span class="badge badge-gri"><i class="fa-solid fa-users"></i> ${escapeHtml(m.groupName || "Grup")}</span>` : ""}
            </div>
            <span class="mc-status ${statusCls}">${STATUS_LABEL[status]}</span>
        </div>
        <div class="mc-title">${escapeHtml(m.title)}</div>
        <div class="options">${optRows}</div>
        <div class="mc-meta">
            <span>${timeLine}</span>
            <span><i class="fa-solid fa-coins"></i> Havuz: ${fmtNum(total)}</span>
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(m.creatorNick || "—")}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">${actions}</div>
    </div>`;
}

// ---------------- YARAT FORMU ----------------
function buildCreateForm() {
    const cat = document.getElementById("m-category");
    cat.innerHTML = APP_CONFIG.CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("");

    const box = document.getElementById("m-options");
    box.innerHTML = "";
    addOptionInput("Evet");
    addOptionInput("Hayır");
    refreshChoiceSelect();

    // Varsayılan zamanlar: başlangıç +1sa, kapanış +3sa, bitiş +5sa
    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const base = new Date();
    document.getElementById("m-start").value = fmt(new Date(base.getTime() + 60 * 60000));
    document.getElementById("m-close").value = fmt(new Date(base.getTime() + 180 * 60000));
    document.getElementById("m-end").value = fmt(new Date(base.getTime() + 300 * 60000));
}

function addOptionInput(value = "") {
    const box = document.getElementById("m-options");
    const count = box.children.length;
    if (count >= APP_CONFIG.MAX_OPTIONS) { toast(`En fazla ${APP_CONFIG.MAX_OPTIONS} seçenek.`, "info"); return; }
    const row = document.createElement("div");
    row.style.display = "flex"; row.style.gap = "8px"; row.style.alignItems = "center";
    row.innerHTML = `
        <input type="text" class="opt-input" placeholder="Seçenek ${count + 1}" value="${escapeHtml(value)}" oninput="refreshChoiceSelect()">
        <button type="button" class="icon-btn" onclick="removeOptionInput(this)" title="Kaldır"><i class="fa-solid fa-xmark"></i></button>`;
    box.appendChild(row);
    document.getElementById("add-option-btn").style.display = box.children.length >= APP_CONFIG.MAX_OPTIONS ? "none" : "";
    refreshChoiceSelect();
}

function removeOptionInput(btn) {
    const box = document.getElementById("m-options");
    if (box.children.length <= APP_CONFIG.MIN_OPTIONS) { toast(`En az ${APP_CONFIG.MIN_OPTIONS} seçenek olmalı.`, "info"); return; }
    btn.parentElement.remove();
    document.getElementById("add-option-btn").style.display = "";
    [...box.querySelectorAll(".opt-input")].forEach((inp, i) => { if (!inp.value) inp.placeholder = "Seçenek " + (i + 1); });
    refreshChoiceSelect();
}

function getOptionNames() {
    return [...document.querySelectorAll("#m-options .opt-input")].map(i => i.value.trim());
}

function refreshChoiceSelect() {
    const names = getOptionNames();
    const sel = document.getElementById("m-choice");
    const prev = sel.value;
    sel.innerHTML = names.map((n, i) => `<option value="${i}">${escapeHtml(n || "Seçenek " + (i + 1))}</option>`).join("");
    if (prev && names[prev] !== undefined) sel.value = prev;
}

// ---------------- MARKET OLUŞTUR ----------------
async function createMarket() {
    if (!fbReadyGuard()) return;
    const title = document.getElementById("m-title").value.trim();
    const category = document.getElementById("m-category").value;
    const names = getOptionNames();
    const startV = document.getElementById("m-start").value;
    const closeV = document.getElementById("m-close").value;
    const endV = document.getElementById("m-end").value;
    const choiceIdx = parseInt(document.getElementById("m-choice").value);
    const amount = parseInt(document.getElementById("m-bet").value);
    const groupId = document.getElementById("m-group")?.value || "genel";
    const groupName = groupId === "genel" ? "Genel" : (((STATE.myGroups || []).find(g => g.id === groupId) || {}).name || "Grup");

    if (!title) return toast("Başlık gir.", "err");
    if (names.length < APP_CONFIG.MIN_OPTIONS || names.some(n => !n)) return toast("Tüm seçenek adlarını doldur (en az 2).", "err");
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast("Seçenek adları benzersiz olmalı.", "err");
    if (!startV || !closeV || !endV) return toast("Üç zamanı da gir.", "err");

    const startsAt = new Date(startV), bettingClosesAt = new Date(closeV), resolvesAt = new Date(endV);
    if (!(startsAt < bettingClosesAt && bettingClosesAt < resolvesAt))
        return toast("Zamanlar sırayla olmalı: Başlangıç < Kapanış < Bitiş.", "err");
    if (bettingClosesAt <= new Date()) return toast("Kapanış zamanı gelecekte olmalı.", "err");
    if (isNaN(amount) || amount <= 0) return toast("Geçerli bir token miktarı gir.", "err");
    if (!STATE.isAdmin && amount > (STATE.profile.balance || 0)) return toast("Yetersiz bakiye.", "err");

    const options = names.map((n, i) => ({ key: "o" + i, name: n }));
    const choiceKey = "o" + choiceIdx;
    const pools = {}; options.forEach(o => pools[o.key] = 0); pools[choiceKey] = amount;

    const btn = document.getElementById("create-btn");
    btn.disabled = true;
    try {
        const userRef = db.collection("users").doc(STATE.user.uid);
        const marketRef = db.collection("markets").doc();
        await db.runTransaction(async (tx) => {
            // Admin sınırsız: bakiye düşülmez. Diğer kullanıcılarda ilk havuz bakiyeden iner.
            if (!STATE.isAdmin) {
                const uSnap = await tx.get(userRef);
                const bal = uSnap.data().balance || 0;
                if (amount > bal) throw new Error("Yetersiz bakiye.");
                tx.update(userRef, { balance: bal - amount });
            }
            tx.set(marketRef, {
                title, category, options, pools, totalPool: amount,
                groupId, groupName,
                seed: { uid: STATE.user.uid, nickname: STATE.profile.nickname || STATE.profile.email, optionKey: choiceKey, amount },
                createdBy: STATE.user.uid,
                creatorNick: STATE.profile.nickname || STATE.profile.email,
                resolved: false, winningOption: null,
                commissionRate: APP_CONFIG.COMMISSION_RATE,
                startsAt: Timestamp.fromDate(startsAt),
                bettingClosesAt: Timestamp.fromDate(bettingClosesAt),
                resolvesAt: Timestamp.fromDate(resolvesAt),
                createdAt: FieldValue.serverTimestamp(),
            });
        });

        await addLiveBet(`${STATE.profile.nickname || "Biri"} yeni bir GirelimMi? açtı: "${title}"`);
        toast("GirelimMi? oluşturuldu! ⚡", "ok");
        document.getElementById("m-title").value = "";
        document.getElementById("m-bet").value = "";
        if (groupId !== STATE.currentGroup && typeof onGroupChange === "function") onGroupChange(groupId);
        switchView("aktif");
    } catch (e) {
        console.error("Market oluşturma hatası:", e);
        toast(e.message || "Oluşturulamadı.", "err");
    } finally {
        btn.disabled = false;
    }
}

async function deleteMarket(id) {
    if (!STATE.isAdmin) return;
    if (!confirm("Bu GirelimMi? silinsin mi? (Bahisler iade edilmez)")) return;
    try { await db.collection("markets").doc(id).delete(); toast("Silindi.", "ok"); }
    catch (e) { console.error(e); toast("Silinemedi.", "err"); }
}

// ---------------- SONUÇLANDIRMA (admin) ----------------
let resolveMarketId = null;
async function openResolveModal(id) {
    resolveMarketId = id;
    const m = STATE.markets[id];
    if (!m) return;
    document.getElementById("resolve-title").textContent = m.title;
    document.getElementById("resolve-choice").innerHTML = (m.options || [])
        .map(o => `<option value="${o.key}">${escapeHtml(o.name)}</option>`).join("");
    document.getElementById("resolve-preview").innerHTML = "Kazanan seçildiğinde dağıtım önizlemesi burada görünür.";
    document.getElementById("resolve-modal").classList.add("show");
    document.getElementById("resolve-choice").onchange = previewResolve;
    previewResolve();
}
function closeResolveModal() { document.getElementById("resolve-modal").classList.remove("show"); resolveMarketId = null; }

async function gatherStakes(marketId) {
    const m = STATE.markets[marketId];
    const stakes = [];
    if (m.seed && m.seed.amount > 0) stakes.push({ uid: m.seed.uid, nickname: m.seed.nickname, optionKey: m.seed.optionKey, amount: m.seed.amount });
    const snap = await db.collection("bets").where("marketId", "==", marketId).get();
    snap.forEach(d => { const b = d.data(); stakes.push({ uid: b.uid, nickname: b.nickname, optionKey: b.optionKey, amount: b.amount }); });
    return stakes;
}

async function previewResolve() {
    const winKey = document.getElementById("resolve-choice").value;
    const stakes = await gatherStakes(resolveMarketId);
    const total = stakes.reduce((s, x) => s + x.amount, 0);
    const commission = Math.floor(total * APP_CONFIG.COMMISSION_RATE);
    const distributed = total - commission;
    const winners = stakes.filter(s => s.optionKey === winKey);
    const winPool = winners.reduce((s, x) => s + x.amount, 0);
    const el = document.getElementById("resolve-preview");
    if (winPool === 0) { el.innerHTML = `Bu seçeneğe bahis yok. Sonuçlandırılırsa havuz dağıtılmaz, sadece kapatılır.`; return; }
    el.innerHTML = `Toplam havuz: <b>${fmtNum(total)}</b> · Komisyon (%${APP_CONFIG.COMMISSION_RATE * 100}): <b>${fmtNum(commission)}</b> · Dağıtılacak: <b>${fmtNum(distributed)}</b><br>Kazanan bahis havuzu: <b>${fmtNum(winPool)}</b> · Kazanan sayısı: <b>${new Set(winners.map(w => w.uid)).size}</b>`;
}

async function confirmResolve() {
    if (!STATE.isAdmin || !resolveMarketId) return;
    const id = resolveMarketId;
    const winKey = document.getElementById("resolve-choice").value;
    const m = STATE.markets[id];
    const btn = document.getElementById("resolve-confirm");
    btn.disabled = true;
    try {
        const stakes = await gatherStakes(id);
        const total = stakes.reduce((s, x) => s + x.amount, 0);
        const commission = Math.floor(total * APP_CONFIG.COMMISSION_RATE);
        const distributed = total - commission;
        const winners = stakes.filter(s => s.optionKey === winKey);
        const winPool = winners.reduce((s, x) => s + x.amount, 0);

        // Kazanan kullanıcı bazında topla
        const byUser = {};
        winners.forEach(w => { byUser[w.uid] = (byUser[w.uid] || 0) + w.amount; });

        // Mevcut bakiyeleri oku
        const uids = Object.keys(byUser);
        const userSnaps = await Promise.all(uids.map(u => db.collection("users").doc(u).get()));
        const balances = {}; userSnaps.forEach((s, i) => balances[uids[i]] = (s.data()?.balance || 0));

        const batch = db.batch();
        const winnerName = (m.options.find(o => o.key === winKey) || {}).name || winKey;
        const payouts = {};
        uids.forEach(u => {
            const reward = winPool > 0 ? Math.floor(byUser[u] / winPool * distributed) : 0;
            payouts[u] = reward;
            batch.update(db.collection("users").doc(u), { balance: balances[u] + reward });
        });
        batch.update(db.collection("markets").doc(id), {
            resolved: true, winningOption: winKey, winningName: winnerName,
            resolvedAt: FieldValue.serverTimestamp(), resolvedBy: STATE.user.uid,
            commission, distributed,
        });
        batch.set(db.collection("auditLog").doc(), {
            type: "resolve", marketId: id, title: m.title, winningOption: winKey,
            total, commission, distributed, by: STATE.user.uid, at: FieldValue.serverTimestamp(),
        });

        // Bildirimler (katılımcılara)
        const participants = [...new Set(stakes.map(s => s.uid))];
        participants.forEach(u => {
            const reward = payouts[u] || 0;
            const won = reward > 0;
            batch.set(db.collection("notifications").doc(), {
                to: u, read: false,
                title: won ? "🎉 Kazandın!" : "😔 Kaybettin",
                message: won ? `"${m.title}" — ${fmtNum(reward)} token kazandın!` : `"${m.title}" sonuçlandı. Kazanan: ${winnerName}`,
                createdAt: FieldValue.serverTimestamp(),
            });
        });

        await batch.commit();
        toast(`Sonuçlandı: ${winnerName} kazandı.`, "ok");
        closeResolveModal();
    } catch (e) {
        console.error("Sonuçlandırma hatası:", e);
        toast("Sonuçlandırılamadı.", "err");
    } finally {
        btn.disabled = false;
    }
}

// ---------------- CANLI AKIŞ ----------------
function startLiveFeed() {
    db.collection("liveFeed").orderBy("createdAt", "desc").limit(20).onSnapshot((snap) => {
        const items = []; snap.forEach(d => items.push(d.data()));
        const el = document.getElementById("live-feed");
        if (!el) return;
        el.innerHTML = items.length ? items.map(it =>
            `<div class="feed-item"><span class="fi-dot"><i class="fa-solid fa-bolt"></i></span>
                <span>${escapeHtml(it.text)}<br><span class="muted" style="font-size:11px;">${timeAgo(it.createdAt)}</span></span></div>`).join("")
            : `<div class="empty-state">Henüz hareket yok.</div>`;
    }, (e) => console.error("Canlı akış hatası:", e));
}

async function addLiveBet(text) {
    try {
        await db.collection("liveFeed").add({
            uid: STATE.user.uid, text, createdAt: FieldValue.serverTimestamp(),
        });
    } catch (e) { console.warn("Canlı akış yazılamadı:", e); }
}

window.createMarket = createMarket;
window.addOptionInput = addOptionInput;
window.removeOptionInput = removeOptionInput;
window.refreshChoiceSelect = refreshChoiceSelect;
window.openResolveModal = openResolveModal;
window.closeResolveModal = closeResolveModal;
window.confirmResolve = confirmResolve;
window.deleteMarket = deleteMarket;
