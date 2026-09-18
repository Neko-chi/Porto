/**
 * DOSSIER INVESTIGATION INTERACTIVE ENGINE
 * Case RR-2026-014 — Renaissance Ricarda Sugiarto Putra
 * Features:
 * - Unseal / Open Folder Cover Animation
 * - Physical Paper Stack Deck (Forward & Backward Sheet Shuffling)
 * - Touch Swipe & Keyboard Navigation
 * - Photo Evidence Inspection Modal
 * - Reactive Client OS & Device Telemetry
 * - Web Audio API Synthetic Sound Engine (Paper Rustle, Mechanical Clicks)
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. WEB AUDIO API SYNTHETIC SOUND ENGINE
  // =========================================================================
  var audioCtx = null;
  var isAudioEnabled = true; // Enabled by default for tactile dossier feedback

  function initAudio() {
    if (!audioCtx) {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Realistic paper slide / rustle sound
  function playPaperSound() {
    if (!isAudioEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      var duration = 0.16;
      var bufferSize = audioCtx.sampleRate * duration;
      var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);

      for (var i = 0; i < bufferSize; i++) {
        var progress = i / bufferSize;
        var envelope = Math.sin(progress * Math.PI) * (1 - progress * 0.4);
        data[i] = (Math.random() * 2 - 1) * envelope * 0.25;
      }

      var noise = audioCtx.createBufferSource();
      noise.buffer = buffer;

      var filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + duration);
      filter.Q.value = 1.8;

      var gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noise.start();
    } catch (e) {}
  }

  // Mechanical folder unseal thud
  function playUnsealSound() {
    if (!isAudioEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      playPaperSound();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.36);
    } catch (e) {}
  }

  // Typewriter / tick sound for stamps and redact reveals
  function playTickSound() {
    if (!isAudioEnabled) return;
    initAudio();
    if (!audioCtx) return;

    try {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  // =========================================================================
  // 2. CLIENT ENVIRONMENT TELEMETRY
  // =========================================================================
  function detectClientEnvironment() {
    var ua = navigator.userAgent || "";
    var plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    var combined = (ua + " " + plat).toLowerCase();

    var os = "Tidak teridentifikasi";
    if (/iphone|ipad|ipod/.test(combined)) os = "iOS (Apple Mobile)";
    else if (/android/.test(combined)) os = "Android OS";
    else if (/macintosh|mac os x/.test(combined)) os = "macOS";
    else if (/windows|win32|win64/.test(combined)) os = "Windows OS";
    else if (/linux/.test(combined)) os = "Linux / GNU";

    var browser = "Tidak teridentifikasi";
    if (/edg\//i.test(ua)) browser = "Microsoft Edge";
    else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = "Google Chrome";
    else if (/firefox|fxios/i.test(ua)) browser = "Mozilla Firefox";
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Apple Safari";
    else if (/opr\//i.test(ua)) browser = "Opera";

    var isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua) || (window.innerWidth <= 768);
    var deviceType = isMobile ? "Handphone / Tablet" : "Laptop / Workstation";

    var w = window.screen ? window.screen.width : window.innerWidth;
    var h = window.screen ? window.screen.height : window.innerHeight;
    var viewW = window.innerWidth;
    var viewH = window.innerHeight;

    var tz = "UTC";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "WIB/WITA/WIT";
    } catch (e) {}

    var lang = navigator.language || "id-ID";

    return {
      os: os,
      browser: browser,
      deviceType: deviceType,
      screenRes: w + " × " + h + " px",
      viewport: viewW + " × " + viewH + " px",
      timeZone: tz,
      lang: lang,
      touchSupport: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ? "Mendukung Layar Sentuh" : "Mouse & Keyboard"
    };
  }

  // =========================================================================
  // 3. APPLICATION LIFECYCLE
  // =========================================================================
  document.addEventListener('DOMContentLoaded', function () {
    var env = detectClientEnvironment();

    // 1. Update Top Banner Device Indicator
    var deviceBadge = document.getElementById('deviceIndicatorText');
    if (deviceBadge) {
      deviceBadge.textContent = env.os + " • " + env.deviceType;
    }

    // 2. Populate Telemetry on Sheet 1
    var intelContainer = document.getElementById('intelBody');
    if (intelContainer) {
      var intelRows = [
        ["STATUS SISTEM", "TERHUBUNG (OPERASIONAL)"],
        ["SISTEM OPERASI", env.os],
        ["PERANGKAT", env.deviceType],
        ["PERAMBAN", env.browser],
        ["RESOLUSI LAYAR", env.screenRes],
        ["VIEWPORT AKTIF", env.viewport],
        ["ZONA WAKTU", env.timeZone],
        ["BAHASA KLIEN", env.lang],
        ["KONTROL INPUT", env.touchSupport],
        ["LOG STAMP", new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' })]
      ];

      intelContainer.innerHTML = '';
      intelRows.forEach(function (item, idx) {
        var row = document.createElement('div');
        row.className = 'surveillance-row';
        var isHigh = (idx === 0);
        row.innerHTML = '<span class="key">' + item[0] + '</span><span class="val' + (isHigh ? ' highlight' : '') + '">' + item[1] + '</span>';
        intelContainer.appendChild(row);
      });
    }

    // 3. Audio Toggle Engine
    var audioBtn = document.getElementById('audioToggleBtn');
    if (audioBtn) {
      audioBtn.textContent = isAudioEnabled ? "AUDIO: AKTIF" : "AUDIO: MATI";
      audioBtn.style.color = isAudioEnabled ? "var(--stamp-red)" : "var(--muted)";
      audioBtn.addEventListener('click', function () {
        initAudio();
        isAudioEnabled = !isAudioEnabled;
        audioBtn.textContent = isAudioEnabled ? "AUDIO: AKTIF" : "AUDIO: MATI";
        audioBtn.style.color = isAudioEnabled ? "var(--stamp-red)" : "var(--muted)";
        if (isAudioEnabled) playTickSound();
      });
    }

    // =======================================================================
    // 4. CLOSED FOLDER OPENING ANIMATION
    // =======================================================================
    var folderIntroOverlay = document.getElementById('folderIntroOverlay');
    var unsealTriggerBtn = document.getElementById('unsealTriggerBtn');
    var closedFolderCard = document.getElementById('closedFolderCard');
    var recloseFolderBtn = document.getElementById('recloseFolderBtn');
    var sealStatusEl = document.getElementById('sealStatus');

    document.body.classList.add('cover-active');

    function openFolderDossier() {
      initAudio();
      playUnsealSound();

      if (sealStatusEl) {
        sealStatusEl.textContent = 'DIBUKA (AKSES RESMI)';
        sealStatusEl.style.color = '#15803d';
      }

      document.body.classList.remove('cover-active');

      if (folderIntroOverlay) {
        folderIntroOverlay.classList.add('animating');
        setTimeout(function () {
          folderIntroOverlay.classList.add('unsealed');
          folderIntroOverlay.classList.remove('animating');
          playPaperSound();
        }, 650);
      }
    }

    function closeFolderDossier() {
      initAudio();
      playPaperSound();
      if (sealStatusEl) {
        sealStatusEl.textContent = 'TERSEGEL';
        sealStatusEl.style.color = '';
      }
      document.body.classList.add('cover-active');
      if (folderIntroOverlay) {
        folderIntroOverlay.classList.remove('unsealed', 'animating');
        folderIntroOverlay.scrollTop = 0;
      }
    }

    if (unsealTriggerBtn) {
      unsealTriggerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openFolderDossier();
      });
    }

    if (closedFolderCard) {
      closedFolderCard.addEventListener('click', function (e) {
        // Prevent accidental open when selecting text in telemetry table
        if (e.target.closest('.cover-telemetry-panel')) return;
        openFolderDossier();
      });
      closedFolderCard.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFolderDossier();
        }
      });
    }

    if (recloseFolderBtn) {
      recloseFolderBtn.addEventListener('click', closeFolderDossier);
    }

    // =======================================================================
    // 5. PHYSICAL PAPER STACK SHUFFLING ENGINE (PINDAH KERTAS)
    // =======================================================================
    var tabButtons = document.querySelectorAll('.dossier-tab-btn');
    var sheets = document.querySelectorAll('.paper-sheet');
    var currentSheetIndex = 0;
    var isSwitching = false;

    function switchSheet(targetIndex) {
      if (targetIndex === currentSheetIndex || isSwitching) return;
      if (targetIndex < 0 || targetIndex >= sheets.length) return;

      isSwitching = true;
      var isForward = targetIndex > currentSheetIndex;
      var currentSheet = sheets[currentSheetIndex];
      var targetSheet = sheets[targetIndex];

      playPaperSound();

      // Update Tab Headers
      tabButtons.forEach(function (btn) {
        var target = parseInt(btn.getAttribute('data-target'), 10);
        if (target === targetIndex) {
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
        } else {
          btn.classList.remove('active');
          btn.setAttribute('aria-selected', 'false');
        }
      });

      // Shuffling Animation Logic:
      // When moving forward: current sheet leaves, target sheet enters from below with stackInForward
      // When moving backward: target sheet pulls from back and stacks directly on front with stackInBackward
      currentSheet.classList.remove('active');
      currentSheet.classList.add('sheet-animating-out');

      var animationClass = isForward ? 'sheet-stack-in-forward' : 'sheet-stack-in-backward';
      targetSheet.classList.remove('sheet-animating-out');
      targetSheet.classList.add(animationClass, 'active');

      setTimeout(function () {
        currentSheet.classList.remove('sheet-animating-out');
        targetSheet.classList.remove(animationClass);
        currentSheetIndex = targetIndex;
        isSwitching = false;
      }, 550);

      // Smooth scroll back to binder top if user was scrolled down
      var workspace = document.querySelector('.dossier-workspace');
      if (workspace && window.scrollY > workspace.offsetTop) {
        window.scrollTo({
          top: workspace.offsetTop - 70,
          behavior: 'smooth'
        });
      }
    }

    // Connect Tab Buttons
    tabButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = parseInt(btn.getAttribute('data-target'), 10);
        switchSheet(target);
      });
    });

    // Connect Next & Prev Buttons on each sheet
    var nextBtns = document.querySelectorAll('.next-sheet-btn');
    var prevBtns = document.querySelectorAll('.prev-sheet-btn');

    nextBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchSheet(currentSheetIndex + 1);
      });
    });

    prevBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchSheet(currentSheetIndex - 1);
      });
    });

    // Keyboard Arrow Keys Navigation (Left / Right arrow)
    document.addEventListener('keydown', function (e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (folderIntroOverlay && !folderIntroOverlay.classList.contains('unsealed')) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentSheetIndex < sheets.length - 1) {
          switchSheet(currentSheetIndex + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentSheetIndex > 0) {
          switchSheet(currentSheetIndex - 1);
        }
      }
    });

    // Touch Swipe Gesture Navigation on Mobile Devices
    var touchStartX = 0;
    var touchStartY = 0;
    var paperDeck = document.getElementById('paperStackDeck');

    if (paperDeck) {
      paperDeck.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      paperDeck.addEventListener('touchend', function (e) {
        var touchEndX = e.changedTouches[0].screenX;
        var touchEndY = e.changedTouches[0].screenY;
        var diffX = touchStartX - touchEndX;
        var diffY = touchStartY - touchEndY;

        // Ensure horizontal swipe is dominant and significant (> 50px)
        if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
          if (diffX > 0) {
            // Swiped left -> Next sheet
            if (currentSheetIndex < sheets.length - 1) {
              switchSheet(currentSheetIndex + 1);
            }
          } else {
            // Swiped right -> Prev sheet
            if (currentSheetIndex > 0) {
              switchSheet(currentSheetIndex - 1);
            }
          }
        }
      }, { passive: true });
    }

    // =======================================================================
    // 6. PHOTO EVIDENCE INSPECTION MODAL (LIGHTBOX)
    // =======================================================================
    var photoCard = document.getElementById('inspectPhotoCard');
    var photoModal = document.getElementById('photoModal');
    var modalCloseBtn = document.getElementById('modalCloseBtn');

    function openPhotoModal() {
      initAudio();
      playPaperSound();
      if (photoModal) {
        photoModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closePhotoModal() {
      playTickSound();
      if (photoModal) {
        photoModal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    if (photoCard) {
      photoCard.addEventListener('click', openPhotoModal);
      photoCard.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPhotoModal();
        }
      });
    }

    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closePhotoModal);
    }

    if (photoModal) {
      photoModal.addEventListener('click', function (e) {
        if (e.target === photoModal) {
          closePhotoModal();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && photoModal && photoModal.classList.contains('active')) {
        closePhotoModal();
      }
    });

    // =======================================================================
    // 7. REDACTED CLASSIFIED TEXT (INTERACTIVE REVEAL)
    // =======================================================================
    var redactElements = document.querySelectorAll('.redact');
    redactElements.forEach(function (el) {
      el.addEventListener('click', function () {
        playTickSound();
        el.classList.toggle('revealed');
      });
    });

    // =======================================================================
    // 7B. COMPACT NAVIGATION HINT TOGGLE (EXCLAMATION MARK WIDGET)
    // =======================================================================
    var navHintToggleBtn = document.getElementById('navHintToggleBtn');
    var navHintWrapper = document.getElementById('navHintWrapper');

    if (navHintToggleBtn && navHintWrapper) {
      navHintToggleBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        playTickSound();
        var isOpen = navHintWrapper.classList.toggle('open');
        navHintToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Close popover when clicking anywhere outside
      document.addEventListener('click', function (e) {
        if (navHintWrapper.classList.contains('open') && !navHintWrapper.contains(e.target)) {
          navHintWrapper.classList.remove('open');
          navHintToggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // =======================================================================
    // 8. CONTACT DISPATCH FORM SUBMISSION (WITH CUSTOM SUBJECT & FALLBACK)
    // =======================================================================
    var dispatchForm = document.getElementById('contactDispatchForm');
    var dispatchStatus = document.getElementById('dispatchFormStatus');
    var dispatchKey = document.getElementById('web3FormsKey');
    var senderTopicSelect = document.getElementById('senderTopic');
    var customTopicGroup = document.getElementById('customTopicGroup');
    var customTopicInput = document.getElementById('customTopicInput');

    // Dynamic show/hide custom subject field when 'Lainnya' is chosen
    if (senderTopicSelect && customTopicGroup) {
      senderTopicSelect.addEventListener('change', function () {
        playTickSound();
        if (senderTopicSelect.value === 'Lainnya') {
          customTopicGroup.style.display = 'flex';
          if (customTopicInput) {
            customTopicInput.focus();
            customTopicInput.required = true;
          }
        } else {
          customTopicGroup.style.display = 'none';
          if (customTopicInput) {
            customTopicInput.required = false;
          }
        }
      });
    }

    if (dispatchForm) {
      dispatchForm.addEventListener('submit', function (e) {
        playTickSound();
        var keyVal = dispatchKey ? dispatchKey.value.trim() : "";

        var name = document.getElementById('senderName').value;
        var email = document.getElementById('senderEmail').value;
        var topic = senderTopicSelect ? senderTopicSelect.value : "Lainnya";
        if (topic === 'Lainnya' && customTopicInput && customTopicInput.value.trim() !== '') {
          topic = customTopicInput.value.trim();
        }
        var msg = document.getElementById('senderMessage').value;

        // Fallback to mailto if access key is still the template placeholder
        if (!keyVal || keyVal === 'YOUR_ACCESS_KEY_HERE') {
          e.preventDefault();
          var mailtoSubject = encodeURIComponent("[" + topic + "] Transmisi dari " + name);
          var mailtoBody = encodeURIComponent("Nama Pengirim: " + name + "\nEmail: " + email + "\nTopik: " + topic + "\n\nIsi Pesan:\n" + msg);
          var mailtoUrl = "mailto:renaissancericharda@gmail.com?subject=" + mailtoSubject + "&body=" + mailtoBody;

          if (dispatchStatus) {
            dispatchStatus.textContent = "TRANSMISI DIALIHKAN KE KLIEN EMAIL...";
            dispatchStatus.style.color = "var(--stamp)";
          }

          window.location.href = mailtoUrl;
          return;
        }

        // Standard Web3Forms async submission if configured with valid key
        e.preventDefault();
        var submitBtn = document.getElementById('dispatchSubmitBtn');
        if (submitBtn) submitBtn.disabled = true;
        if (dispatchStatus) {
          dispatchStatus.textContent = "MENGIRIM TRANSMISI TERENKRIPSI...";
          dispatchStatus.style.color = "var(--muted)";
        }

        var formData = new FormData(dispatchForm);
        formData.set('subject', "[" + topic + "] Transmisi dari " + name);
        formData.set('topic', topic);

        fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData
        })
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data.success) {
              if (dispatchStatus) {
                dispatchStatus.textContent = "TRANSMISI BERHASIL DITERIMA & DIARSIPKAN!";
                dispatchStatus.style.color = "#15803d";
              }
              dispatchForm.reset();
              if (customTopicGroup) customTopicGroup.style.display = 'none';
            } else {
              throw new Error(data.message || "Gagal mengirim.");
            }
          })
          .catch(function () {
            if (dispatchStatus) {
              dispatchStatus.textContent = "GAGAL KIRIM: BERALIH KE EMAIL RESMI...";
              dispatchStatus.style.color = "var(--stamp)";
            }
            // Fallback to mailto
            window.location.href = "mailto:renaissancericharda@gmail.com?subject=" + encodeURIComponent("[" + topic + "] " + name) + "&body=" + encodeURIComponent(name + ":\n" + msg);
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    }

    // Sync on resize
    window.addEventListener('resize', function () {
      var currentEnv = detectClientEnvironment();
      if (deviceBadge) {
        deviceBadge.textContent = currentEnv.os + " • " + currentEnv.deviceType;
      }
    }, { passive: true });
  });
})();
