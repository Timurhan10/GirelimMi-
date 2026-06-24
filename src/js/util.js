// ======================================================
// GirelimMi? — YARDIMCI FONKSİYONLAR
// ======================================================

// Toast bildirimi
function toast(message, type = "info", ms = 3200) {
    let wrap = document.querySelector(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "0.3s"; setTimeout(() => el.remove(), 300); }, ms);
}

function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text == null ? "" : String(text);
    return d.innerHTML;
}

function fmtNum(n) {
    return Number(n || 0).toLocaleString("tr-TR");
}

function initials(nameOrEmail) {
    if (!nameOrEmail) return "?";
    const s = String(nameOrEmail).trim();
    return s.substring(0, 1).toUpperCase();
}

function maskEmail(email) {
    if (!email || !email.includes("@")) return email || "";
    const [name, domain] = email.split("@");
    const head = name.length <= 4 ? name.substring(0, 1) : name.substring(0, 4);
    return head + "***@" + domain;
}

// Firestore Timestamp / Date / millis -> Date
function toDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    if (typeof v.toDate === "function") return v.toDate();
    if (v.seconds != null) return new Date(v.seconds * 1000);
    const d = new Date(v);
    return isNaN(d) ? null : d;
}

function fmtDateTime(v) {
    const d = toDate(v);
    if (!d) return "-";
    return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(v) {
    const d = toDate(v);
    if (!d) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "az önce";
    if (sec < 3600) return Math.floor(sec / 60) + " dk önce";
    if (sec < 86400) return Math.floor(sec / 3600) + " sa önce";
    return Math.floor(sec / 86400) + " gün önce";
}

// Market durumunu zamana göre türet: yaklasan | aktif | kilitli | sonuclandi
function marketStatus(market, now = Date.now()) {
    if (market.resolved) return "sonuclandi";
    const start = toDate(market.startsAt)?.getTime() ?? 0;
    const close = toDate(market.bettingClosesAt)?.getTime() ?? 0;
    if (now < start) return "yaklasan";
    if (now < close) return "aktif";
    return "kilitli";
}

const STATUS_LABEL = { yaklasan: "Yaklaşan", aktif: "Bahis Açık", kilitli: "Kilitli", sonuclandi: "Sonuçlandı" };

function uid(prefix = "id") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Toplam havuzu ve seçenek yüzdelerini hesapla
function poolStats(options) {
    const total = (options || []).reduce((s, o) => s + (o.pool || 0), 0);
    return { total, pct: (o) => total > 0 ? Math.round((o.pool || 0) / total * 100) : 0 };
}
