/**
 * Perilaku halaman: bahasa, menu, penanda section aktif, dan formulir kontak.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var CONTACT_EMAIL = 'renaissancericharda@gmail.com';

  // ---------------------------------------------------------------- Bahasa
  var dict = window.RRI18n;
  var keyed = Array.prototype.slice.call(document.querySelectorAll('[data-i18n]'));
  var ariaKeyed = Array.prototype.slice.call(document.querySelectorAll('[data-i18n-aria]'));
  var altKeyed = Array.prototype.slice.call(document.querySelectorAll('[data-i18n-alt]'));
  var metaDesc = document.querySelector('meta[name="description"]');

  // Teks Indonesia diambil dari HTML, jadi hanya ada satu sumber untuk bahasa ini.
  var original = {
    html: keyed.map(function (el) { return el.innerHTML; }),
    aria: ariaKeyed.map(function (el) { return el.getAttribute('aria-label'); }),
    alt: altKeyed.map(function (el) { return el.getAttribute('alt'); }),
    title: document.title,
    desc: metaDesc ? metaDesc.getAttribute('content') : ''
  };

  function pick(key, fallback, lang) {
    if (lang === 'en' && dict.en[key] !== undefined) return dict.en[key];
    return fallback;
  }

  function applyLang(lang) {
    keyed.forEach(function (el, i) {
      el.innerHTML = pick(el.getAttribute('data-i18n'), original.html[i], lang);
    });
    ariaKeyed.forEach(function (el, i) {
      el.setAttribute('aria-label', pick(el.getAttribute('data-i18n-aria'), original.aria[i], lang));
    });
    altKeyed.forEach(function (el, i) {
      el.setAttribute('alt', pick(el.getAttribute('data-i18n-alt'), original.alt[i], lang));
    });
    document.title = pick('meta.title', original.title, lang);
    if (metaDesc) metaDesc.setAttribute('content', pick('meta.desc', original.desc, lang));
    root.lang = lang;

    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang') === lang));
    });
    document.dispatchEvent(new CustomEvent('rr:lang'));
  }

  window.RRLang = function () {
    return dict.dynamic[root.lang === 'en' ? 'en' : 'id'];
  };

  document.querySelectorAll('[data-lang]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.getAttribute('data-lang');
      if (lang === root.lang) return;
      // Teks yang sedang diketik atau dihapus harus selesai dulu sebelum isinya diganti.
      if (window.RRBuild) window.RRBuild.finish();
      try { localStorage.setItem('rr-lang', lang); } catch (e) {}
      applyLang(lang);
    });
  });

  if (root.lang === 'en') applyLang('en');
  else applyLang('id');

  // ------------------------------------------------------------------ Menu
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  function setMenu(open) {
    navLinks.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    var words = window.RRLang();
    navToggle.setAttribute('aria-label', open ? words.menuClose : words.menuOpen);
  }

  navToggle.addEventListener('click', function () {
    setMenu(!navLinks.classList.contains('is-open'));
  });

  navLinks.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && navLinks.classList.contains('is-open')) {
      setMenu(false);
      navToggle.focus();
    }
  });

  // ------------------------------------------------- Penanda section aktif
  var links = Array.prototype.slice.call(navLinks.querySelectorAll('a'));
  var linkFor = {};
  links.forEach(function (a) { linkFor[a.getAttribute('href').slice(1)] = a; });

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linkFor[entry.target.id];
        if (!link || !entry.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        link.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(linkFor).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  // -------------------------------------------------------------- Formulir
  var form = document.getElementById('contactForm');
  var statusEl = document.getElementById('formStatus');
  var keyInput = document.getElementById('web3FormsKey');
  var topicSelect = document.getElementById('senderTopic');
  var customGroup = document.getElementById('customTopicGroup');
  var customInput = document.getElementById('customTopicInput');
  var submitBtn = document.getElementById('formSubmit');

  function setStatus(text, state) {
    statusEl.textContent = text;
    statusEl.setAttribute('data-state', state || '');
  }

  topicSelect.addEventListener('change', function () {
    var isOther = topicSelect.value === 'Lainnya';
    customGroup.hidden = !isOther;
    customInput.required = isOther;
    if (isOther) customInput.focus();
  });

  function mailtoUrl(name, email, topic, msg) {
    var words = window.RRLang();
    return 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(words.subject(topic, name)) +
      '&body=' + encodeURIComponent(words.body(name, email, topic, msg));
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var words = window.RRLang();
    var name = document.getElementById('senderName').value;
    var email = document.getElementById('senderEmail').value;
    var msg = document.getElementById('senderMessage').value;
    var topic = topicSelect.value;
    if (topic === 'Lainnya' && customInput.value.trim()) topic = customInput.value.trim();

    var key = keyInput.value.trim();

    // Selama access key Web3Forms belum diisi, formulir memakai aplikasi email pengunjung.
    if (!key || key === 'YOUR_ACCESS_KEY_HERE') {
      setStatus(words.mailto);
      window.location.href = mailtoUrl(name, email, topic, msg);
      return;
    }

    submitBtn.disabled = true;
    setStatus(words.sending);

    var data = new FormData(form);
    data.set('subject', words.subject(topic, name));
    data.set('topic', topic);

    fetch('https://api.web3forms.com/submit', { method: 'POST', body: data })
      .then(function (res) { return res.json(); })
      .then(function (result) {
        if (!result.success) throw new Error(result.message || 'send failed');
        setStatus(words.sent, 'ok');
        form.reset();
        customGroup.hidden = true;
        customInput.required = false;
      })
      .catch(function () {
        setStatus(words.failed, 'error');
        window.location.href = mailtoUrl(name, email, topic, msg);
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });
})();
