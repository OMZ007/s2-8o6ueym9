/* ==========================================================================
   سماي 2 — the script every page carries
   The page arrives built; this makes it behave. It runs at the end of <body>, before the lesson's own
   script, and does the same for every page:

     1. binds the learner's sector into the page (runtime/sectors.js)
     2. the chrome: fullscreen, the tabs and the reading progress, sections revealed as they arrive
     3. what a page tells the course shell around it, and where the learner had read to

   It also hands lessons a few helpers on window.SAMAI.
   ========================================================================== */
(function () {
  "use strict";

  var body = document.body;
  var PAGE = { unit: Number(body.dataset.unit), lesson: Number(body.dataset.lesson) };

  var DIGITS = "٠١٢٣٤٥٦٧٨٩";
  /** A number in Arabic-Indic digits. */
  function arabic(value) {
    return String(value).replace(/\d/g, function (digit) { return DIGITS[Number(digit)]; });
  }

  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- 1 · Sector --------------------------------------------------------------------------------- */

  if (window.SAMAI_SECTORS) window.SAMAI_SECTORS.bind(document);

  /* ---- 2 · Chrome --------------------------------------------------------------------------------- */

  function initFullscreen() {
    var button = document.querySelector(".fullscreen");
    if (!button) return;
    var root = document.documentElement;
    var active = function () { return Boolean(document.fullscreenElement || document.webkitFullscreenElement); };
    var sync = function () {
      var on = active();
      var label = on ? button.dataset.exit : button.dataset.enter;
      button.setAttribute("aria-label", label);
      button.title = label + " (F)";
      button.innerHTML = '<i class="fa-solid fa-' + (on ? "compress" : "expand") + '"></i>';
    };
    var toggle = function () {
      if (active()) (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen || function () {}).call(root);
    };
    button.addEventListener("click", toggle);
    document.addEventListener("keydown", function (event) {
      if (event.key !== "f" && event.key !== "F" && event.key !== "ب") return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      var target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      toggle();
    });
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
  }

  /**
   * Lights the tab of the section being read and fills the progress bar. A section without a tab of
   * its own leaves the tab before it lit (the first one, for the opening), unless it names one in
   * data-lights.
   */
  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
    var sections = Array.prototype.slice.call(document.querySelectorAll("main > .section"));
    var bar = document.querySelector(".progress");
    var targets = tabs.map(function (tab) { return tab.dataset.target; });
    var first = targets[0];

    var update = function () {
      var line = window.innerHeight * 0.45;
      var current = first;
      sections.forEach(function (section) {
        var target = section.dataset.lights || section.id;
        if (section.getBoundingClientRect().top <= line && targets.indexOf(target) >= 0) current = target;
      });
      tabs.forEach(function (tab) { tab.classList.toggle("active", tab.dataset.target === current); });
      if (bar) {
        var scrollable = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.width = (scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 100) + "%";
      }
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  function initReveal() {
    var sections = Array.prototype.slice.call(document.querySelectorAll("main > .section"));
    if (!("IntersectionObserver" in window) || REDUCED_MOTION) {
      sections.forEach(function (section) { section.classList.add("in-view"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* ---- 3 · The shell around the page -------------------------------------------------------------- */

  /**
   * What a page inside the course shell tells it: that the learner touched it (the shell folds its
   * outline away), and how far a lesson has been read — past the opening it is being read, and once
   * the summary shows it has been read to the end. The page reports rather than being watched because
   * pages opened from disk do not share an origin with the shell; a message crosses that line.
   * A lesson the learner must finish, not only read, marks its summary data-locked: until the lesson takes
   * the mark away and says so ("samai:unlocked" on the document), reaching the summary is still reading.
   */
  function initReport() {
    if (window.parent === window) return;
    var post = function (message) { window.parent.postMessage(message, "*"); };

    var last = 0;
    var touch = function () {
      var now = Date.now();
      if (now - last < 250) return;
      last = now;
      post({ samai: "touched" });
    };
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("scroll", touch, { passive: true });

    var opening = document.querySelector("main > .opening");
    var summary = document.getElementById("summary");
    if (!PAGE.lesson || !opening || !summary) return;

    var said = "";
    var report = function () {
      var height = window.innerHeight;
      var state = summary.getBoundingClientRect().top < height ? "done"
        : opening.getBoundingClientRect().bottom <= height * 0.5 ? "doing" : "none";
      if (state === "done" && summary.hasAttribute("data-locked")) state = "doing";
      if (state === said) return;
      said = state;
      post({ samai: "reading", module: PAGE.unit, lesson: PAGE.lesson, state: state });
    };
    window.addEventListener("scroll", report, { passive: true });
    window.addEventListener("resize", report, { passive: true });
    document.addEventListener("samai:unlocked", report);
    report();
  }

  /**
   * Where the learner had read to, kept for as long as the tab is open, so a refresh puts the page back.
   * The shell loads lessons by script, and a scripted navigation restores nothing by itself.
   */
  function initScroll() {
    var key = "samai.scroll.u" + PAGE.unit + "l" + PAGE.lesson;
    var saved = 0;
    try { saved = Number(sessionStorage.getItem(key)) || 0; } catch (error) { return; }
    var keep = function () { try { sessionStorage.setItem(key, String(Math.round(window.scrollY))); } catch (error) { /* blocked */ } };
    var last = 0;
    window.addEventListener("scroll", function () {
      var now = Date.now();
      if (now - last < 250) return;
      last = now;
      keep();
    }, { passive: true });
    window.addEventListener("pagehide", keep);
    if (saved < 1) return;
    window.addEventListener("load", function () {
      if (window.scrollY >= 1) return;
      var furthest = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, Math.min(saved, furthest)), behavior: "instant" });
    }, { once: true });
  }

  /* ---- 4 · Example files -------------------------------------------------------------------------- */

  /**
   * A file an example works on (data-download="assets/files/…") can be saved, under its own name
   * (data-download-name). The path comes from the sector, and a sector without the file leaves it empty,
   * so the file shows as a name only. A page opened from disk may not be allowed to save it, and then the
   * file opens in a tab of its own instead.
   */
  function initDownloads() {
    var files = [].slice.call(document.querySelectorAll("[data-download]")).filter(function (el) { return el.dataset.download; });
    files.forEach(function (el) {
      el.classList.add("in-file");
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("title", "تحميل الملف");
      el.insertAdjacentHTML("beforeend", '<i class="fa-solid fa-download in-dl" aria-hidden="true"></i>');
    });
    var save = function (event) {
      var el = event.target.closest && event.target.closest(".in-file[data-download]");
      if (!el || (event.type === "keydown" && event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      var link = document.createElement("a");
      link.href = el.dataset.download;
      link.download = el.dataset.downloadName || "";
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    };
    document.addEventListener("click", save);
    document.addEventListener("keydown", save);
  }

  initFullscreen();
  initTabs();
  initReveal();
  initReport();
  initScroll();
  initDownloads();

  window.SAMAI = { page: PAGE, arabic: arabic, reducedMotion: REDUCED_MOTION };
})();
