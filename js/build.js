/**
 * Mesin agen.
 *
 * Alur:
 *   gate      hanya kotak RR. Kursor keluar lalu diam saat kotak disorot, masuk lagi saat ditinggalkan.
 *   live      kursor yang bebas diam dalam dua lingkaran dan ikut bergeser bersama kursor utama.
 *             Kru scale menarik bingkai ukuran setiap layer, lalu kru pengetik mengisi kata di
 *             dalam bingkai itu. Di layar sentuh, kursor bebas hanya muncul saat jari menekan.
 *             Layer yang sudah terlewat menghilang sendiri, dan dibangun ulang saat kembali.
 *   exiting   semua layer dihapus, lalu kembali ke kotak RR.
 *
 * Konten selalu ada di HTML. Elemen yang belum dibangun hanya transparan.
 * Jenis tugas ditandai dengan data-b: text, box, line, pop.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var canvas = document.getElementById('swarm');

  if (!root.classList.contains('js-build')) {
    canvas.hidden = true;
    window.RRBuild = { finish: function () {} };
    return;
  }

  var coarse = matchMedia('(hover: none)').matches;

  // Di laptop, desynchronized menjaga kanvas selebar layar tetap lancar di GPU terintegrasi.
  // Di HP tidak dipakai, karena kanvas ini bisa tampil sebagai lapisan yang menutupi halaman.
  var ctx = coarse ? canvas.getContext('2d') : canvas.getContext('2d', { desynchronized: true });
  var gate = document.getElementById('gate');
  var tile = document.getElementById('gateTile');
  var brandMark = document.querySelector('.brand-mark');
  var brandLink = document.getElementById('brandLink');
  var navExit = document.getElementById('navExit');
  var shells = document.querySelectorAll('.nav, main, .footer');

  var small = window.innerWidth < 760;

  var TYPISTS = small ? 5 : 10;    // kru pengetik, mengisi bagian dalam bingkai
  var SCALERS = small ? 3 : 6;     // kru scale, menarik bingkai ukuran setiap layer
  var AGENTS = TYPISTS + SCALERS;
  var HELPERS = small ? 4 : 8;     // jumlah kursor yang ikut menunjuk elemen yang disorot
  var TRAIL = 3;
  var ENTER_MS = 640;
  var EXIT_MAX_MS = 1200;
  var PRESS_MS = 260;
  var INTERACTIVE = 'a[href], button, input:not([type="hidden"]), select, textarea, label[for]';

  // Formasi diam: dua lingkaran rapi di sekitar kursor utama atau kotak RR.
  var SCALER_RING = 40;
  var TYPIST_RING = 72;

  var SEL = '#2e8bff';
  var RULE = '#ff4a2e';
  var GROUND = '#0c0f12';
  var MONO = '9px "Martian Mono", ui-monospace, Consolas, monospace';
  var COLORS = ['#38d6f5', '#f5b83d', '#4be3a0', '#9c8cff', '#ff7ab8'];
  var SCALER = '#5ba6ff';

  var ARROW = new Path2D('M0 0 L0 14.5 L3.9 10.9 L6.4 16.4 L8.8 15.3 L6.3 9.9 L11.3 9.7 Z');
  var SCALE_MS = { text: 820, box: 1250, line: 1100, pop: 640 };
  var FILL_MS = { box: 950, pop: 560 };
  var VANISH_MS = 420;

  var W = 0;
  var H = 0;
  var dpr = 1;
  var phase = 'gate';
  var phaseAt = 0;
  var units = [];
  var agents = [];
  var active = [];
  var ready = [];   // layer yang bingkainya sudah jadi dan menunggu pengetik
  var pointer = { x: 0, y: 0 };
  var gateOpen = false;
  var hoverEl = null;
  var touching = false;
  var ticks = 0;
  var pressAt = -1000;
  var frameNow = 0;
  var dirty = true;
  var checkedAt = 0;
  var lastWork = 0;
  var guideAlpha = 0;
  var guideWrap = null;
  var raf = 0;
  var last = 0;

  // ----------------------------------------------------------------- Bantuan
  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function setPhase(next) {
    phase = next;
    phaseAt = performance.now();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    dirty = true;
  }

  function mark(job, state) {
    job.el.setAttribute('data-bs', state);
  }

  // Kanvas objek 3D jauh lebih besar dari objeknya, jadi bingkainya dirapatkan ke objek.
  function rectOf(job) {
    var r = job.el.getBoundingClientRect();
    if (job.el.id !== 'stage') return r;
    var inset = r.width * 0.12;
    return {
      left: r.left + inset,
      top: r.top + inset,
      right: r.right - inset,
      bottom: r.bottom - inset,
      width: r.width - inset * 2,
      height: r.height - inset * 2
    };
  }

  function stageChanged(job, built) {
    if (job.el.id !== 'stage' || !window.RRDevice) return;
    // Monitor hanya hiasan: kalau bermasalah, pembangunan halaman harus tetap jalan.
    try {
      if (built) window.RRDevice.assemble(2600);
      else window.RRDevice.disassemble(700);
    } catch (err) {
      root.classList.add('no-webgl');
    }
  }

  function toTop() {
    var before = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = before;
  }

  // Pengaman: apa pun yang gagal, pengunjung tetap mendapat halaman lengkap tanpa animasi.
  function rescue() {
    if (phase === 'off') return;
    phase = 'off';
    active = [];
    ready = [];
    units.forEach(function (unit) {
      unit.queue = [];
      unit.jobs.forEach(function (job) {
        try { joinText(job); } catch (err) { job.parts = null; }
        job.state = 'built';
        job.queued = false;
        mark(job, 'done');
      });
    });
    root.classList.remove('js-build', 'is-gated');
    gate.hidden = true;
    canvas.hidden = true;
    setInert(false);
    try {
      if (window.RRDevice) window.RRDevice.complete();
    } catch (err) {
      root.classList.add('no-webgl');
    }
  }

  // -------------------------------------------------------------- Pengumpulan
  function collect() {
    units = Array.prototype.map.call(document.querySelectorAll('[data-unit]'), function (el, index) {
      var unit = {
        name: el.getAttribute('data-unit'),
        wrap: el.classList.contains('wrap') ? el : el.querySelector('.wrap') || el.closest('.wrap'),
        color: COLORS[index % COLORS.length],
        sticky: el.classList.contains('nav'),
        queue: [],
        jobs: []
      };
      unit.jobs = Array.prototype.map.call(el.querySelectorAll('[data-b]'), function (node) {
        return { el: node, kind: node.getAttribute('data-b'), unit: unit, state: 'empty', action: '', queued: false, agent: null, parts: null, chars: 0, t0: 0, dur: 0, p: 0, caret: null };
      });
      return unit;
    });
  }

  function makeAgents() {
    agents = [];
    for (var i = 0; i < AGENTS; i++) {
      agents.push({
        index: i,
        x: W / 2,
        y: H / 2,
        tx: W / 2,
        ty: H / 2,
        vx: 0,
        vy: 0,
        angle: 0,
        alpha: 0,
        role: i < TYPISTS ? 'type' : 'scale',
        slot: i < TYPISTS ? i : i - TYPISTS,
        crew: i < TYPISTS ? TYPISTS : SCALERS,
        color: i < TYPISTS ? COLORS[i % COLORS.length] : SCALER,
        mode: 'arrow',
        tag: '',
        job: null,
        tint: null,
        trail: [],
        trailAt: 0
      });
    }
  }

  // ------------------------------------------------------------ Teks diketik
  function splitText(job) {
    var walker = document.createTreeWalker(job.el, NodeFilter.SHOW_TEXT);
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) {
      if (node.nodeValue.trim()) nodes.push(node);
    }

    var total = 0;
    job.parts = nodes.map(function (text) {
      var on = document.createElement('span');
      var off = document.createElement('span');
      off.className = 'b-off';
      // Spasi dan indentasi kode dirapatkan supaya ketikannya tidak tersendat.
      var clean = text.nodeValue.replace(/\s+/g, ' ');
      off.textContent = clean;
      var parent = text.parentNode;
      parent.insertBefore(on, text);
      parent.insertBefore(off, text);
      parent.removeChild(text);
      var part = { text: text, on: on, off: off, full: clean, parent: parent, shown: 0, start: total };
      total += part.full.length;
      return part;
    });
    job.chars = total;
  }

  function typeTo(job, count) {
    var caretPart = null;
    job.parts.forEach(function (part) {
      var n = clamp(count - part.start, 0, part.full.length);
      if (n !== part.shown) {
        part.on.textContent = part.full.slice(0, n);
        part.off.textContent = part.full.slice(n);
        part.shown = n;
      }
      if (n > 0) caretPart = part;
    });
    return caretPart;
  }

  function joinText(job) {
    if (!job.parts) return;
    job.parts.forEach(function (part) {
      part.parent.insertBefore(part.text, part.on);
      part.parent.removeChild(part.on);
      part.parent.removeChild(part.off);
    });
    job.parts = null;
  }

  function caretPoint(part, rect) {
    if (part) {
      var rects = part.on.getClientRects();
      var r = rects[rects.length - 1];
      if (r) return { x: r.right, y: r.top, h: r.height };
    }
    return { x: rect.left, y: rect.top, h: Math.min(rect.height, 28) };
  }

  // ---------------------------------------------------------------- Pekerjaan
  function dequeue(job) {
    var i = job.unit.queue.indexOf(job);
    if (i >= 0) job.unit.queue.splice(i, 1);
    job.queued = false;
  }

  function enqueue(job, action) {
    if (job.queued && job.action === action) return;
    if (job.queued) dequeue(job);
    job.action = action;
    job.queued = true;
    job.unit.queue.push(job);
  }

  function release(job) {
    if (!job.agent) return;
    job.agent.job = null;
    job.agent.mode = 'arrow';
    job.agent.tag = '';
    job.agent.tint = null;
    job.agent = null;
  }

  // Menyelesaikan tugas tanpa animasi, dipakai untuk elemen di luar layar.
  function settle(job, built) {
    dequeue(job);
    var waiting = ready.indexOf(job);
    if (waiting >= 0) ready.splice(waiting, 1);
    joinText(job);
    release(job);
    var i = active.indexOf(job);
    if (i >= 0) active.splice(i, 1);
    mark(job, built ? 'done' : 'wait');
    var was = job.state === 'built';
    job.state = built ? 'built' : 'empty';
    if (was !== built) stageChanged(job, built);
  }

  function begin(job, agent, next, now) {
    job.queued = false;
    job.agent = agent;
    job.state = 'fly';
    job.next = next;
    job.t0 = now;
    job.caret = null;
    agent.job = job;
    agent.tint = agent.role === 'type' ? job.unit.color : null;
    if (active.indexOf(job) < 0) active.push(job);
    lastWork = now;
    guideWrap = job.unit.wrap;
  }

  function speedOf() {
    if (phase === 'exiting') return 2.8;
    var waiting = units.reduce(function (sum, u) { return sum + u.queue.length; }, ready.length);
    return clamp(1 + (waiting / AGENTS) * 0.2, 1, 1.5);
  }

  function setTag(job, word) {
    job.agent.tag = window.RRLang().tags[word];
  }

  // Tahap 1: kru scale menarik bingkai ukuran layer.
  function startScale(job, now) {
    job.state = 'scale';
    job.t0 = now;
    job.dur = SCALE_MS[job.kind] / speedOf();
    job.p = 0;
    setTag(job, job.kind === 'line' ? 'line' : 'scale');
    if (job.kind === 'line') job.agent.mode = 'cross';
  }

  function endScale(job, now) {
    release(job);
    if (job.kind === 'line') {
      mark(job, 'in');
      job.state = 'fade';
      job.t0 = now;
      job.dur = 460;
      return;
    }
    job.state = 'ready';
    ready.push(job);
  }

  // Tahap 2: kru pengetik mengisi bagian dalam bingkai.
  function startFill(job, now) {
    job.state = 'work';
    job.t0 = now;
    job.p = 0;

    if (job.kind === 'text') {
      splitText(job);
      job.dur = clamp(job.chars * 22, 750, 2700) / speedOf();
      mark(job, 'run');
      job.agent.mode = 'ibeam';
      setTag(job, 'text');
    } else {
      job.dur = FILL_MS[job.kind] / speedOf();
      mark(job, 'in');
      setTag(job, 'fill');
    }
  }

  function endFill(job, now) {
    joinText(job);
    release(job);
    mark(job, job.kind === 'text' ? 'done' : 'in');
    stageChanged(job, true);
    job.state = 'fade';
    job.t0 = now;
    job.dur = 460;
  }

  // Dipakai saat keluar: layer dihapus oleh kursor mana pun yang bebas.
  function startClear(job, now) {
    job.state = 'clear';
    job.t0 = now;
    job.p = 1;
    job.dur = (SCALE_MS[job.kind] * 0.5) / speedOf();
    setTag(job, 'clear');

    if (job.kind === 'text') {
      splitText(job);
      typeTo(job, job.chars);
      job.dur = clamp(job.chars * 8, 240, 900) / speedOf();
      mark(job, 'run');
      job.agent.mode = 'ibeam';
    } else {
      mark(job, 'out');
      stageChanged(job, false);
    }
  }

  function endClear(job) {
    joinText(job);
    release(job);
    mark(job, 'wait');
    if (job.kind === 'text') stageChanged(job, false);
    job.state = 'empty';
    active.splice(active.indexOf(job), 1);
  }

  function stepJob(job, now) {
    var r = rectOf(job);

    // Sudah di luar layar: tidak ada yang melihat, langsung selesaikan.
    if (r.bottom < -60 || r.top > H + 60) {
      settle(job, false);
      return;
    }

    if (job.state === 'ready') return;

    if (job.state === 'vanish') {
      job.p = 1 - easeOut(clamp((now - job.t0) / job.dur, 0, 1));
      if (now - job.t0 >= job.dur) {
        mark(job, 'wait');
        job.state = 'empty';
        active.splice(active.indexOf(job), 1);
      }
      return;
    }

    if (job.state === 'fade') {
      if (now - job.t0 >= job.dur) {
        mark(job, 'done');
        job.state = 'built';
        active.splice(active.indexOf(job), 1);
      }
      return;
    }

    var a = job.agent;

    if (job.state === 'fly') {
      var filling = job.next === 'fill';
      a.tx = filling ? r.left + 6 : r.left;
      a.ty = filling ? r.top + Math.min(r.height / 2, 18) : r.top;
      var close = Math.abs(a.x - a.tx) + Math.abs(a.y - a.ty) < 24;
      if (close || now - job.t0 > 480 / speedOf()) {
        if (job.next === 'scale') startScale(job, now);
        else if (filling) startFill(job, now);
        else startClear(job, now);
      }
      return;
    }

    var p = clamp((now - job.t0) / job.dur, 0, 1);
    lastWork = now;

    if (job.state === 'scale') {
      var e = easeOut(p);
      job.p = e;
      a.tx = r.left + r.width * e;
      a.ty = job.kind === 'line' ? r.top : r.top + r.height * e;
      if (p >= 1) endScale(job, now);
      return;
    }

    var v = job.state === 'clear' ? 1 - p : p;
    job.p = v;

    if (job.kind === 'text') {
      var caret = caretPoint(typeTo(job, Math.round(job.chars * v)), r);
      job.caret = caret;
      a.tx = caret.x;
      a.ty = caret.y + caret.h * 0.5;
    } else {
      a.tx = r.left + r.width * v;
      a.ty = r.top + r.height * 0.5;
    }

    if (p >= 1) {
      if (job.state === 'clear') endClear(job);
      else endFill(job, now);
    }
  }

  // Layer yang sudah terlewat menghilang sendiri tanpa kursor: bingkainya mengecil lalu hilang.
  function vanish(job, now) {
    job.state = 'vanish';
    job.t0 = now;
    job.dur = VANISH_MS;
    job.p = 1;
    mark(job, 'out');
    stageChanged(job, false);
    active.push(job);
  }

  // Layer dibangun saat masuk layar dan menghilang saat sudah terlewat.
  function evaluate(now) {
    var clearTop = H * 0.14;
    // Di ujung halaman tidak ada lagi yang bisa di-scroll, jadi seluruh layar harus dibangun.
    var atEnd = window.scrollY + H >= document.documentElement.scrollHeight - 8;
    var buildBottom = atEnd ? H + 1 : H * 0.93;

    units.forEach(function (unit) {
      unit.jobs.forEach(function (job) {
        var r = rectOf(job);

        if (r.width === 0 || r.height === 0) {
          if (job.state !== 'built') settle(job, true);
          return;
        }

        if (job.state !== 'empty' && job.state !== 'built') return;

        var margin = job.state === 'empty' ? 48 : 0;   // mencegah kedip di batas
        var want = unit.sticky || (r.bottom > clearTop + margin && r.top < buildBottom);

        if (job.state === 'built') {
          if (want) return;
          if (r.bottom > 0 && r.top < H) vanish(job, now);
          else settle(job, false);
        } else if (want) {
          enqueue(job, 'build');
        } else if (job.queued) {
          dequeue(job);
        }
      });
    });
  }

  function evaluateExit() {
    units.forEach(function (unit) {
      unit.jobs.forEach(function (job) {
        if (job.state === 'clear' || (job.state === 'fly' && job.next === 'clear')) return;

        // Layer yang sedang dikerjakan langsung dibatalkan.
        if (job.state === 'fly' || job.state === 'scale' || job.state === 'ready' || job.state === 'work' || job.state === 'vanish') {
          settle(job, false);
          return;
        }
        if (job.state === 'fade') settle(job, true);
        if (job.queued && job.action === 'build') dequeue(job);

        var r = rectOf(job);
        var onScreen = r.width > 0 && r.bottom > 0 && r.top < H;
        if (job.state === 'built') {
          if (onScreen) enqueue(job, 'clear');
          else settle(job, false);
        }
      });
    });
  }

  function nearest(list, r) {
    return list.slice().sort(function (a, b) {
      return Math.abs(a.x - r.left) + Math.abs(a.y - r.top) - Math.abs(b.x - r.left) - Math.abs(b.y - r.top);
    })[0];
  }

  // Kru scale mengambil layer baru, kru pengetik mengambil layer yang bingkainya sudah jadi.
  function dispatch(now) {
    units.forEach(function (unit) {
      for (var i = 0; i < unit.queue.length; i++) {
        var job = unit.queue[i];
        var clearing = job.action === 'clear';
        var free = agents.filter(function (a) { return !a.job && (clearing || a.role === 'scale'); });
        if (!free.length) continue;
        unit.queue.splice(i, 1);
        i--;
        begin(job, nearest(free, rectOf(job)), clearing ? 'clear' : 'scale', now);
      }
    });

    if (phase !== 'live') return;

    while (ready.length) {
      var typists = agents.filter(function (a) { return !a.job && a.role === 'type'; });
      if (!typists.length) return;
      var next = ready.shift();
      begin(next, nearest(typists, rectOf(next)), 'fill', now);
    }
  }

  // ------------------------------------------------------------------- Agen
  function tileCenter() {
    var r = (gate.hidden ? brandMark : tile).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function seat(a, cx, cy, spread) {
    var radius = (a.role === 'type' ? TYPIST_RING : SCALER_RING) * spread;
    var turn = (a.slot / a.crew) * Math.PI * 2 - Math.PI / 2;
    a.tx = cx + Math.cos(turn) * radius;
    a.ty = cy + Math.sin(turn) * radius;
  }

  // Titik di tepi kotak, f bernilai 0 sampai 1 searah jarum jam dari kiri atas.
  function edgePoint(r, f) {
    var d = f * 2 * (r.width + r.height);
    if (d < r.width) return [r.left + d, r.top];
    d -= r.width;
    if (d < r.height) return [r.right, r.top + d];
    d -= r.height;
    if (d < r.width) return [r.right - d, r.bottom];
    return [r.left, r.bottom - (d - r.width)];
  }

  function hoverRect() {
    if (!hoverEl || phase !== 'live' || !hoverEl.isConnected) return null;
    var r = hoverEl.getBoundingClientRect();
    return r.width && r.height ? r : null;
  }

  function stepAgents(dt, now) {
    var center = tileCenter();
    var target = hoverRect();
    var helpers = target ? agents.filter(function (a) { return !a.job; }).slice(0, HELPERS) : [];

    agents.forEach(function (a) {
      var wantAlpha = 1;

      if (phase === 'gate') {
        if (gateOpen) {
          seat(a, center.x, center.y, 1.5);
        } else {
          a.tx = center.x;
          a.ty = center.y;
          if (Math.abs(a.x - center.x) + Math.abs(a.y - center.y) < 40) wantAlpha = 0;
        }
      } else if (phase === 'exiting' && !a.job) {
        a.tx = center.x;
        a.ty = center.y;
      } else if (!a.job) {
        if (helpers.indexOf(a) >= 0) {
          // Saat kursor utama menyorot sesuatu, agen ikut menunjuk dari posisi yang berbeda.
          var spot = edgePoint(target, (helpers.indexOf(a) + 0.5) / helpers.length);
          a.tx = spot[0];
          a.ty = spot[1];
        } else {
          seat(a, pointer.x, pointer.y, 1);
        }
        if (coarse && !touching) wantAlpha = 0;
      }

      a.alpha += (wantAlpha - a.alpha) * (1 - Math.exp(-dt / 90));

      // Kursor yang tersembunyi di HP langsung muncul di bawah jari, bukan terbang dari jauh.
      if (coarse && !a.job && a.alpha < 0.05) {
        a.x = a.tx;
        a.y = a.ty;
        a.trail = [];
      }

      // Semua kursor bebas memakai kelambatan yang sama supaya formasinya tidak rusak saat bergerak.
      var k = 1 - Math.exp(-dt / (a.job ? 90 : 100));
      var nx = a.x + (a.tx - a.x) * k;
      var ny = a.y + (a.ty - a.y) * k;
      a.vx = nx - a.x;
      a.vy = ny - a.y;
      a.x = nx;
      a.y = ny;

      if (Math.abs(a.vx) + Math.abs(a.vy) > 2.4) {
        var heading = Math.atan2(a.vy, a.vx) + Math.PI * 0.5 + 0.42;
        a.angle += Math.atan2(Math.sin(heading - a.angle), Math.cos(heading - a.angle)) * 0.22;
      } else {
        a.angle *= 0.88;
      }

      if (now - a.trailAt > 30) {
        a.trailAt = now;
        a.trail.unshift({ x: a.x, y: a.y, angle: a.angle });
        if (a.trail.length > TRAIL) a.trail.pop();
      }
    });
  }

  // ----------------------------------------------------------------- Gambar
  function drawArrow(x, y, angle, color, alpha, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (size) ctx.scale(size, size);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill(ARROW);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(12,15,18,0.85)';
    ctx.stroke(ARROW);
    ctx.restore();
  }

  function drawTag(x, y, text, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = MONO;
    var w = ctx.measureText(text).width + 10;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, 15);
    ctx.fillStyle = GROUND;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 5, y + 8);
    ctx.globalAlpha = 1;
  }

  function drawAgent(a) {
    if (a.alpha < 0.02 || a.x < -40 || a.y < -40 || a.x > W + 40 || a.y > H + 40) return;
    var color = a.tint || a.color;

    if (a.mode === 'ibeam') {
      ctx.globalAlpha = a.alpha;
      ctx.fillStyle = color;
      ctx.fillRect(a.x + 5, a.y - 9, 2, 18);
      ctx.fillRect(a.x + 2, a.y - 10, 8, 2);
      ctx.fillRect(a.x + 2, a.y + 8, 8, 2);
    } else if (a.mode === 'cross') {
      ctx.globalAlpha = a.alpha;
      ctx.fillStyle = color;
      ctx.fillRect(a.x - 7, a.y - 1, 14, 2);
      ctx.fillRect(a.x - 1, a.y - 7, 2, 14);
    } else {
      for (var i = a.trail.length - 1; i >= 1; i--) {
        var g = a.trail[i];
        if (Math.abs(g.x - a.x) + Math.abs(g.y - a.y) < 10) continue;
        drawArrow(g.x, g.y, g.angle, color, a.alpha * 0.34 * (1 - i / a.trail.length));
      }
      // Saat ditekan, setiap agen ikut menekan di posisinya.
      var pressed = clamp((frameNow - pressAt) / PRESS_MS, 0, 1);
      var pressing = pressed < 1 && !a.job && hoverEl;
      drawArrow(a.x, a.y, a.angle, color, a.alpha, pressing ? 1 - 0.24 * Math.sin(pressed * Math.PI) : 1);
      if (pressing) {
        ctx.globalAlpha = a.alpha * (1 - pressed);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(a.x, a.y, 4 + pressed * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    if (a.tag && !small) drawTag(a.x + 13, a.y + 13, a.tag, color, a.alpha);
    ctx.globalAlpha = 1;
  }

  function handle(x, y) {
    ctx.fillStyle = GROUND;
    ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
    ctx.strokeStyle = SEL;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
  }

  function frame(x, y, w, h, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = SEL;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x, y, w, h);
    handle(x, y);
    handle(x + w, y);
    handle(x, y + h);
    handle(x + w, y + h);
    ctx.globalAlpha = 1;
  }

  function drawSize(r, w, h) {
    if (small || w < 70) return;
    var text = Math.round(w) + ' × ' + Math.round(h);
    ctx.font = MONO;
    var tw = ctx.measureText(text).width + 10;
    drawTag(r.left + w / 2 - tw / 2, r.top + h + 7, text, SEL, 1);
  }

  function drawJob(job, now) {
    var r = rectOf(job);
    if (r.bottom < -40 || r.top > H + 40) return;

    var grey = 'rgba(118,128,138,';
    var scaling = job.state === 'scale' || (job.state === 'fly' && job.next === 'scale');

    if (job.kind === 'line') {
      if (job.state === 'scale') {
        var x2 = r.left + r.width * job.p;
        ctx.fillStyle = SEL;
        ctx.fillRect(r.left, r.top - 0.5, x2 - r.left, 2);
        handle(r.left, r.top);
        handle(x2, r.top);
      }
      return;
    }

    if (scaling) {
      if (job.state === 'fly') return;
      var w = r.width * job.p;
      var h = r.height * job.p;
      ctx.fillStyle = grey + '0.16)';
      ctx.fillRect(r.left, r.top, w, h);
      frame(r.left, r.top, w, h, 1);
      drawSize(r, w, h);
      return;
    }

    if (job.state === 'vanish') {
      ctx.fillStyle = grey + 0.16 * job.p + ')';
      ctx.fillRect(r.left, r.top, r.width * job.p, r.height * job.p);
      frame(r.left, r.top, r.width * job.p, r.height * job.p, job.p);
    } else if (job.state === 'clear') {
      if (job.kind !== 'text') {
        var c = easeOut(job.p);
        ctx.fillStyle = grey + '0.16)';
        ctx.fillRect(r.left, r.top, r.width * c, r.height * c);
        frame(r.left, r.top, r.width * c, r.height * c, 1);
      } else {
        frame(r.left, r.top, r.width, r.height, 0.9);
      }
    } else if (job.state === 'ready' || job.state === 'fly') {
      ctx.fillStyle = grey + '0.16)';
      ctx.fillRect(r.left, r.top, r.width, r.height);
      frame(r.left, r.top, r.width, r.height, 1);
    } else if (job.state === 'work') {
      var fade = job.kind === 'text' ? 0.1 * (1 - job.p) : 0.16 * (1 - job.p);
      ctx.fillStyle = grey + fade + ')';
      ctx.fillRect(r.left, r.top, r.width, r.height);
      frame(r.left, r.top, r.width, r.height, 0.95);
    } else if (job.state === 'fade') {
      frame(r.left, r.top, r.width, r.height, (1 - clamp((now - job.t0) / job.dur, 0, 1)) * 0.8);
    }

    if (job.caret && (job.state === 'work' || job.state === 'clear')) {
      ctx.fillStyle = SEL;
      ctx.fillRect(job.caret.x + 1, job.caret.y, 2, job.caret.h);
    }
  }

  function drawGuides() {
    if (guideAlpha < 0.01) return;
    ctx.globalAlpha = guideAlpha;

    ctx.fillStyle = 'rgba(46,139,255,0.2)';
    ctx.fillRect(0, 0, W, 16);
    ctx.fillStyle = 'rgba(190,215,255,0.75)';
    ctx.font = MONO;
    ctx.textBaseline = 'middle';
    for (var x = 0; x < W; x += 20) {
      var major = x % 100 === 0;
      ctx.fillRect(x, major ? 8 : 12, 1, major ? 8 : 4);
      if (major && !small) ctx.fillText(String(x), x + 3, 6);
    }

    if (guideWrap) {
      var r = guideWrap.getBoundingClientRect();
      var pad = parseFloat(getComputedStyle(guideWrap).paddingLeft) || 0;
      var left = r.left + pad;
      var right = r.right - pad;
      var cols = small ? 2 : 4;

      ctx.strokeStyle = 'rgba(46,139,255,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      for (var c = 1; c <= cols; c++) {
        var gx = Math.round(left + ((right - left) * c) / cols) + 0.5;
        ctx.moveTo(gx, 16);
        ctx.lineTo(gx, H);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = RULE;
      ctx.fillRect(Math.round(left) - 1, 16, 2, H);
    }

    ctx.globalAlpha = 1;
  }

  function draw(now) {
    frameNow = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawGuides();
    active.forEach(function (job) { drawJob(job, now); });
    agents.forEach(drawAgent);

    if (phase === 'gate' && gateOpen && !coarse) {
      var c = tileCenter();
      var words = window.RRLang().tags;
      ctx.font = MONO;
      var w = ctx.measureText(words.hint).width + 10;
      drawTag(c.x - w / 2, c.y + 128, words.hint, SEL, 1);
    }
  }

  // -------------------------------------------------------------------- Loop
  function needsFrame(now) {
    if (phase === 'off') return false;
    if (touching) return true;
    if (active.length || guideAlpha > 0.01) return true;
    if (ready.length || units.some(function (u) { return u.queue.length; })) return true;
    if (phase === 'entering' || phase === 'exiting') return true;
    if (now - pressAt < PRESS_MS + 40) return true;
    // Semua kursor sudah diam di tempatnya: tidak perlu menggambar lagi sampai ada gerakan.
    return agents.some(function (a) {
      var hidden = (phase === 'gate' && !gateOpen) || (coarse && phase === 'live' && !a.job);
      var target = hidden ? 0 : 1;
      return Math.abs(a.x - a.tx) + Math.abs(a.y - a.ty) > 0.4 || Math.abs(a.alpha - target) > 0.02;
    });
  }

  function tick(now) {
    raf = 0;
    ticks++;
    try {
      step(now);
    } catch (err) {
      rescue();
      return;
    }
    if (needsFrame(now)) raf = requestAnimationFrame(tick);
  }

  function step(now) {
    var dt = clamp(now - last, 1, 48);
    last = now;

    if (phase === 'entering' && now - phaseAt > 300) setPhase('live');

    if (phase === 'live' && (dirty || now - checkedAt > 240)) {
      dirty = false;
      checkedAt = now;
      evaluate(now);
    }

    if (phase === 'exiting') {
      evaluateExit();
      var cleared = !active.length && units.every(function (u) { return !u.queue.length; });
      if (cleared || now - phaseAt > EXIT_MAX_MS) showGate();
    }

    if (phase === 'live' || phase === 'exiting') dispatch(now);

    active.slice().forEach(function (job) { stepJob(job, now); });
    stepAgents(dt, now);

    var wantGuides = active.length > 0 ? 1 : 0;
    guideAlpha += (wantGuides - guideAlpha) * (1 - Math.exp(-dt / 170));

    // Saat loop berhenti, gambar terakhir tetap di kanvas supaya tugas yang selesai tidak berkedip.
    draw(now);
  }

  function wake() {
    if (phase !== 'off' && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  // ------------------------------------------------- Layar awal, masuk, keluar
  function setInert(on) {
    shells.forEach(function (el) { el.inert = on; });
  }

  function tileOffset() {
    var from = tile.getBoundingClientRect();
    var to = brandMark.getBoundingClientRect();
    var scale = to.width / from.width;
    var dx = to.left + to.width / 2 - (from.left + from.width / 2);
    var dy = to.top + to.height / 2 - (from.top + from.height / 2);
    return 'translate(' + dx + 'px,' + dy + 'px) scale(' + scale + ')';
  }

  function enter() {
    if (phase !== 'gate') return;
    root.classList.remove('is-gated');
    toTop();
    setInert(false);
    gateOpen = false;
    tile.style.transform = tileOffset();
    gate.classList.add('is-leaving');
    setPhase('entering');
    lastWork = phaseAt;
    if (!coarse) agents.forEach(function (a) { a.alpha = Math.max(a.alpha, 0.6); });

    window.setTimeout(function () {
      gate.hidden = true;
      var brand = units[0].jobs[0];
      if (brand.state === 'empty') settle(brand, true);
    }, ENTER_MS);

    // Kalau animasi tidak berjalan sama sekali, tampilkan halaman apa adanya.
    ticks = 0;
    window.setTimeout(function () {
      if (phase !== 'off' && !document.hidden && ticks < 8) rescue();
    }, 3000);

    if (location.hash.length > 1) {
      var target = document.querySelector(location.hash);
      if (target) target.scrollIntoView();
    }
    dirty = true;
    wake();
  }

  function exit() {
    if (phase !== 'live') return;
    setPhase('exiting');
    wake();
  }

  function showGate() {
    units.forEach(function (unit) {
      unit.jobs.forEach(function (job) { settle(job, false); });
      unit.queue = [];
      ready = [];
    });
    agents.forEach(function (a) {
      a.job = null;
      a.tint = null;
      a.mode = 'arrow';
      a.tag = '';
    });
    active = [];

    // Alamat seperti #kontak dibuang supaya masuk berikutnya selalu mulai dari beranda.
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    toTop();
    root.classList.add('is-gated');
    setInert(true);
    if (window.RRDevice) window.RRDevice.reset();

    // Kotak terbang balik dari logo di navigasi ke tengah layar.
    gate.hidden = false;
    gate.classList.add('is-leaving');
    tile.style.transition = 'none';
    tile.style.transform = '';
    tile.style.transform = tileOffset();
    void tile.offsetWidth;
    tile.style.transition = '';
    tile.style.transform = '';
    gate.classList.remove('is-leaving');

    setPhase('gate');
    tile.focus({ preventScroll: true });
    gateOpen = false;
    wake();
  }

  function openGate(open) {
    if (phase !== 'gate') return;
    gateOpen = open;
    wake();
  }

  // ------------------------------------------------------------------ Mulai
  try {
    history.scrollRestoration = 'manual';
    resize();
    pointer.x = W / 2;
    pointer.y = H * 0.62;
    collect();
    makeAgents();
    units.forEach(function (unit) {
      unit.jobs.forEach(function (job) { mark(job, 'wait'); });
    });
    setInert(true);
    setPhase('gate');

    window.RRBuild = {
      // Dipakai sebelum ganti bahasa: tugas yang sedang berjalan diselesaikan seketika.
      finish: function () {
        active.slice().forEach(function (job) { settle(job, job.next !== 'clear' && job.state !== 'vanish'); });
        dirty = true;
      }
    };

    tile.addEventListener('pointerenter', function () { openGate(true); });
    tile.addEventListener('pointerleave', function () { openGate(false); });
    tile.addEventListener('focus', function () {
      if (tile.matches(':focus-visible')) openGate(true);
    });
    tile.addEventListener('blur', function () { openGate(false); });
    tile.addEventListener('click', function () {
      try {
        enter();
      } catch (err) {
        rescue();
      }
    });

    brandLink.addEventListener('click', function (e) {
      if (phase === 'off') return;
      e.preventDefault();
      exit();
    });
    navExit.addEventListener('click', exit);

    window.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      if (phase === 'gate' ? gateOpen : !coarse) wake();
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pressAt = performance.now();
      wake();
    }, { passive: true });

    function followTouch(e) {
      touching = e.touches.length > 0;
      if (touching) {
        pointer.x = e.touches[0].clientX;
        pointer.y = e.touches[0].clientY;
      }
      wake();
    }

    if (coarse) {
      window.addEventListener('touchstart', followTouch, { passive: true });
      window.addEventListener('touchmove', followTouch, { passive: true });
      window.addEventListener('touchend', followTouch, { passive: true });
      window.addEventListener('touchcancel', followTouch, { passive: true });
    }

    document.addEventListener('pointerover', function (e) {
      if (coarse) return;
      var el = e.target.closest ? e.target.closest(INTERACTIVE) : null;
      if (el === hoverEl) return;
      hoverEl = el;
      wake();
    }, { passive: true });

    root.addEventListener('pointerleave', function () {
      hoverEl = null;
      wake();
    }, { passive: true });

    window.addEventListener('scroll', function () {
      dirty = true;
      wake();
    }, { passive: true });

    window.addEventListener('resize', function () {
      resize();
      wake();
    }, { passive: true });

    window.addEventListener('beforeprint', function () {
      units.forEach(function (unit) {
        unit.jobs.forEach(function (job) { settle(job, true); });
      });
    });
  } catch (err) {
    root.classList.remove('js-build', 'is-gated');
    canvas.hidden = true;
    gate.hidden = true;
    setInert(false);
    document.querySelectorAll('[data-bs]').forEach(function (el) { el.setAttribute('data-bs', 'done'); });
  }
})();
