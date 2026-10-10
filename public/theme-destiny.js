/* Pulse theme runtime. Additive only: scene markup, theme switch, tab-switch activation, parallax.
   Delete this file (and its <script>) together with theme-destiny.css to revert. */
(function () {
  'use strict';
  var R = document.documentElement;
  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  var mqRM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  var n1 = function (n) { return Math.round(n * 10) / 10; };

  /* ======================= VAULT OF GLASS SCENE ======================= */
  function vogScene() {
    var i, s;
    var defs = '<defs>' +
      '<radialGradient id="vcore"><stop offset="0" stop-color="#BFF4F0" stop-opacity=".9"/><stop offset=".5" stop-color="#BFF4F0" stop-opacity=".25"/><stop offset="1" stop-color="#BFF4F0" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vorb"><stop offset="0" stop-color="#ECEAE4" stop-opacity="1"/><stop offset=".25" stop-color="#ECEAE4" stop-opacity=".9"/><stop offset=".26" stop-color="#ECEAE4" stop-opacity=".35"/><stop offset="1" stop-color="#ECEAE4" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vred"><stop offset="0" stop-color="#E2412E" stop-opacity=".55"/><stop offset="1" stop-color="#E2412E" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="vfl"><stop offset="0" stop-color="#BFF4F0" stop-opacity=".35"/><stop offset="1" stop-color="#BFF4F0" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="vgg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFF4F0" stop-opacity="0"/><stop offset=".5" stop-color="#BFF4F0" stop-opacity=".55"/><stop offset="1" stop-color="#BFF4F0" stop-opacity="0"/></linearGradient>' +
      '<clipPath id="vgc"><ellipse rx="54" ry="132"/></clipPath></defs>';

    /* vault door: three separately rotating rings + pulsing ticks + core (all 6-fold or 12-fold symmetric) */
    var outer = '<circle r="330"/><circle r="312"/>';
    for (i = 0; i < 12; i++) outer += '<path transform="rotate(' + i * 30 + ')" d="M-9 -330L0 -356L9 -330"/>';
    var mid = '<circle r="250"/><circle r="236" stroke-dasharray="3 9"/>';
    for (i = 0; i < 6; i++) mid += '<path transform="rotate(' + i * 60 + ')" d="M-14 -250V-210H14V-250M0 -210V-190"/>';
    var inn = '<circle r="160"/><path d="M0 -130L112.6 -65V65L0 130L-112.6 65V-65Z"/>';
    for (i = 0; i < 6; i++) inn += '<path transform="rotate(' + i * 60 + ')" d="M0 -160V-130"/>';
    var ticks = '';
    for (i = 0; i < 72; i++) ticks += '<path transform="rotate(' + i * 5 + ')" d="M0 -' + (i % 6 ? 276 : 288) + 'V-300"/>';
    var door = '<g transform="translate(800 380)"><g class="vault-door">' +
      '<g class="vault-ring vault-ring--outer">' + outer + '</g>' +
      '<g class="vault-ticks">' + ticks + '</g>' +
      '<g class="vault-ring vault-ring--middle">' + mid + '</g>' +
      '<g class="vault-ring vault-ring--inner">' + inn + '</g>' +
      '<circle r="90"/></g>' +
      '<circle class="door-core" r="120" fill="url(#vcore)"/></g>';

    /* bronze power lines (right-angle + 45 degree turns) with travelling pulses */
    var L = [
      'M0 700H180L240 640H380L430 590H500L560 520', 'M0 480H120L170 430H330L380 380H470', 'M0 250H200L260 310H400L440 350H480',
      'M1600 700H1400L1340 640H1160L1100 590H1040L980 520', 'M1600 300H1450L1400 350H1180L1130 400H1100', 'M1600 560H1500L1440 500H1260L1210 450H1130'
    ];
    var lines = '';
    for (i = 0; i < L.length; i++) {
      lines += '<path class="pl" d="' + L[i] + '"/><path class="pp" pathLength="100" d="' + L[i] + '" style="animation-duration:' + (3 + (i * 7 % 4) * 0.9) + 's;animation-delay:-' + (i * 1.3) + 's"/>';
    }

    /* time gate */
    var motes = '';
    for (i = 0; i < 7; i++) {
      var side = i % 2 ? 1 : -1;
      motes += '<circle class="mote" r="2" cy="' + (-100 + i * 32) + '" style="--dx:' + side * (150 + i * 14) + 'px;--dy:' + (i * 7 - 20) + 'px;animation-duration:' + (5 + i * 0.7) + 's;animation-delay:-' + i * 1.1 + 's"/>';
    }
    var gate = '<g transform="translate(1325 500)"><ellipse class="gate-fill" rx="54" ry="132"/>' +
      '<g clip-path="url(#vgc)"><rect class="gate-shim" x="-54" y="-132" width="108" height="264" fill="url(#vgg)"/></g>' +
      '<ellipse class="gate-frame" rx="62" ry="140"/><ellipse class="gate-frame" rx="54" ry="132"/>' + motes + '</g>';

    /* seven oracles in an arc above the door */
    var orcs = '';
    for (i = 0; i < 7; i++) {
      orcs += '<g transform="translate(' + (560 + i * 80) + ' ' + (48 + (i - 3) * (i - 3) * 7) + ')"><g class="bob" style="animation-delay:-' + i * 1.4 + 's"><g class="orc o' + i + '" style="--i:' + i + '"><circle r="20" fill="url(#vorb)"/></g></g></g>';
    }

    var far = '<div class="sl far" style="--k:-2"><div class="vfog"></div><div class="fogb b1"></div><div class="fogb b2"></div><div class="fogb b3"></div>' +
      '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + defs + door + lines + gate + orcs + '</svg></div>';

    /* mid layer: pillars, platforms, watchers */
    function pillar(x, w, top, bot, fl) {
      var p = '<g class="pil"><rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + (bot - top) + '"/>';
      for (var y = top + 56; y < bot - 20; y += 64) p += '<path d="M' + x + ' ' + y + 'H' + (x + w) + '"/>';
      var cx = x + w / 2;
      p += (x % 2 ? '<path d="M' + cx + ' ' + (top + 18) + 'l11 19h-22z"/>' : '<path d="M' + (cx - 9) + ' ' + (top + 20) + 'h18l9 15-9 15h-18l-9-15z"/>');
      p += '<path class="trim" d="M' + x + ' ' + top + 'V' + bot + 'M' + (x + w) + ' ' + top + 'V' + bot + '"/>';
      if (fl) p += '<ellipse cx="' + cx + '" cy="' + (bot + 12) + '" rx="' + w * 1.5 + '" ry="14" fill="url(#vfl)" stroke="none"/>';
      return p + '</g>';
    }
    function plat(x, y, sc, cls, d) {
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><g class="plat ' + cls + '" style="animation-duration:' + d + 's"><path class="pt" d="M-90 0L-60 -18H60L90 0Z"/><path class="ps" d="M-90 0H90L70 22H-70Z"/></g></g>';
    }
    function watch(x, y, sc, dur, delay, c) {
      return '<g transform="translate(' + x + ' ' + y + ') scale(' + sc + ')"><g class="watch" style="animation-duration:' + dur + 's;animation-delay:-' + delay + 's;--c:' + c + 'px"><circle r="15" fill="url(#vred)"/><circle r="3.4" fill="#E2412E"/><path d="M-10 0H10" stroke="#E2412E" stroke-width=".9" opacity=".6"/></g></g>';
    }
    var mid = '<div class="sl mid" style="--k:-6"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      watch(250, 560, 0.9, 31, 4, 26) + watch(1190, 470, 1, 37, 13, -26) + watch(420, 520, 0.8, 27, 9, 22) + watch(680, 250, 0.6, 40, 20, 14) +
      pillar(300, 70, 150, 900, 0) + pillar(470, 56, 60, 900, 0) + pillar(1090, 60, 100, 700, 1) + pillar(1230, 80, 230, 900, 0) + pillar(150, 50, 320, 640, 1) +
      plat(620, 690, 0.55, 'p1', 11) + plat(1000, 640, 0.7, 'p2', 13) + '</svg></div>';

    var rad = '';
    for (i = 0; i < 12; i++) {
      rad += '<i class="rad" style="left:' + (6 + i * 8.1) + '%;--dx:' + ((i % 2 ? 1 : -1) * (30 + i * 6)) + 'px;animation-duration:' + (14 + i * 0.9) + 's;animation-delay:-' + (i * 2.3) + 's"></i>';
    }
    var near = '<div class="sl near" style="--k:-10"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + plat(420, 800, 1, 'p3', 9) + '</svg>' + rad + '</div>';

    var fg = '<div class="sl fg" style="--k:-16"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="vrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C7A45" stop-opacity=".1"/><stop offset=".5" stop-color="#9C7A45" stop-opacity=".6"/><stop offset="1" stop-color="#9C7A45" stop-opacity=".1"/></linearGradient></defs>' +
      '<g class="fgp"><rect x="-40" y="-20" width="150" height="960"/><path d="M110 -20V940" stroke="url(#vrim)" stroke-width="2"/></g>' +
      '<g class="fgp"><rect x="1490" y="-20" width="150" height="960"/><path d="M1490 -20V940" stroke="url(#vrim)" stroke-width="2"/></g></svg></div>';

    return '<div class="vog-scene" aria-hidden="true">' + far + mid + near + fg + '<div class="glitch"></div></div>';
  }

  /* ======================= CROTA'S END SCENE ======================= */
  function crotaScene() {
    var i;
    var defs = '<defs>' +
      '<radialGradient id="cearth" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#dfeaff" stop-opacity=".9"/><stop offset=".6" stop-color="#6d8bb8" stop-opacity=".6"/><stop offset="1" stop-color="#1a2438" stop-opacity=".4"/></radialGradient>' +
      '<radialGradient id="cglow"><stop offset="0" stop-color="#9BE35A" stop-opacity=".45"/><stop offset="1" stop-color="#9BE35A" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="ceye"><stop offset="0" stop-color="#9BE35A" stop-opacity=".6"/><stop offset="1" stop-color="#9BE35A" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="cshaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb4cc" stop-opacity=".9"/><stop offset="1" stop-color="#9fb4cc" stop-opacity="0"/></linearGradient>' +
      '<linearGradient id="crim" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#9BE35A" stop-opacity=".6"/><stop offset=".6" stop-color="#9BE35A" stop-opacity="0"/></linearGradient></defs>';

    var stars = '';
    var sp = [[240, 90], [520, 60], [980, 40], [1420, 110], [1530, 260]];
    for (i = 0; i < sp.length; i++) stars += '<circle class="star" cx="' + sp[i][0] + '" cy="' + sp[i][1] + '" r="1.6" style="animation-duration:' + (3 + i) + 's;animation-delay:-' + i + 's"/>';
    var sky = stars +
      '<polygon class="shaft" points="1050,0 1330,0 1010,900 520,900" fill="url(#cshaft)"/>' +
      '<circle cx="1260" cy="130" r="30" fill="url(#cearth)" opacity=".28"/><path d="M1235 112A30 30 0 0 1 1278 120" fill="none" stroke="#dfeaff" stroke-width="2" opacity=".45"/>';

    /* rune arch: invented jagged marks, never copied from any game */
    var RN = ['M-8 -12L2 -2L-6 4L6 14', 'M-6 -12V12M-6 0L8 -10M-6 2L6 12', 'M0 -13L9 -2L0 3L8 13', 'M-8 -10L8 -6L-4 2L8 12', 'M-7 12L0 -12L7 12M-4 3H5', 'M6 -12Q-8 -6 -2 0Q8 6 -6 13'];
    var runes = '';
    for (i = 0; i < 12; i++) {
      var a = i * 30 * Math.PI / 180;
      runes += '<path class="rune" style="--i:' + i + ';animation-delay:-' + (i * 1.1) + 's" transform="translate(' + n1(800 + 150 * Math.cos(a)) + ' ' + n1(330 + 150 * Math.sin(a)) + ') rotate(' + (i * 30 + 90) + ')" d="' + RN[i % 6] + '"/>';
    }
    var arch = '<g class="arch"><path d="M520 900V420Q520 150 800 24Q1080 150 1080 420V900"/><path d="M570 900V430Q570 190 800 70Q1030 190 1030 430V900"/><path d="M620 900V440Q620 230 800 118Q980 230 980 440V900"/>' +
      '<path d="M520 420l-16-22 16 8M1080 420l16-22-16 8M520 600l-18-14 18 4M1080 600l18-14-18 4M800 24l-6-20 12 0z"/>' +
      '<path d="M770 285A60 60 0 1 0 770 375A46 46 0 1 1 770 285Z"/></g>' +
      '<g class="runes" fill="none">' + runes + '</g>';

    function spire(x, w, top) {
      var p = '<g class="spire"><path d="M' + x + ' 900V' + (top + 60) + 'L' + (x + w * 0.2) + ' ' + top + 'L' + (x + w * 0.35) + ' ' + (top + 30) + 'L' + (x + w * 0.5) + ' ' + (top - 40) + 'L' + (x + w * 0.65) + ' ' + (top + 30) + 'L' + (x + w * 0.8) + ' ' + top + 'L' + (x + w) + ' ' + (top + 60) + 'V900Z"/>';
      for (var y = top + 90; y < 880; y += 52) p += '<path class="rib" d="M' + x + ' ' + y + 'Q' + (x + w / 2) + ' ' + (y + 14) + ' ' + (x + w) + ' ' + y + '"/>';
      return p + '</g>';
    }
    var drips = '';
    [[560, 40], [700, 60], [900, 50], [1020, 70], [360, 80], [1180, 60]].forEach(function (d) {
      drips += '<path class="drip" d="M' + d[0] + ' 0H' + (d[0] + 16) + 'L' + (d[0] + 9) + ' ' + (60 + d[1]) + 'Z"/>';
    });
    function brazier(x, y) {
      return '<g class="brazier" transform="translate(' + x + ' ' + y + ')"><circle r="50" fill="url(#cglow)"/><path class="bowl" d="M-18 0H18L11 15H-11Z"/>' +
        '<path class="fl" style="animation-duration:.9s" d="M0 -3C-9 -14 -4 -26 0 -34C4 -26 9 -14 0 -3Z"/>' +
        '<g transform="translate(-9 3) scale(.7)"><path class="fl" style="animation-duration:1.15s;animation-delay:-.3s" d="M0 -3C-9 -14 -4 -26 0 -34C4 -26 9 -14 0 -3Z"/></g>' +
        '<g transform="translate(9 3) scale(.7)"><path class="fl" style="animation-duration:1.4s;animation-delay:-.6s" d="M0 -3C-9 -14 -4 -26 0 -34C4 -26 9 -14 0 -3Z"/></g></g>';
    }
    function candles(x, y, d) {
      var c = '<g class="candles" transform="translate(' + x + ' ' + y + ')">';
      for (var k = 0; k < 3; k++) {
        c += '<rect x="' + (k * 9 - 9) + '" y="' + (-8 - k % 2 * 5) + '" width="3" height="' + (8 + k % 2 * 5) + '" fill="#a79c7e" opacity=".5"/><ellipse class="cf" cx="' + (k * 9 - 7.5) + '" cy="' + (-11 - k % 2 * 5) + '" rx="1.6" ry="3" style="animation-duration:' + (d + k * 0.35) + 's;animation-delay:-' + k * 0.2 + 's"/>';
      }
      return c + '</g>';
    }
    function eyes(x, y, sc, tilt, dur, delay) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + tilt + ') scale(' + sc + ')"><g class="eyes" style="animation-duration:' + dur + 's;animation-delay:-' + delay + 's"><circle cx="-12" r="9" fill="url(#ceye)"/><circle cx="12" r="9" fill="url(#ceye)"/><ellipse cx="-12" rx="4" ry="2.2" fill="#9BE35A"/><ellipse cx="12" rx="4" ry="2.2" fill="#9BE35A"/></g></g>';
    }
    function chain(x, len, d, delay) {
      return '<g transform="translate(' + x + ' 0)"><g class="chain" style="animation-duration:' + d + 's;animation-delay:-' + delay + 's"><path d="M0 0V' + len + '"/></g></g>';
    }
    var seg = '', segg = '';
    for (i = 0; i < 9; i++) {
      if (i === 3 || i === 6) continue;
      var x = -10 + i * 128, op = n1(1 - i * 0.09);
      seg += '<path class="bseg" opacity="' + op + '" d="M' + x + ' 826L' + (x + 14) + ' 812H' + (x + 124) + 'L' + (x + 112) + ' 826Z"/>';
      segg += '<path class="sg" style="--i:' + i + '" d="M' + x + ' 826L' + (x + 14) + ' 812H' + (x + 124) + 'L' + (x + 112) + ' 826Z"/>';
    }

    var far = '<div class="sl far" style="--k:-2"><div class="cglow"></div><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + defs + sky + arch + '</svg></div>';
    var mid = '<div class="sl mid" style="--k:-6"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      eyes(700, 300, 0.5, -4, 33, 8) + eyes(1010, 330, 0.55, 5, 41, 22) + eyes(330, 520, 0.9, -7, 29, 3) + eyes(1190, 600, 1, 6, 37, 14) +
      spire(250, 80, 160) + spire(400, 64, 70) + spire(1110, 64, 90) + spire(1250, 80, 180) + spire(1400, 52, 300) + drips +
      brazier(432, 560) + brazier(1142, 540) + candles(360, 640, 0.8) + candles(1190, 610, 1) + candles(300, 720, 1.3) + '</svg></div>';
    var near = '<div class="sl near" style="--k:-10"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + seg + segg + eyes(170, 740, 1.4, -5, 45, 30) + chain(200, 300, 10, 0) + chain(1000, 260, 12, 3) + chain(1400, 360, 11, 6) + '</svg>' +
      '<div class="pit"></div><div class="chant"></div><div class="tendril t1"></div><div class="tendril t2"></div><div class="tendril t3"></div><div class="tendril t4"></div>';
    var em = '';
    for (i = 0; i < 14; i++) {
      em += '<i class="ember' + (i % 3 ? ' g' : '') + '" style="left:' + (30 + (i * 37 % 40)) + '%;--dx:' + ((i % 2 ? 1 : -1) * (20 + i * 5)) + 'px;animation-duration:' + (12 + (i * 7 % 11)) + 's;animation-delay:-' + (i * 1.7) + 's"></i>';
    }
    near += em + '</div>';
    var fg = '<div class="sl fg" style="--k:-16"><svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<g class="cfg"><path d="M-40 -20H120L100 120L132 260L90 420L126 600L96 940H-40Z"/><path d="M120 -20L100 120L132 260L90 420L126 600L96 940" fill="none" stroke="url(#crim)" stroke-width="2"/></g>' +
      '<g class="cfg" transform="translate(1600 0) scale(-1 1)"><path d="M-40 -20H120L100 120L132 260L90 420L126 600L96 940H-40Z"/><path d="M120 -20L100 120L132 260L90 420L126 600L96 940" fill="none" stroke="url(#crim)" stroke-width="2"/></g></svg></div>';
    return '<div class="crota-scene" aria-hidden="true">' + far + mid + near + fg + '<div class="vig"></div><div class="surge"></div></div>';
  }

  /* ======================= INSERT SCENES ======================= */
  function mount() {
    if (q('.vog-scene')) return;
    var host = document.createElement('div');
    host.innerHTML = vogScene() + crotaScene();
    while (host.firstChild) document.body.insertBefore(host.firstChild, document.body.firstChild);
  }

  /* ======================= THEME ======================= */
  function current() { return R.getAttribute('data-theme') === 'crota' ? 'crota' : 'vog'; }
  function sync() {
    var t = current();
    qa('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme-set') === t ? 'true' : 'false'); });
  }
  function setTheme(t) {
    if (t === 'crota') R.setAttribute('data-theme', 'crota'); else R.removeAttribute('data-theme');
    try { localStorage.setItem('pulse_theme', t); } catch (e) { /* storage may be blocked */ }
    sync();
    activate();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('#themeBtn,[data-theme-set]') : null;
    if (!b) return;
    setTheme(b.id === 'themeBtn' ? (current() === 'crota' ? 'vog' : 'crota') : b.getAttribute('data-theme-set'));
  });

  /* ======================= TAB-SWITCH ACTIVATION ======================= */
  var timer = null;
  function activate() {
    var crota = current() === 'crota';
    var el = q(crota ? '.crota-scene' : '.vog-scene');
    if (!el) return;
    var cls = crota ? 'is-awakening' : 'is-activating';
    qa('.vog-scene,.crota-scene').forEach(function (s) { s.classList.remove('is-activating', 'is-awakening'); });
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(timer);
    var done = function () { el.classList.remove(cls); clearTimeout(timer); el.removeEventListener('animationend', onEnd); };
    var onEnd = function (ev) { if (ev.target && ev.target.matches && ev.target.matches(crota ? '.pit' : '.vault-ring--outer')) done(); };
    el.addEventListener('animationend', onEnd);
    timer = setTimeout(done, 2000);
  }
  function bindNav() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    nav.addEventListener('click', function (e) {   /* capture: runs before the page's own tab handler */
      var b = e.target.closest ? e.target.closest('button') : null;
      if (!b || !nav.contains(b)) return;
      if (b.getAttribute('aria-pressed') === 'true' || b.getAttribute('data-v') === 'editor') return;
      activate();
    }, true);
  }

  /* ======================= PARALLAX (desktop only) ======================= */
  function bindParallax() {
    if (mqRM.matches || !window.matchMedia || !matchMedia('(hover: hover) and (min-width: 721px)').matches) return;
    var raf = 0, x = 0, y = 0;
    document.addEventListener('pointermove', function (e) {
      x = e.clientX / innerWidth * 2 - 1; y = e.clientY / innerHeight * 2 - 1;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        R.style.setProperty('--mx', x.toFixed(3)); R.style.setProperty('--my', y.toFixed(3));
      });
    }, { passive: true });
  }

  function boot() {
    mount(); sync(); bindNav(); bindParallax();
    activate();                                       /* tabs that are full page loads (editor) activate once on load */
    if (location.hash === '#settings') setTimeout(function () { var b = q('#nav [data-v="settings"]'); if (b) b.click(); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
