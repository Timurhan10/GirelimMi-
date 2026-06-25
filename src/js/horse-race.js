/* ======================================================================
 * AT YARIŞI TAHMİN OYUNU — token entegrasyonlu (Merkezi Ödül Havuzu) v3
 * ----------------------------------------------------------------------
 * Bu sürüm sitenin token ekonomisine bağlanır:
 *   - Bahis oyuncunun token bakiyesinden düşülür (min 300).
 *   - Kaybeden bahsi MERKEZİ HAVUZA (gamePool/horseRace) aktarılır.
 *   - Kazanan ödülü YALNIZCA havuzdan ödenir (çarpan: 1.8x / 2.0x / 2.2x).
 *   - Her gün (24s) havuza otomatik +1000 destek (kuralla sınırlı, bir kez).
 *   - Güvenlik: kurallar "bakiye ↑ == havuz ↓" korunumunu zorlar => token üretilemez.
 *
 * Entegrasyon: dashboard'da  <div id="horse-race-game"></div>  + bu script.
 * app.js, oturum açılınca  window.HorseRaceGame.attach()  çağırır.
 * (Firebase yoksa görseller yüklenir ama oyun "giriş gerekli" der.)
 * ====================================================================== */
(function () {
  "use strict";

  /* ---------------- AYARLAR ---------------- */
  var MIN_BET = 300;
  var POOL_ID = "horseRace";
  var POOL_SEED = 1000;       // havuz başlangıç + günlük destek
  var DAILY_BONUS = 1000;

  // Kazanç çarpanları (bahis aralığına göre)
  function multiplier(bet) { return bet >= 1000 ? 2.2 : bet >= 500 ? 2.0 : 1.8; }

  // Yarış dinamiği (uzun + belirgin fark)
  var RACE_BASE = 5.6, RACE_WAVE = 0.30, RACE_WALK = 0.22;

  var HORSES = [
    { id: 1, name: "Kırmızı At", color: "#e23b3b", dark: "#9e2020" },
    { id: 2, name: "Mavi At",    color: "#2f6bd6", dark: "#1d4488" },
    { id: 3, name: "Yeşil At",   color: "#28a745", dark: "#19702f" },
    { id: 4, name: "Sarı At",    color: "#f2c200", dark: "#b38a00" },
    { id: 5, name: "Siyah At",   color: "#3a3f48", dark: "#16181d" }
  ];

  /* ---------------- SİTE BAĞLAMI ---------------- */
  var CTX = { ready: false, db: null, FieldValue: null, STATE: null, toast: null, fmt: null, poolValue: null, poolUnsub: null };
  function fmt(n) { return (CTX.fmt ? CTX.fmt(n) : String(n)); }
  function myBalance() { return (CTX.STATE && CTX.STATE.profile) ? (CTX.STATE.profile.balance || 0) : 0; }
  function isAdmin() { return !!(CTX.STATE && CTX.STATE.isAdmin); }
  function notify(msg, kind) { if (CTX.toast) CTX.toast(msg, kind); }

  /* ---------------- SCOPE'LU CSS ---------------- */
  var CSS = `
  #horse-race-game{font-family:inherit;color:#1e293b;-webkit-tap-highlight-color:transparent;}
  #horse-race-game *{box-sizing:border-box;}
  #horse-race-game .hrg-wrap{max-width:740px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:16px;box-shadow:0 10px 30px rgba(30,41,59,.10);padding:16px;overflow:hidden;}
  #horse-race-game .hrg-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;}
  #horse-race-game .hrg-title{font-size:clamp(16px,4vw,21px);font-weight:800;margin:0;}
  #horse-race-game .hrg-spacer{flex:1 1 auto;}
  #horse-race-game .hrg-badge{font-weight:800;padding:6px 12px;border-radius:50px;font-size:13px;white-space:nowrap;}
  #horse-race-game .hrg-bal{background:#fff7ed;color:#c2410c;}
  #horse-race-game .hrg-pool{background:#eef6ff;color:#1d4488;}
  #horse-race-game .hrg-sound{border:1px solid #e5e7eb;background:#fff;cursor:pointer;width:36px;height:36px;border-radius:10px;font-size:15px;}
  #horse-race-game .hrg-info{font-size:14px;min-height:22px;margin-bottom:10px;}
  #horse-race-game .hrg-info b{color:#c2410c;}
  #horse-race-game .hrg-track{position:relative;border-radius:12px;overflow:hidden;background:linear-gradient(#aaddff 0%,#cdeeff 30%,#8ed06a 30%,#4ba85b 100%);border:1px solid #cdebd8;box-shadow:inset 0 0 0 2px rgba(255,255,255,.25);}
  #horse-race-game .hrg-cloud{position:absolute;z-index:0;background:#fff;border-radius:50px;opacity:.9;}
  #horse-race-game .hrg-cloud:before,#horse-race-game .hrg-cloud:after{content:"";position:absolute;background:#fff;border-radius:50%;}
  #horse-race-game .hrg-cloud1{top:6%;left:14%;width:54px;height:15px;}
  #horse-race-game .hrg-cloud1:before{width:24px;height:24px;top:-12px;left:8px;}
  #horse-race-game .hrg-cloud1:after{width:18px;height:18px;top:-8px;left:28px;}
  #horse-race-game .hrg-cloud2{top:11%;left:62%;width:42px;height:12px;opacity:.8;}
  #horse-race-game .hrg-cloud2:before{width:18px;height:18px;top:-9px;left:6px;}
  #horse-race-game .hrg-cloud2:after{width:14px;height:14px;top:-6px;left:22px;}
  #horse-race-game .hrg-stands{position:absolute;top:0;left:0;right:0;height:14%;z-index:0;background:repeating-linear-gradient(90deg,#e06aa0 0 16px,#f3a9c8 16px 32px,#6fb6ff 32px 48px,#a9d6ff 48px 64px);opacity:.85;}
  #horse-race-game .hrg-stands:after{content:"";position:absolute;left:0;right:0;bottom:0;height:5px;background:#566;}
  #horse-race-game .hrg-grassmow{position:absolute;left:0;right:0;top:30%;bottom:0;z-index:0;pointer-events:none;background:repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 34px,rgba(0,0,0,.04) 34px 68px);}
  #horse-race-game .hrg-rail{position:absolute;left:0;right:0;top:30%;height:5px;z-index:0;background:#fff;box-shadow:0 2px 0 rgba(0,0,0,.12);}
  #horse-race-game .hrg-startline{position:absolute;left:1.5%;top:30%;bottom:0;width:3px;z-index:0;background:repeating-linear-gradient(#fff 0 7px,transparent 7px 14px);opacity:.8;}
  #horse-race-game .hrg-lane{position:relative;height:clamp(54px,12.5vw,72px);border-top:2px dashed rgba(255,255,255,.4);}
  #horse-race-game .hrg-lane:first-child{border-top:none;}
  #horse-race-game .hrg-lane.hrg-sel{background:rgba(255,255,255,.18);}
  #horse-race-game .hrg-finish{position:absolute;top:0;bottom:0;right:3%;width:12px;z-index:2;background:repeating-linear-gradient(45deg,#1c1c1c 0 6px,#fff 6px 12px);border-radius:2px;}
  #horse-race-game .hrg-finish-flag{position:absolute;top:-3px;right:calc(3% - 6px);z-index:3;font-size:18px;}
  #horse-race-game .hrg-horse{position:absolute;bottom:4px;left:1.5%;width:clamp(52px,13vw,70px);z-index:1;}
  #horse-race-game .hrg-horse .hrg-num{position:absolute;top:-12px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;color:#fff;background:rgba(0,0,0,.5);border-radius:50px;padding:0 6px;}
  #horse-race-game .hrg-horse-svg{width:100%;height:auto;display:block;filter:drop-shadow(0 2px 1px rgba(0,0,0,.28));}
  #horse-race-game .hrg-horse-svg .hrg-leg{transform-box:fill-box;transform-origin:50% 6%;}
  #horse-race-game .hrg-horse-svg .hrg-tail{transform-box:fill-box;transform-origin:92% 8%;}
  #horse-race-game .hrg-horse.hrg-run .hrg-horse-svg{animation:hrg-bob .26s ease-in-out infinite;}
  #horse-race-game .hrg-horse.hrg-run .hrg-legA{animation:hrg-galA .26s linear infinite;}
  #horse-race-game .hrg-horse.hrg-run .hrg-legB{animation:hrg-galB .26s linear infinite;}
  #horse-race-game .hrg-horse.hrg-run .hrg-tail{animation:hrg-tail .42s ease-in-out infinite;}
  #horse-race-game .hrg-horse.hrg-run:after{content:"";position:absolute;left:-7px;bottom:3px;width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.65);animation:hrg-dust .4s linear infinite;}
  @keyframes hrg-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes hrg-galA{0%{transform:rotate(-26deg)}50%{transform:rotate(24deg)}100%{transform:rotate(-26deg)}}
  @keyframes hrg-galB{0%{transform:rotate(24deg)}50%{transform:rotate(-26deg)}100%{transform:rotate(24deg)}}
  @keyframes hrg-tail{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(9deg)}}
  @keyframes hrg-dust{0%{opacity:.7;transform:scale(.5)}100%{opacity:0;transform:scale(1.5) translateX(-12px)}}
  #horse-race-game .hrg-horse.hrg-win .hrg-horse-svg{animation:hrg-cheer .5s ease infinite;}
  @keyframes hrg-cheer{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-7px) rotate(-5deg)}}
  #horse-race-game .hrg-count{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;font-size:clamp(38px,13vw,76px);font-weight:900;color:#fff;text-shadow:0 4px 16px rgba(0,0,0,.5);pointer-events:none;}
  #horse-race-game .hrg-count span{animation:hrg-pop .7s ease;}
  @keyframes hrg-pop{0%{transform:scale(.3);opacity:0}40%{transform:scale(1.18);opacity:1}100%{transform:scale(1)}}
  #horse-race-game .hrg-betrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 6px;}
  #horse-race-game .hrg-betrow label{font-size:13px;color:#64748b;font-weight:600;}
  #horse-race-game .hrg-betinput{width:120px;padding:9px 10px;border:1px solid #e5e7eb;border-radius:9px;font-size:15px;font-family:inherit;}
  #horse-race-game .hrg-chip{border:1px solid #e5e7eb;background:#fff;border-radius:50px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
  #horse-race-game .hrg-chip:hover{background:#f8fafc;}
  #horse-race-game .hrg-picker{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px;}
  #horse-race-game .hrg-pick{flex:1 1 120px;display:flex;align-items:center;gap:8px;cursor:pointer;border:2px solid #e5e7eb;background:#fff;border-radius:10px;padding:9px 10px;font-size:14px;font-weight:600;font-family:inherit;transition:border-color .15s,transform .1s;}
  #horse-race-game .hrg-pick:hover{transform:translateY(-1px);}
  #horse-race-game .hrg-pick.hrg-active{border-color:#f97316;box-shadow:0 0 0 3px rgba(249,115,22,.15);}
  #horse-race-game .hrg-pick:disabled{opacity:.55;cursor:not-allowed;}
  #horse-race-game .hrg-dot{width:18px;height:18px;border-radius:50%;flex:none;border:2px solid rgba(0,0,0,.12);}
  #horse-race-game .hrg-actions{display:flex;gap:10px;flex-wrap:wrap;}
  #horse-race-game .hrg-btn{flex:1 1 auto;border:none;cursor:pointer;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:700;font-family:inherit;color:#fff;background:#f97316;transition:filter .15s,opacity .15s;}
  #horse-race-game .hrg-btn.hrg-ghost{background:#fff;color:#1e293b;border:1px solid #e5e7eb;}
  #horse-race-game .hrg-btn:hover{filter:brightness(.96);}
  #horse-race-game .hrg-btn:disabled{opacity:.5;cursor:not-allowed;}
  #horse-race-game .hrg-result{text-align:center;font-weight:800;font-size:clamp(15px,4vw,18px);margin-top:12px;min-height:24px;}
  #horse-race-game .hrg-result.hrg-good{color:#16a34a;}
  #horse-race-game .hrg-result.hrg-bad{color:#dc2626;}
  #horse-race-game .hrg-confetti{position:absolute;top:-10px;width:8px;height:12px;z-index:6;border-radius:2px;animation:hrg-fall linear forwards;}
  @keyframes hrg-fall{to{transform:translateY(120%) rotate(540deg);opacity:.2;}}
  `;

  /* ---------------- YARDIMCILAR ---------------- */
  function injectStyle() { if (document.getElementById("hrg-style")) return; var s = document.createElement("style"); s.id = "hrg-style"; s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function leg(x, color, dark, cls) { return '<g class="hrg-leg ' + cls + '"><rect x="' + x + '" y="33" width="5.6" height="17" rx="2.8" fill="' + color + '"/><rect x="' + x + '" y="47" width="5.6" height="4.5" rx="2" fill="' + dark + '"/></g>'; }
  function horseSVG(color, dark) {
    return '<svg class="hrg-horse-svg" viewBox="0 -10 96 66" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<ellipse cx="46" cy="55" rx="34" ry="4.5" fill="rgba(0,0,0,.16)"/>' +
      '<path class="hrg-tail" d="M14 24 Q1 22 4 42 Q10 32 19 34 Z" fill="' + dark + '"/>' +
      leg(22, color, dark, "hrg-legA") + leg(31, dark, dark, "hrg-legB") + leg(58, color, color, "hrg-legB") + leg(67, dark, dark, "hrg-legA") +
      '<ellipse cx="42" cy="28" rx="26" ry="13" fill="' + color + '"/>' +
      '<ellipse cx="20" cy="27" rx="14" ry="13" fill="' + color + '"/>' +
      '<ellipse cx="62" cy="29" rx="12" ry="11" fill="' + color + '"/>' +
      '<path d="M30 17 Q42 12 54 17 L52 24 Q42 21 32 24 Z" fill="' + dark + '" opacity=".55"/>' +
      '<path d="M58 20 Q68 6 74 6 L80 13 Q70 16 66 30 Z" fill="' + color + '"/>' +
      '<path d="M72 2 Q90 0 86 16 Q80 21 70 18 Q67 8 72 2 Z" fill="' + color + '"/>' +
      '<ellipse cx="86" cy="14" rx="6" ry="4.5" fill="' + color + '"/>' +
      '<ellipse cx="89" cy="15" rx="1.4" ry="1.8" fill="' + dark + '"/>' +
      '<path d="M62 10 Q67 -1 76 1 Q70 7 67 22 Z" fill="' + dark + '"/>' +
      '<polygon points="72,1 75,-7 79,2" fill="' + color + '"/>' +
      '<circle cx="79" cy="10" r="1.9" fill="#15171b"/></svg>';
  }

  /* ---------------- TEKİL OYUN ÖRNEĞİ ---------------- */
  var GAME = null;   // tek örnek (idempotent)

  function init(root) {
    if (!root) return;
    if (GAME && GAME.root === root) return GAME;
    if (root.dataset.hrgInit === "1") return GAME;
    root.dataset.hrgInit = "1";
    injectStyle();

    var soundOn = lsGet("hrg_sound") !== "0";
    var selected = null, racing = false, rafId = null, audioCtx = null;

    root.innerHTML = "";
    var wrap = el("div", "hrg-wrap");

    var head = el("div", "hrg-head");
    head.appendChild(el("h3", "hrg-title", "🏇 At Yarışı"));
    head.appendChild(el("div", "hrg-spacer"));
    var balEl = el("div", "hrg-badge hrg-bal", "🪙 …");
    var poolEl = el("div", "hrg-badge hrg-pool", "🏦 …");
    var soundBtn = el("button", "hrg-sound"); soundBtn.type = "button"; soundBtn.title = "Ses aç/kapat";
    head.appendChild(balEl); head.appendChild(poolEl); head.appendChild(soundBtn);
    wrap.appendChild(head);

    var info = el("div", "hrg-info", "Bir at seç, bahsini yatır ve yarışı başlat!");
    wrap.appendChild(info);

    var track = el("div", "hrg-track");
    track.appendChild(el("div", "hrg-cloud hrg-cloud1"));
    track.appendChild(el("div", "hrg-cloud hrg-cloud2"));
    track.appendChild(el("div", "hrg-stands"));
    track.appendChild(el("div", "hrg-grassmow"));
    track.appendChild(el("div", "hrg-rail"));
    var lanes = [], horseEls = [];
    HORSES.forEach(function (h) {
      var lane = el("div", "hrg-lane");
      var horse = el("div", "hrg-horse");
      horse.innerHTML = '<span class="hrg-num">' + h.id + "</span>" + horseSVG(h.color, h.dark);
      lane.appendChild(horse); track.appendChild(lane);
      lanes.push(lane); horseEls.push(horse);
    });
    track.appendChild(el("div", "hrg-startline"));
    track.appendChild(el("div", "hrg-finish"));
    track.appendChild(el("div", "hrg-finish-flag", "🏁"));
    var countEl = el("div", "hrg-count"); countEl.style.display = "none"; track.appendChild(countEl);
    wrap.appendChild(track);

    /* bahis satırı */
    var betRow = el("div", "hrg-betrow");
    betRow.appendChild(el("label", null, "Bahis (min " + MIN_BET + "):"));
    var betInput = document.createElement("input");
    betInput.type = "number"; betInput.className = "hrg-betinput"; betInput.min = MIN_BET; betInput.step = "50"; betInput.value = MIN_BET; betInput.placeholder = MIN_BET;
    betRow.appendChild(betInput);
    [300, 500, 1000].forEach(function (v) { var c = el("button", "hrg-chip", fmt(v)); c.type = "button"; c.addEventListener("click", function () { betInput.value = v; }); betRow.appendChild(c); });
    var maxChip = el("button", "hrg-chip", "Tümü"); maxChip.type = "button"; maxChip.addEventListener("click", function () { betInput.value = Math.max(MIN_BET, myBalance()); }); betRow.appendChild(maxChip);
    wrap.appendChild(betRow);

    var picker = el("div", "hrg-picker"); var pickBtns = [];
    HORSES.forEach(function (h, i) {
      var b = el("button", "hrg-pick"); b.type = "button";
      b.innerHTML = '<span class="hrg-dot" style="background:' + h.color + '"></span>' + h.name;
      b.addEventListener("click", function () { selectHorse(i); });
      picker.appendChild(b); pickBtns.push(b);
    });
    wrap.appendChild(picker);

    var actions = el("div", "hrg-actions");
    var startBtn = el("button", "hrg-btn", "Yarışı Başlat 🚀"); startBtn.type = "button";
    var replayBtn = el("button", "hrg-btn hrg-ghost", "Yeni Yarış 🔄"); replayBtn.type = "button"; replayBtn.style.display = "none";
    actions.appendChild(startBtn); actions.appendChild(replayBtn); wrap.appendChild(actions);

    var result = el("div", "hrg-result"); wrap.appendChild(result);
    root.appendChild(wrap);

    /* ---- render ---- */
    function renderBadges() {
      balEl.textContent = "🪙 " + (CTX.ready ? (isAdmin() ? "∞" : fmt(myBalance())) : "…") + " token";
      poolEl.textContent = "🏦 Havuz: " + (CTX.poolValue == null ? "…" : fmt(CTX.poolValue));
    }
    function renderSound() { soundBtn.textContent = soundOn ? "🔊" : "🔇"; }
    function renderSelected() {
      pickBtns.forEach(function (b, i) { b.classList.toggle("hrg-active", i === selected); });
      lanes.forEach(function (l, i) { l.classList.toggle("hrg-sel", i === selected); });
      if (selected != null) info.innerHTML = "Seçilen: <b>" + HORSES[selected].name + "</b>";
      refreshControls();
    }
    function refreshControls() {
      startBtn.disabled = !(CTX.ready && !racing && selected != null && (isAdmin() || myBalance() >= MIN_BET));
      betInput.disabled = racing; pickBtns.forEach(function (b) { b.disabled = racing; });
      if (!CTX.ready) info.textContent = "Oyun yükleniyor… (siteye giriş gerekli)";
      else if (!isAdmin() && myBalance() < MIN_BET && selected == null) info.textContent = "Oynamak için en az " + MIN_BET + " token gerekir.";
    }
    function setHorseX(i, pct) { horseEls[i].style.left = (1.5 + pct * 0.86) + "%"; }

    function selectHorse(i) { if (racing) return; selected = i; renderSelected(); beep(520, 0.08, "triangle", 0.05); }

    function readBet() {
      var b = parseInt(betInput.value, 10);
      if (isNaN(b)) b = 0;
      return b;
    }

    /* ---- ses ---- */
    function beep(freq, dur, type, vol) {
      if (!soundOn) return;
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = type || "square"; o.frequency.value = freq;
        var t = audioCtx.currentTime; g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + dur);
      } catch (e) {}
    }
    function winJingle() { [660, 880, 1046, 1318].forEach(function (f, i) { setTimeout(function () { beep(f, 0.16, "square", 0.06); }, i * 120); }); }
    function loseTone() { beep(200, 0.4, "sawtooth", 0.05); }

    /* ---- yarış ---- */
    var positions = [0, 0, 0, 0, 0], rp = [];
    var pendingBet = 0;
    function initRaceParams() { rp = HORSES.map(function () { return { phase: Math.random() * Math.PI * 2, freq: 0.55 + Math.random() * 0.7, walk: 0 }; }); }

    function resetRace() {
      if (rafId) cancelAnimationFrame(rafId), (rafId = null);
      positions = [0, 0, 0, 0, 0];
      horseEls.forEach(function (h, i) { h.classList.remove("hrg-run", "hrg-win"); setHorseX(i, 0); });
      result.textContent = ""; result.className = "hrg-result";
      countEl.style.display = "none"; countEl.innerHTML = ""; clearConfetti();
    }

    function startRace() {
      if (racing || selected == null) return;
      if (!CTX.ready) { notify("Oyun henüz yüklenmedi.", "err"); return; }
      var bet = readBet();
      if (bet < MIN_BET) { notify("En az " + MIN_BET + " token bahis yapmalısın.", "err"); betInput.value = MIN_BET; return; }
      if (!isAdmin() && bet > myBalance()) { notify("Bakiyenden fazla bahis yapamazsın.", "err"); return; }
      if (!isAdmin() && myBalance() < MIN_BET) { notify("Bakiyen " + MIN_BET + " token'ın altında.", "err"); return; }
      pendingBet = bet;
      racing = true; resetRace(); refreshControls();
      startBtn.disabled = true; replayBtn.style.display = "none";
      var seq = ["3", "2", "1", "BAŞLA"]; countEl.style.display = "flex"; var step = 0;
      (function tick() {
        if (step < seq.length) { countEl.innerHTML = "<span>" + seq[step] + "</span>"; beep(step === seq.length - 1 ? 880 : 440, 0.12, "square", 0.06); step++; setTimeout(tick, 700); }
        else { countEl.style.display = "none"; runLoop(); }
      })();
    }

    function runLoop() {
      horseEls.forEach(function (h) { h.classList.add("hrg-run"); });
      initRaceParams();
      var last = performance.now(), t = 0;
      (function frame(now) {
        var dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        var winner = -1;
        for (var i = 0; i < 5; i++) {
          if (positions[i] >= 100) continue;
          rp[i].walk += (Math.random() - 0.5) * 0.7 * dt;
          if (rp[i].walk > RACE_WALK) rp[i].walk = RACE_WALK; if (rp[i].walk < -RACE_WALK) rp[i].walk = -RACE_WALK;
          var speed = RACE_BASE * (1 + RACE_WAVE * Math.sin(t * rp[i].freq + rp[i].phase) + rp[i].walk);
          if (speed < 1) speed = 1;
          positions[i] += speed * dt;
          if (positions[i] >= 100) { positions[i] = 100; if (winner < 0) winner = i; }
          setHorseX(i, positions[i]);
        }
        if (winner >= 0) { finishRace(winner); return; }
        rafId = requestAnimationFrame(frame);
      })(last);
    }

    async function finishRace(winnerIdx) {
      if (rafId) cancelAnimationFrame(rafId), (rafId = null);
      horseEls.forEach(function (h) { h.classList.remove("hrg-run"); });
      horseEls[winnerIdx].classList.add("hrg-win");
      var won = winnerIdx === selected;

      try {
        var out = await settleBet(won, pendingBet);
        if (won) {
          result.className = "hrg-result hrg-good";
          result.textContent = out.capped
            ? "🎉 Kazandın! Havuz yetersizdi, " + fmt(out.paid) + " token ödendi."
            : "🎉 Tebrikler! +" + fmt(out.paid) + " token kazandın.";
          winJingle(); confetti();
        } else {
          result.className = "hrg-result hrg-bad";
          result.textContent = "😔 Kaybettin! " + fmt(out.lost) + " token ödül havuzuna aktarıldı.";
          loseTone();
        }
      } catch (e) {
        console.error("At yarışı ödeme hatası:", e);
        result.className = "hrg-result hrg-bad";
        result.textContent = "Ödeme işlenemedi: " + (e.message || e.code || "");
        notify("İşlenemedi: " + (e.message || e.code || ""), "err");
      }

      racing = false;
      replayBtn.style.display = ""; startBtn.disabled = true;
      renderBadges(); refreshControls();
    }

    /* ---- konfeti ---- */
    function confetti() {
      var colors = ["#f97316", "#16a34a", "#2f6bd6", "#e23b3b", "#f2c200", "#fff"];
      for (var i = 0; i < 50; i++) { var c = el("div", "hrg-confetti"); c.style.left = Math.random() * 100 + "%"; c.style.background = colors[i % colors.length]; c.style.animationDuration = (1.4 + Math.random() * 1.4) + "s"; c.style.animationDelay = (Math.random() * 0.3) + "s"; track.appendChild(c); }
      setTimeout(clearConfetti, 3200);
    }
    function clearConfetti() { var l = track.querySelectorAll(".hrg-confetti"); for (var i = 0; i < l.length; i++) l[i].remove(); }

    /* ---- olaylar ---- */
    startBtn.addEventListener("click", startRace);
    replayBtn.addEventListener("click", function () { replayBtn.style.display = "none"; resetRace(); refreshControls(); });
    soundBtn.addEventListener("click", function () { soundOn = !soundOn; lsSet("hrg_sound", soundOn ? "1" : "0"); renderSound(); if (soundOn) beep(660, 0.1, "triangle", 0.05); });

    renderBadges(); renderSound(); refreshControls();

    GAME = { root: root, renderBadges: renderBadges, refreshControls: refreshControls };
    return GAME;
  }

  /* ---------------- TOKEN İŞLEMLERİ (Firebase) ---------------- */
  // Bahis sonucu: kazanç havuzdan ödenir, kayıp havuza eklenir. Atomik.
  async function settleBet(won, bet) {
    if (!CTX.ready) throw new Error("Bağlantı yok.");
    var db = CTX.db, FieldValue = CTX.FieldValue;
    var uid = CTX.STATE.user.uid;
    var userRef = db.collection("users").doc(uid);
    var poolRef = db.collection("gamePool").doc(POOL_ID);
    var outcome = {};
    await db.runTransaction(async function (tx) {
      var uSnap = await tx.get(userRef);
      var pSnap = await tx.get(poolRef);
      var bal = (uSnap.data() && uSnap.data().balance) || 0;
      var pool = (pSnap.exists && pSnap.data().value) || 0;
      if (won) {
        var payout = Math.floor(bet * multiplier(bet));
        var paid = Math.min(payout, pool);          // havuz yetersizse mevcut kadar
        if (paid < 0) paid = 0;
        tx.update(userRef, { balance: bal + paid });
        tx.update(poolRef, { value: pool - paid });
        outcome = { paid: paid, payout: payout, capped: paid < payout };
      } else {
        var lost = Math.min(bet, bal);              // negatif bakiye oluşamaz
        tx.update(userRef, { balance: bal - lost });
        tx.update(poolRef, { value: pool + lost });
        outcome = { lost: lost };
      }
    });
    return outcome;
  }

  // Havuzu kur (yoksa) + günlük +1000 desteğini uygula (24 saatte bir).
  async function ensurePoolAndDaily() {
    if (!CTX.ready) return;
    var db = CTX.db, FieldValue = CTX.FieldValue;
    var poolRef = db.collection("gamePool").doc(POOL_ID);
    try {
      await db.runTransaction(async function (tx) {
        var s = await tx.get(poolRef);
        if (!s.exists) {
          tx.set(poolRef, { value: POOL_SEED, lastDaily: FieldValue.serverTimestamp() });
          return;
        }
        var d = s.data();
        var last = d.lastDaily && d.lastDaily.toDate ? d.lastDaily.toDate().getTime() : 0;
        if (Date.now() - last >= 24 * 3600 * 1000) {
          tx.update(poolRef, { value: (d.value || 0) + DAILY_BONUS, lastDaily: FieldValue.serverTimestamp() });
        }
      });
    } catch (e) { console.warn("Havuz/günlük destek:", e); }
  }

  function listenPool() {
    if (!CTX.ready) return;
    if (CTX.poolUnsub) CTX.poolUnsub();
    CTX.poolUnsub = CTX.db.collection("gamePool").doc(POOL_ID).onSnapshot(function (s) {
      CTX.poolValue = s.exists ? (s.data().value || 0) : 0;
      if (GAME) GAME.renderBadges();
    }, function (e) { console.warn("Havuz dinleme:", e); });
  }

  /* ---------------- localStorage (yalnızca ses tercihi) ---------------- */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------------- DIŞ API ---------------- */
  // Siteden (app.js) oturum açılınca çağrılır: Firebase bağlamını bağlar.
  function attach() {
    var node = document.getElementById("horse-race-game");
    if (node) init(node);
    // db/STATE/FieldValue çıplak global (const/let) — window üzerinden değil, typeof ile güvenli eriş.
    if (typeof db === "undefined" || typeof STATE === "undefined" || !STATE || !STATE.user) return false;
    CTX.db = db;
    CTX.FieldValue = (typeof FieldValue !== "undefined") ? FieldValue : null;
    CTX.STATE = STATE;
    CTX.toast = (typeof toast !== "undefined") ? toast : null;
    CTX.fmt = (typeof fmtNum !== "undefined") ? fmtNum : null;
    CTX.ready = true;
    ensurePoolAndDaily();
    listenPool();
    if (GAME) { GAME.renderBadges(); GAME.refreshControls(); }
    // bakiye canlı güncellensin (app.js STATE.profile.balance'ı tazeler)
    if (!CTX._balTick) CTX._balTick = setInterval(function () { if (GAME) GAME.renderBadges(); }, 1500);
    return true;
  }

  function boot() { var node = document.getElementById("horse-race-game"); if (node) init(node); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.HorseRaceGame = { init: init, attach: attach };
})();
