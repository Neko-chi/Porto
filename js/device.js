/**
 * Monitor 3D dengan WebGL murni.
 * Setelah agen memasangnya, layar boot, masuk ke login bergaya Parrot, lalu membuka terminal.
 * Layar hanya memakai teks, tanpa logo Parrot.
 * Easter egg: di perangkat dengan mouse, terminalnya bisa diklik lalu diketik.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('stageCanvas');
  if (!canvas) return;

  var root = document.documentElement;
  var gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!gl) {
    root.classList.add('no-webgl');
    return;
  }

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ----------------------------------------------------------------- Bentuk
  // Pelat dengan sudut membulat dan tepi melengkung halus.
  function slab(w, d, h, r, b, seg) {
    var outline = [];
    var corners = [[w / 2 - r, d / 2 - r, 0], [-(w / 2 - r), d / 2 - r, 1], [-(w / 2 - r), -(d / 2 - r), 2], [w / 2 - r, -(d / 2 - r), 3]];
    corners.forEach(function (c) {
      for (var s = 0; s <= seg; s++) {
        var a = (c[2] + s / seg) * Math.PI * 0.5;
        outline.push([c[0], c[1], Math.cos(a), Math.sin(a)]);
      }
    });

    var rows = [];
    var steps = 3;
    var k;
    for (k = 0; k <= steps; k++) {
      var t0 = (k / steps) * Math.PI * 0.5;
      rows.push([b - b * Math.cos(t0), b - b * Math.sin(t0), -Math.cos(t0), Math.sin(t0)]);
    }
    for (k = 0; k <= steps; k++) {
      var t1 = (k / steps) * Math.PI * 0.5;
      rows.push([h - b + b * Math.sin(t1), b - b * Math.cos(t1), Math.sin(t1), Math.cos(t1)]);
    }

    var verts = [];
    rows.forEach(function (row) {
      outline.forEach(function (p) {
        var x = p[0] + (r - row[1]) * p[2];
        var z = p[1] + (r - row[1]) * p[3];
        verts.push(x, row[0], z, p[2] * row[3], row[2], p[3] * row[3], x / w + 0.5, z / d + 0.5);
      });
    });

    var n = outline.length;
    var index = [];
    for (var y = 0; y < rows.length - 1; y++) {
      for (var i = 0; i < n; i++) {
        var a0 = y * n + i;
        var a1 = y * n + ((i + 1) % n);
        index.push(a0, a1, a1 + n, a0, a1 + n, a0 + n);
      }
    }

    var bottom = verts.length / 8;
    verts.push(0, 0, 0, 0, -1, 0, 0.5, 0.5);
    var top = verts.length / 8;
    verts.push(0, h, 0, 0, 1, 0, 0.5, 0.5);
    var last = (rows.length - 1) * n;
    for (var j = 0; j < n; j++) {
      index.push(bottom, j, (j + 1) % n);
      index.push(top, last + j, last + ((j + 1) % n));
    }

    return mesh(verts, index);
  }

  function box(w, h, d, r) {
    var radius = r || 0.012;
    return slab(w, d, h, radius, Math.min(radius, 0.005), 3);
  }

  function quad(x0, x1, z0, z1, y, ny) {
    return mesh([
      x0, y, z0, 0, ny, 0, 0, 0,
      x1, y, z0, 0, ny, 0, 1, 0,
      x1, y, z1, 0, ny, 0, 1, 1,
      x0, y, z1, 0, ny, 0, 0, 1
    ], [0, 1, 2, 0, 2, 3]);
  }

  function mesh(verts, index) {
    var vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);
    return { vb: vb, ib: ib, count: index.length };
  }

  // ----------------------------------------------------------------- Shader
  var VS = [
    'attribute vec3 aP, aN;',
    'attribute vec2 aU;',
    'uniform mat4 uModel, uProj;',
    'varying vec3 vN, vW;',
    'varying vec2 vU;',
    'void main() {',
    '  vec4 w = uModel * vec4(aP, 1.0);',
    '  vW = w.xyz;',
    '  vN = (uModel * vec4(aN, 0.0)).xyz;',
    '  vU = aU;',
    '  gl_Position = uProj * w;',
    '}'
  ].join('\n');

  // Bahan: 0 logam, 2 layar, 3 hitam mengilap, 5 lampu, 8 pantulan lantai.
  var FS = [
    'precision highp float;',
    'varying vec3 vN, vW;',
    'varying vec2 vU;',
    'uniform vec3 uEye, uColor;',
    'uniform float uMat, uPower;',
    'uniform sampler2D uTex;',
    'vec3 env(vec3 r) {',
    '  float up = r.y * 0.5 + 0.5;',
    '  vec3 c = mix(vec3(0.015, 0.017, 0.02), vec3(0.34, 0.36, 0.4), smoothstep(0.3, 1.0, up));',
    '  c += vec3(1.25) * smoothstep(0.68, 0.98, dot(r, normalize(vec3(0.15, 0.95, 0.3))));',
    '  c += vec3(0.8, 0.88, 1.0) * smoothstep(0.86, 0.995, dot(r, normalize(vec3(-0.9, 0.2, 0.4))));',
    '  c += vec3(1.0, 0.85, 0.7) * 0.6 * smoothstep(0.84, 0.99, dot(r, normalize(vec3(0.9, 0.05, 0.45))));',
    '  return c;',
    '}',
    'vec3 tone(vec3 c) { return 1.0 - exp(-c * 1.35); }',
    'void main() {',
    '  vec3 n = normalize(vN);',
    '  vec3 v = normalize(uEye - vW);',
    '  if (dot(n, v) < 0.0) n = -n;',
    '  vec3 r = reflect(-v, n);',
    '  float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);',
    '  if (uMat < 0.5) {',
    '    vec3 metal = env(r) * vec3(0.8, 0.81, 0.84) * (0.8 + 0.5 * fres) + vec3(0.04);',
    '    gl_FragColor = vec4(tone(metal), 1.0);',
    '  } else if (uMat < 2.5) {',
    '    vec3 s = texture2D(uTex, vU).rgb;',
    '    gl_FragColor = vec4(s + tone(env(r) * (0.02 + 0.4 * fres)), 1.0);',
    '  } else if (uMat < 3.5) {',
    '    gl_FragColor = vec4(tone(vec3(0.006) + env(r) * (0.05 + 0.5 * fres)), 1.0);',
    '  } else if (uMat < 5.5) {',
    '    gl_FragColor = vec4(uColor * (0.08 + 1.1 * uPower), 1.0);',
    '  } else if (uMat < 8.5) {',
    '    float d = length((vU - 0.5) * vec2(1.0, 1.7)) * 2.0;',
    '    float f = pow(max(1.0 - d, 0.0), 2.2);',
    '    vec3 c = vec3(0.1, 0.42, 0.62);',
    '    vec3 g = c * f * uPower * 0.42;',
    '    gl_FragColor = vec4(g, max(g.r, max(g.g, g.b)));',
    '  } else {',
    '    discard;',
    '  }',
    '}'
  ].join('\n');

  function shader(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  }

  var program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    root.classList.add('no-webgl');
    return;
  }

  gl.useProgram(program);
  var aP = gl.getAttribLocation(program, 'aP');
  var aN = gl.getAttribLocation(program, 'aN');
  var aU = gl.getAttribLocation(program, 'aU');
  var u = {
    model: gl.getUniformLocation(program, 'uModel'),
    proj: gl.getUniformLocation(program, 'uProj'),
    eye: gl.getUniformLocation(program, 'uEye'),
    color: gl.getUniformLocation(program, 'uColor'),
    mat: gl.getUniformLocation(program, 'uMat'),
    power: gl.getUniformLocation(program, 'uPower'),
    tex: gl.getUniformLocation(program, 'uTex')
  };
  gl.enableVertexAttribArray(aP);
  gl.enableVertexAttribArray(aN);
  gl.enableVertexAttribArray(aU);

  // ----------------------------------------------------------------- Matriks
  function multiply(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }

  function chain() {
    var m = arguments[0];
    for (var i = 1; i < arguments.length; i++) m = multiply(m, arguments[i]);
    return m;
  }

  function move(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }
  function rotX(t) {
    var c = Math.cos(t), s = Math.sin(t);
    return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]);
  }
  function rotY(t) {
    var c = Math.cos(t), s = Math.sin(t);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]);
  }
  var EYE = 7.5;

  function perspective(aspect) {
    var f = 1 / Math.tan(0.28);
    var near = 0.5, far = 22;
    var proj = new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]);
    return multiply(proj, move(0, 0, -EYE));
  }

  // ------------------------------------------------------------------ Adegan
  var HALF_PI = Math.PI / 2;
  var CYAN = [0.2, 0.82, 0.96];
  var NONE = [0, 0, 0];
  var MON_Y = 1.5;

  var solid = [];

  function add(m, local, mat, color) {
    solid.push({ mesh: m, local: local, mat: mat, color: color || NONE });
  }

  add(box(1.24, 0.04, 0.74, 0.1), move(0, 0, 0.12), 0);
  add(box(0.2, 0.66, 0.07, 0.03), move(0, 0.03, -0.04), 0);
  var panelAt = chain(move(0, MON_Y, 0), rotX(HALF_PI));
  add(slab(3.24, 1.88, 0.07, 0.05, 0.012, 5), panelAt, 3);
  var screenMesh = quad(-1.57, 1.57, -0.9, 0.86, 0.0712, 1);
  add(box(0.05, 0.012, 0.012, 0.004), move(1.46, MON_Y - 0.915, 0.07), 5, CYAN);

  var floor = quad(-3.6, 3.6, -2.4, 2.4, -0.002, 1);

  // ------------------------------------------------------------------- Layar
  var aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  var VW = 1024;
  var VH = 572;
  var screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1024;
  screenCanvas.height = 1024;
  var sx = screenCanvas.getContext('2d');

  var screenTex = gl.createTexture();

  function upload() {
    gl.bindTexture(gl.TEXTURE_2D, screenTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screenCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  function roundRect(px, py, w, h, r) {
    sx.beginPath();
    sx.moveTo(px + r, py);
    sx.arcTo(px + w, py, px + w, py + h, r);
    sx.arcTo(px + w, py + h, px, py + h, r);
    sx.arcTo(px, py + h, px, py, r);
    sx.arcTo(px, py, px + w, py, r);
    sx.closePath();
  }

  var MONO = '"Martian Mono", Consolas, monospace';
  var SANS = 'Archivo, Arial, sans-serif';

  var MENU_END = 1.6;
  var BOOT_END = 4.0;
  var LOGIN_END = 8.0;
  var DESK_END = 8.6;
  var TYPE_RATE = 42;

  var BOOT = [
    'Loading Linux kernel ...',
    '[  OK  ] Mounted /boot/efi',
    '[  OK  ] Started Network Manager',
    '[  OK  ] Started Firewall Service',
    '[  OK  ] Started Tor Service',
    '[  OK  ] Reached target Multi-User System',
    '[  OK  ] Started Display Manager',
    '[  OK  ] Reached target Graphical Interface'
  ];

  var PROMPT = '┌─[ricarda@parrot]─[~]';
  var TERMINAL = [
    [PROMPT, 'p'],
    ['└──╼ $whoami', 'c'],
    ['renaissance ricarda', 'o'],
    [PROMPT, 'p'],
    ['└──╼ $cat focus.txt', 'c'],
    ['full-stack · AI · cyber security', 'o'],
    [PROMPT, 'p'],
    ['└──╼ $./build && ./break', 'c'],
    ['built. now trying to break it.', 'o'],
    ['# click this screen, then type: help', 'h'],
    [PROMPT, 'p'],
    ['└──╼ $', 'c']
  ];
  var TERMINAL_CHARS = TERMINAL.reduce(function (sum, line) { return sum + line[0].length; }, 0);
  var SEQ_END = DESK_END + 0.2 + TERMINAL_CHARS / TYPE_RATE;

  // ------------------------------------------------------------- Easter egg
  var ROW = 33;
  var MAX_ROWS = 12;
  var WRAP = 50;
  var INPUT_MAX = 44;
  var canType = matchMedia('(pointer: fine)').matches;
  var term = { active: false, input: '', rows: [], past: [], back: 0, effect: '', effectEnd: 0, output: '', cwd: '' };

  function resetTerm() {
    term.active = false;
    term.input = '';
    term.rows = TERMINAL.slice(0, -2);
    term.past = [];
    term.back = 0;
    term.effect = '';
    term.output = '';
    term.cwd = '';
  }

  // Baris prompt mengikuti folder yang sedang dibuka.
  function promptRow() {
    return ['┌─[ricarda@parrot]─[~' + (term.cwd ? '/' + term.cwd : '') + ']', 'p'];
  }

  function print(text, kind) {
    // Teks di monitor adalah gambar, jadi hasil perintah disimpan untuk perintah copy.
    if (kind !== 'h') term.output += (term.output ? '\n' : '') + text;
    text.split('\n').forEach(function (line) {
      if (!line) term.rows.push(['', 'o']);
      for (var i = 0; i < line.length; i += WRAP) term.rows.push([line.slice(i, i + WRAP), kind || 'o']);
    });
  }

  function copyText(text) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (err) { done = false; }
      area.remove();
      return done;
    }

    function report(done) {
      print(done ? 'copied to clipboard.' : 'copy failed. your browser blocked it.', done ? 'c' : 'e');
      term.output = text;
      refresh();
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { report(true); }, function () { report(fallback()); });
    } else {
      report(fallback());
    }
  }

  function go(id) {
    window.setTimeout(function () {
      var el = document.querySelector(id);
      if (el) el.scrollIntoView();
    }, 600);
  }

  // Akun demo proyek Inventaris, disandikan sebagai bagian dari easter egg.
  // Ini bukan pengamanan: siapa pun yang melihat kode sumber tetap bisa membacanya.
  var HIDDEN_FILE = '.demo-accounts';
  var HIDDEN_DATA = 'aW52ZW50YXJpcyBndWRhbmcgc2Vrb2xhaCwgZGVtbyBhY2NvdW50cwpyb2xlICAgICAgdXNlcm5hbWUgICBwYXNzd29yZAptYW5hZ2VyICAgbWFuYWdlciAgICBNZXRhbW9ycGhvc2lzCm9wZXJhdG9yICBvcGVyYXRvciAgIEJhZEFwcGxl';

  // CTF mini: hanya hash yang disimpan di sini, jadi jawabannya tidak bisa dibaca dari kode.
  var CTF_HASH = 'edd5ea7a794347d1cf9fb6521006ab59403d694744331c4358a293215e6749f4';
  var ctfSolved = false;
  // Status hanya bertahan selama tab terbuka, supaya kunjungan baru mulai terkunci lagi.
  try {
    ctfSolved = sessionStorage.getItem('rr-ctf') === '1';
    localStorage.removeItem('rr-ctf');
  } catch (e) {}

  function sha256(text) {
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buffer) {
      return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
        return ('0' + byte.toString(16)).slice(-2);
      }).join('');
    });
  }

  var TIPS_DIR = 'ctf-tips';
  var TIPS_FILE = 'tips.txt';
  var TIPS = [
    '1. press ctrl+u here, find "ctf fragment 1"',
    '2. open /robots.txt, decode the base64 fragment',
    '   in the browser console: atob("...")',
    '3. type dossier, press ctrl+u, find ctf-fragment',
    '   decode rot13: shift each letter by 13',
    '4. join them: rr{one_two_three}',
    '5. back here: submit rr{...}',
    '6. your reward: ls -a'
  ].join('\n');

  var COMMANDS = {
    help: function () {
      print('whoami  about  skills  projects  contact\nls  cd  cat  neofetch  date  echo  clear  download\nmatrix  hire  cv  dossier  ctf  copy  reboot  exit');
    },
    whoami: function () { print('renaissance ricarda'); },
    about: function () { print('software engineer from indramayu, indonesia.\nbuilds web apps and AI systems, then tests them.'); },
    skills: function () { print('full-stack · AI · cyber security'); },
    projects: function () { print('inventaris   laravel 12, live demo\nA.R.O.N.A    neural assistant, python\njuara 1      web technologies, indramayu'); },
    contact: function () { print('renaissancericharda@gmail.com\ngithub.com/Noolep'); },
    ls: function (args) {
      var flags = /^-[a-z]+/.exec(args);
      var dot = flags && flags[0].indexOf('a') >= 0;
      var target = args.replace(/^-[a-z]+\s*/, '').replace(/\/$/, '');

      if (term.cwd === TIPS_DIR || target === TIPS_DIR) {
        print((dot ? '.  ..  ' : '') + TIPS_FILE);
      } else if (target) {
        print('ls: ' + target + ': no such file or folder', 'e');
      } else {
        print((dot && ctfSolved ? '.  ..  ' + HIDDEN_FILE + '\n' : '') + 'focus.txt projects/ dossier/ ' + TIPS_DIR + '/\ncv.pdf secrets.txt');
      }
    },
    cat: function (args) {
      if (args === TIPS_DIR + '/' + TIPS_FILE || (args === TIPS_FILE && term.cwd === TIPS_DIR)) print(TIPS);
      else if (term.cwd === TIPS_DIR) print('cat: ' + (args || 'missing file') + ': no such file', 'e');
      else if (args === 'focus.txt') print('full-stack · AI · cyber security');
      else if (args === 'secrets.txt') print('permission denied. earn access first: type ctf', 'e');
      else if (args === HIDDEN_FILE && ctfSolved) {
        print(HIDDEN_DATA);
        print('# encoded. a base64 tool might help. copy works.', 'h');
      }
      else if (args === 'cv.pdf') print('binary file. try: cv');
      else print('cat: ' + (args || 'missing file') + ': no such file', 'e');
    },
    neofetch: function () {
      print('user     guest@portfolio\nos       a website pretending to be parrot\nshell    js/device.js\nscreen   ' + window.innerWidth + 'x' + window.innerHeight + '\nuptime   ' + Math.round(performance.now() / 1000) + 's on this page');
    },
    date: function () { print(new Date().toString().slice(0, 24)); },
    echo: function (args) { print(args); },
    clear: function () { term.rows = []; },
    matrix: function () {
      term.effect = 'matrix';
      term.effectEnd = performance.now() + 4000;
    },
    hire: function () {
      print('excellent decision. opening contact...', 'c');
      go('#kontak');
    },
    cv: function () {
      print('downloading cv...', 'c');
      var link = document.querySelector('a[download]');
      if (link) link.click();
    },
    dossier: function () {
      print('decrypting archive RR-2026-014...', 'c');
      window.setTimeout(function () { window.location.href = 'dossier/'; }, 1200);
    },
    cd: function (args) {
      var target = args.replace(/\/$/, '');
      if (!target || target === '~' || target === '..') term.cwd = '';
      else if (term.cwd) print('cd: ' + target + ': no such folder', 'e');
      else if (target === TIPS_DIR) term.cwd = TIPS_DIR;
      else if (target === 'dossier') COMMANDS.dossier();
      else print('cd: ' + target + ': permission denied', 'e');
    },
    pwd: function () { print('/home/ricarda' + (term.cwd ? '/' + term.cwd : '')); },
    base64: function (args) {
      var match = /^(-d|--decode)\s+(\S+)$/.exec(args);
      if (!match) print('usage: base64 -d <file>', 'e');
      else if (match[2] !== HIDDEN_FILE || !ctfSolved) print('base64: ' + match[2] + ': no such file', 'e');
      else {
        print(window.atob(HIDDEN_DATA));
        print('# nice find. copy or download it. keep it tidy.', 'h');
      }
    },
    ctf: function (args) {
      if (args === 'reset') {
        ctfSolved = false;
        try { sessionStorage.removeItem('rr-ctf'); } catch (e) {}
        print('ctf reset. the reward is locked again.', 'c');
        return;
      }
      if (ctfSolved) {
        print('solved. your reward is waiting: ls -a', 'c');
        return;
      }
      print('3 fragments are hidden around this site.\njoin them: rr{one_two_three}\nsubmit with: submit rr{...}\nfirst clue: read the source of this page.\nreward: demo accounts for the inventory app.\nstuck? look around with ls.');
    },
    submit: function (args) {
      var guess = args.trim();
      if (!guess) {
        print('usage: submit rr{...}', 'e');
        return;
      }
      if (!window.crypto || !window.crypto.subtle) {
        print('submit: needs https', 'e');
        return;
      }
      print('checking...', 'h');
      sha256(guess).then(function (hash) {
        if (hash !== CTF_HASH) {
          print('wrong flag. keep digging.', 'e');
        } else {
          ctfSolved = true;
          try { sessionStorage.setItem('rr-ctf', '1'); } catch (e) {}
          print('flag accepted.', 'c');
          print('you read the source, the robots file, and an old\narchive. that is how i work too.');
          print('reward: demo accounts unlocked. try: ls -a', 'c');
          print('mention this flag when you contact me: type hire');
        }
        refresh();
      });
    },
    download: function (args) {
      if (!args) {
        print('usage: download <file>', 'e');
        return;
      }
      if (args !== HIDDEN_FILE || !ctfSolved) {
        print('download: ' + args + ': no such file', 'e');
        return;
      }
      var url = URL.createObjectURL(new Blob([window.atob(HIDDEN_DATA) + '\n'], { type: 'text/plain' }));
      var link = document.createElement('a');
      link.href = url;
      link.download = 'demo-accounts.txt';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      print('saved: demo-accounts.txt', 'c');
    },
    wget: function (args) { COMMANDS.download(args); },
    copy: function () {
      if (term.output) copyText(term.output);
      else print('copy: nothing to copy yet', 'e');
    },
    reboot: function () { reboot(); },
    exit: function () {
      print('bye.');
      term.active = false;
    }
  };

  function run(line) {
    var text = line.trim();
    term.rows.push(promptRow(), ['└──╼ $' + line, 'c']);
    if (!text) return;

    term.past.push(text);
    term.back = term.past.length;

    // Perintah copy memakai hasil perintah sebelumnya, jadi hasil itu tidak dihapus.
    var keep = term.output;
    if (text.toLowerCase() !== 'copy') term.output = '';

    if (/^(sudo\s+)?rm\s+-rf?\s+\/?\*?$/.test(text)) {
      term.effect = 'panic';
      term.effectEnd = performance.now() + 2600;
      return;
    }
    if (text.indexOf('sudo') === 0) {
      print('nice try. this incident will be reported to ricarda.', 'e');
      return;
    }

    // Bentuk pipa yang biasa dipakai di terminal asli.
    var piped = /^cat\s+(\S+)\s*\|\s*base64\s+(-d|--decode)$/.exec(text);
    if (piped) text = 'base64 -d ' + piped[1];

    var space = text.indexOf(' ');
    var name = (space < 0 ? text : text.slice(0, space)).toLowerCase();
    var args = space < 0 ? '' : text.slice(space + 1).trim();

    if (name === 'copy') term.output = keep;
    if (Object.prototype.hasOwnProperty.call(COMMANDS, name)) COMMANDS[name](args);
    else print('bash: ' + name + ': command not found. try: help', 'e');
  }

  function drawEffect() {
    if (term.effect === 'panic') {
      sx.fillStyle = '#7a0f06';
      sx.fillRect(0, 0, VW, VH);
      sx.fillStyle = '#fff';
      sx.textAlign = 'left';
      sx.textBaseline = 'top';
      sx.font = '500 21px ' + MONO;
      ['Kernel panic - not syncing:', 'attempted to delete the portfolio.', '', 'recruiters will not see this.', 'rebooting...'].forEach(function (line, i) {
        sx.fillText(line, 48, 120 + i * 40);
      });
      return;
    }

    sx.fillStyle = 'rgba(0,0,0,0.3)';
    sx.fillRect(0, 0, VW, VH);
    sx.font = '500 17px ' + MONO;
    sx.textAlign = 'left';
    sx.textBaseline = 'top';
    for (var x = 0; x < VW; x += 20) {
      if (Math.random() > 0.55) continue;
      sx.fillStyle = Math.random() > 0.8 ? '#d8ffe8' : '#4be3a0';
      sx.fillText(String.fromCharCode(0x30a0 + Math.floor(Math.random() * 90)), x, Math.floor(Math.random() * 29) * 20);
    }
  }

  function clock() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function wallpaper() {
    var bg = sx.createLinearGradient(0, 0, VW, VH);
    bg.addColorStop(0, '#04161c');
    bg.addColorStop(0.6, '#07303a');
    bg.addColorStop(1, '#0a5560');
    sx.fillStyle = bg;
    sx.fillRect(0, 0, VW, VH);

    sx.strokeStyle = 'rgba(69,214,214,0.1)';
    sx.lineWidth = 2;
    for (var i = 0; i < 6; i++) {
      sx.beginPath();
      sx.arc(860, 660, 220 + i * 76, 0, Math.PI * 2);
      sx.stroke();
    }
  }

  function drawMenu(s) {
    sx.fillStyle = '#000';
    sx.fillRect(0, 0, VW, VH);
    sx.font = '500 18px ' + MONO;
    sx.textAlign = 'left';
    sx.textBaseline = 'middle';
    sx.fillStyle = '#d7e3e6';
    sx.textAlign = 'center';
    sx.fillText('GNU GRUB', VW / 2, 54);

    sx.textAlign = 'left';
    sx.strokeStyle = '#d7e3e6';
    sx.lineWidth = 2;
    sx.strokeRect(90, 90, VW - 180, 300);
    sx.fillStyle = '#d7e3e6';
    sx.fillRect(100, 104, VW - 200, 34);
    sx.fillStyle = '#000';
    sx.fillText('Parrot Security GNU/Linux', 116, 122);
    sx.fillStyle = '#d7e3e6';
    sx.fillText('Advanced options for Parrot Security', 116, 162);

    sx.textAlign = 'center';
    sx.font = '500 15px ' + MONO;
    sx.fillText('The highlighted entry will be executed automatically in ' + Math.max(1, Math.ceil(MENU_END - s)) + 's.', VW / 2, 430);
  }

  function drawBoot(s) {
    sx.fillStyle = '#000';
    sx.fillRect(0, 0, VW, VH);
    sx.font = '500 17px ' + MONO;
    sx.textAlign = 'left';
    sx.textBaseline = 'top';
    var shown = Math.min(BOOT.length, Math.floor((s - MENU_END) * 4) + 1);
    for (var i = 0; i < shown; i++) {
      var line = BOOT[i];
      var y = 36 + i * 30;
      if (line.indexOf('[  OK  ]') === 0) {
        sx.fillStyle = '#e8ecef';
        sx.fillText('[', 36, y);
        sx.fillStyle = '#4be3a0';
        sx.fillText('  OK  ', 36 + sx.measureText('[').width, y);
        sx.fillStyle = '#e8ecef';
        sx.fillText(line.slice(7), 36 + sx.measureText('[  OK  ').width, y);
      } else {
        sx.fillStyle = '#e8ecef';
        sx.fillText(line, 36, y);
      }
    }
  }

  function drawLogin(s) {
    wallpaper();
    var t = s - BOOT_END;

    sx.textBaseline = 'middle';
    sx.textAlign = 'right';
    sx.fillStyle = '#d7e3e6';
    sx.font = '500 20px ' + SANS;
    sx.fillText(clock(), VW - 28, 28);

    sx.textAlign = 'center';
    sx.fillStyle = 'rgba(4,18,24,0.72)';
    roundRect(VW / 2 - 190, 150, 380, 276, 14);
    sx.fill();

    sx.fillStyle = '#0d7f86';
    sx.beginPath();
    sx.arc(VW / 2, 214, 38, 0, Math.PI * 2);
    sx.fill();
    sx.fillStyle = '#f3f5f6';
    sx.font = '700 28px ' + SANS;
    sx.fillText('RR', VW / 2, 215);

    sx.font = '600 24px ' + SANS;
    sx.fillText('ricarda', VW / 2, 282);

    sx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(VW / 2 - 140, 310, 280, 44, 8);
    sx.fill();
    sx.strokeStyle = t > 0.5 ? '#35c9cf' : 'rgba(255,255,255,0.25)';
    sx.lineWidth = 2;
    sx.stroke();

    var dots = Math.max(0, Math.min(10, Math.floor((t - 1.0) / 0.17)));
    sx.fillStyle = '#f3f5f6';
    for (var i = 0; i < dots; i++) {
      sx.beginPath();
      sx.arc(VW / 2 - 118 + i * 22, 332, 5, 0, Math.PI * 2);
      sx.fill();
    }

    sx.font = '500 16px ' + SANS;
    sx.fillStyle = '#9fb6bb';
    sx.fillText(t > 3.0 ? 'Signing in…' : 'Password', VW / 2, 390);

    sx.textAlign = 'left';
    sx.font = '600 20px ' + SANS;
    sx.fillStyle = '#d7e3e6';
    sx.fillText('Parrot Security', 28, VH - 30);

    if (s > LOGIN_END - 0.3) {
      sx.fillStyle = 'rgba(0,0,0,' + Math.min((s - LOGIN_END + 0.3) / 0.3, 1) + ')';
      sx.fillRect(0, 0, VW, VH);
    }
  }

  function drawDesktop() {
    wallpaper();
    sx.fillStyle = 'rgba(8,14,18,0.92)';
    sx.fillRect(0, 0, VW, 30);
    sx.textBaseline = 'middle';
    sx.textAlign = 'left';
    sx.fillStyle = '#d7e3e6';
    sx.font = '500 15px ' + SANS;
    sx.fillText('Applications     Places     System', 14, 16);
    sx.textAlign = 'right';
    sx.fillText(clock(), VW - 14, 16);
  }

  function drawTerminal(s, blink) {
    var appear = Math.min((s - DESK_END) / 0.2, 1);
    var x = 132;
    var y = 58;
    var w = 760;
    var h = 464;

    sx.globalAlpha = appear;
    sx.fillStyle = 'rgba(6,10,13,0.95)';
    roundRect(x, y, w, h, 10);
    sx.fill();
    sx.fillStyle = 'rgba(255,255,255,0.08)';
    roundRect(x, y, w, 34, 10);
    sx.fill();
    sx.fillStyle = '#d7e3e6';
    sx.font = '500 15px ' + MONO;
    sx.textAlign = 'center';
    sx.textBaseline = 'middle';
    sx.fillText(term.active ? 'ricarda@parrot: ~ (esc to leave)' : 'ricarda@parrot: ~', x + w / 2, y + 18);
    if (term.active) {
      sx.strokeStyle = '#4be3a0';
      sx.lineWidth = 2;
      roundRect(x, y, w, h, 10);
      sx.stroke();
    }

    sx.textAlign = 'left';
    sx.font = '500 21px ' + MONO;
    var ly = y + 60;
    var cx = x + 20;
    var cy = ly;
    var colors = { p: '#ff4a2e', c: '#4be3a0', o: '#f3f5f6', e: '#ff8a73', h: '#87919a' };

    function row(text, kind) {
      sx.fillStyle = colors[kind];
      sx.fillText(text, x + 20, ly);
      cx = x + 20 + sx.measureText(text).width + 3;
      cy = ly;
      ly += ROW;
    }

    if (s >= SEQ_END) {
      term.rows.concat([promptRow(), ['└──╼ $' + term.input, 'c']]).slice(-MAX_ROWS).forEach(function (line) {
        row(line[0], line[1]);
      });
    } else {
      var left = Math.floor((s - DESK_END - 0.2) * TYPE_RATE);
      TERMINAL.forEach(function (line) {
        if (left <= 0) return;
        row(line[0].slice(0, left), line[1]);
        left -= line[0].length;
      });
    }

    if (blink) {
      sx.fillStyle = '#f3f5f6';
      sx.fillRect(cx, cy - 12, 12, 24);
    }
    sx.globalAlpha = 1;
  }

  function drawScreen(s) {
    sx.setTransform(1, 0, 0, 1024 / VH, 0, 0);
    if (term.effect) {
      drawEffect();
    } else if (s < 0) {
      sx.fillStyle = '#020304';
      sx.fillRect(0, 0, VW, VH);
    } else if (s < MENU_END) {
      drawMenu(s);
    } else if (s < BOOT_END) {
      drawBoot(s);
    } else if (s < LOGIN_END) {
      drawLogin(s);
    } else {
      drawDesktop();
      if (s >= DESK_END) drawTerminal(s, term.active || s < SEQ_END || Math.floor(performance.now() / 500) % 2 === 0);
    }
    upload();
  }

  resetTerm();
  drawScreen(-1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);

  // ---------------------------------------------------------------- Render
  var FINISHED = -1;   // penanda layar langsung di terminal, tanpa urutan boot

  var building = root.classList.contains('js-build');
  var open = building ? 0 : 1;
  var hidden = building;
  var from = 0;
  var to = 1;
  var moveMs = 0;
  var moveAt = 0;
  var seqAt = building ? 0 : FINISHED;
  var screenAt = 0;
  var screenMatrix = null;
  var pointerX = 0;
  var pointerY = 0;
  var tiltX = 0;
  var tiltY = 0;
  var scrollK = 0;
  var onScreen = true;
  var raf = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  function part(m, model, mat, color) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 32, 0);
    gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 32, 12);
    gl.vertexAttribPointer(aU, 2, gl.FLOAT, false, 32, 24);
    gl.uniformMatrix4fv(u.model, false, model);
    gl.uniform1f(u.mat, mat);
    var c = color || NONE;
    gl.uniform3f(u.color, c[0], c[1], c[2]);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }

  function smooth(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function draw(now) {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    canvas.style.opacity = hidden ? 0 : smooth(0, 0.35, open);
    if (hidden) return;

    var proj = perspective(canvas.width / Math.max(canvas.height, 1));
    var yaw = -0.3 + tiltY * 0.1 + scrollK * 0.4;
    var pitch = 0.1 + tiltX * 0.05;
    var drop = (1 - smooth(0, 0.6, open)) * 0.3;
    var model = chain(move(0, -1.2 - drop, 0), rotX(pitch), rotY(yaw));

    gl.useProgram(program);
    gl.uniformMatrix4fv(u.proj, false, proj);
    gl.uniform3f(u.eye, 0, 0, EYE);
    gl.uniform1f(u.power, smooth(0.35, 0.95, open));
    gl.uniform1i(u.tex, 0);
    gl.bindTexture(gl.TEXTURE_2D, screenTex);

    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    solid.forEach(function (p) {
      part(p.mesh, multiply(model, p.local), p.mat, p.color);
    });

    part(screenMesh, multiply(model, panelAt), 2);
    screenMatrix = multiply(proj, multiply(model, panelAt));

    gl.enable(gl.BLEND);
    gl.depthMask(false);

    gl.blendFunc(gl.ONE, gl.ONE);
    part(floor, model, 8);

  }

  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function stepScreen(now) {
    if (to === 1 && open > 0.85 && seqAt === 0) seqAt = now;

    if (seqAt === 0) return;

    if (term.effect && now >= term.effectEnd) {
      var panic = term.effect === 'panic';
      term.effect = '';
      if (panic) reboot();
    }

    var s = seqAt === FINISHED ? SEQ_END + 1 : (now - seqAt) / 1000;
    var wait = term.effect ? 70 : s < SEQ_END ? 50 : 500;
    if (now - screenAt < wait) return;
    screenAt = now;
    drawScreen(s);
  }

  function loop(now) {
    raf = 0;
    if (moveMs) {
      var p = Math.min((now - moveAt) / moveMs, 1);
      open = from + (to - from) * ease(p);
      if (p >= 1) {
        moveMs = 0;
        if (to === 0) hidden = true;
      }
    }

    stepScreen(now);

    if (!reduced) {
      tiltX += (pointerY - tiltX) * 0.05;
      tiltY += (pointerX - tiltY) * 0.05;
    }

    draw(now);

    if (!reduced || moveMs || term.effect || (seqAt > 0 && now - seqAt < SEQ_END * 1000)) schedule();
  }

  function schedule() {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(loop);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      schedule();
    }).observe(canvas);
  }

  document.addEventListener('visibilitychange', schedule);

  if (!reduced && matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', function (e) {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  if (!reduced) {
    window.addEventListener('scroll', function () {
      scrollK = Math.max(0, Math.min(1, window.scrollY / window.innerHeight));
    }, { passive: true });
  }

  window.addEventListener('resize', function () {
    if (reduced) draw(performance.now());
  }, { passive: true });

  // Tulisan di layar digambar ulang setelah font selesai dimuat.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      screenAt = 0;
      if (reduced) {
        drawScreen(SEQ_END + 1);
        draw(performance.now());
      }
    });
  }

  function begin(target, ms) {
    from = open;
    to = target;
    moveAt = performance.now();
    moveMs = ms;
    schedule();
  }

  function screenOff() {
    seqAt = 0;
    resetTerm();
    drawScreen(-1);
  }

  function reboot() {
    resetTerm();
    seqAt = performance.now();
    screenAt = 0;
    schedule();
  }

  // --------------------------------------------- Mengetik di terminal monitor
  function terminalReady() {
    if (hidden || !seqAt || term.effect) return false;
    return seqAt === FINISHED || performance.now() - seqAt > SEQ_END * 1000;
  }

  function overScreen(px, py) {
    if (!screenMatrix) return false;
    var rect = canvas.getBoundingClientRect();
    var m = screenMatrix;
    var points = [[-1.57, -0.9], [1.57, -0.9], [1.57, 0.86], [-1.57, 0.86]].map(function (c) {
      var x = c[0], y = 0.0712, z = c[1];
      var w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [
        rect.left + ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * rect.width,
        rect.top + (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * rect.height
      ];
    });

    var sign = 0;
    for (var i = 0; i < 4; i++) {
      var a = points[i];
      var b = points[(i + 1) % 4];
      var side = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]);
      if (side === 0) continue;
      if (sign && (side > 0) !== (sign > 0)) return false;
      sign = side;
    }
    return true;
  }

  function refresh() {
    screenAt = 0;
    if (reduced && !term.effect && seqAt === FINISHED) {
      drawScreen(SEQ_END + 1);
      draw(performance.now());
    } else {
      schedule();
    }
  }

  if (canType) {
    var hero = canvas.closest('.hero');

    window.addEventListener('pointermove', function (e) {
      hero.classList.toggle('term-hover', terminalReady() && !e.target.closest('a, button') && overScreen(e.clientX, e.clientY));
    }, { passive: true });

    document.addEventListener('click', function (e) {
      var want = terminalReady() && !e.target.closest('a, button') && overScreen(e.clientX, e.clientY);
      if (want === term.active) return;
      term.active = want;
      refresh();
    });

    document.addEventListener('paste', function (e) {
      if (!term.active) return;
      var text = (e.clipboardData && e.clipboardData.getData('text')) || '';
      term.input = (term.input + text.replace(/\s+/g, ' ').trim()).slice(0, INPUT_MAX);
      e.preventDefault();
      refresh();
    });

    document.addEventListener('keydown', function (e) {
      if (!term.active) return;
      if (e.key === 'Tab') {
        term.active = false;
        refresh();
        return;
      }
      if (e.metaKey || e.altKey) return;

      var ctrl = e.ctrlKey;
      if (ctrl && e.key === 'l') term.rows = [];
      else if (ctrl && e.key === 'c') {
        term.rows.push(promptRow(), ['└──╼ $' + term.input + '^C', 'c']);
        term.input = '';
      } else if (ctrl) return;
      else if (e.key === 'Escape') term.active = false;
      else if (e.key === 'Enter') {
        var line = term.input;
        term.input = '';
        run(line);
      } else if (e.key === 'Backspace') term.input = term.input.slice(0, -1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        term.back = Math.max(0, Math.min(term.past.length, term.back + (e.key === 'ArrowUp' ? -1 : 1)));
        term.input = term.past[term.back] || '';
      } else if (e.key.length === 1) {
        if (term.input.length < INPUT_MAX) term.input += e.key;
      } else return;

      e.preventDefault();
      refresh();
    });
  }

  window.RRDevice = {
    reset: function () {
      open = 0;
      moveMs = 0;
      hidden = true;
      screenOff();
      draw(performance.now());
    },
    assemble: function (ms) {
      hidden = false;
      screenOff();
      begin(1, ms);
    },
    disassemble: function (ms) {
      screenOff();
      begin(0, ms);
    },
    complete: function () {
      hidden = false;
      open = 1;
      to = 1;
      moveMs = 0;
      seqAt = FINISHED;
      screenAt = 0;
      draw(performance.now());
      schedule();
    }
  };

  if (!building) drawScreen(SEQ_END + 1);
  draw(performance.now());
  schedule();
})();
