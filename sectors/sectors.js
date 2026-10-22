/* سماي 2 — the sectors the course is offered in.

   The course is one set of pages. Most of it is the same for every sector; the places that speak to the
   learner's own work read their words from sectors/<slug>.js, which sets window.SAMAI_SECTOR.

   A page with sector content includes this file in its <head>. It settles the sector — ?sector=<slug> in
   the page's address, then the learner's last choice, then the first sector — and writes that sector's
   script tag, so the data is there before anything in the page reads it. The course shell opens every
   lesson with ?sector=, so a lesson always shows the sector picked in the outline, even where pages
   opened from disk cannot share storage.

   SAMAI_SECTORS.bind() then fills what the build left for it (src/lib/sector.mjs writes these):

     data-sector="… {path} …"            the element's content: literal parts are markup, {path} is the
                                          value as text (<b> kept), {=path} the value as markup
     data-sector-attrs='{"name": "…"}'   attributes, each from a template of the same kind, as plain text
     <template data-sector-each="/path">  one copy of its markup per item of a list, in its place: {key}
                                          reads the item, {.} is the item, {/path} reads from the top,
                                          {#} and {##} number it. A template inside it lists a key of the
                                          item. data-sector-repeat and data-sector-first-class as named.

   They are filled inside any other <template> too, so markup a lesson's script shows later is the sector's.
   A path is dotted, with numbers for list items ("u6l1.trends.0.title"); one ending in "?" may be missing. */
(function () {
  "use strict";

  var LIST = [{"slug":"education","name":"التعليم"},{"slug":"health","name":"الصحة"},{"slug":"hr","name":"الموارد البشرية"},{"slug":"industry","name":"الصناعة"},{"slug":"energy","name":"الطاقة"},{"slug":"justice","name":"العدل"},{"slug":"finance","name":"المالية"},{"slug":"media","name":"الإعلام"},{"slug":"sports","name":"الرياضة"},{"slug":"municipalities","name":"البلديات والإسكان"},{"slug":"transport","name":"النقل"}];
  var KEY = "samai.sector.v1";

  var known = function (slug) { return LIST.some(function (entry) { return entry.slug === slug; }); };
  var stored = function () { try { return localStorage.getItem(KEY); } catch (error) { return null; } };
  var store = function (slug) { try { localStorage.setItem(KEY, slug); } catch (error) { /* storage blocked */ } };

  var asked = (/[?&]sector=([a-z]+)/.exec(window.location.search) || [])[1];
  var current = known(asked) ? asked : known(stored()) ? stored() : LIST[0].slug;
  if (known(asked)) store(asked);

  // This file's own folder, so a page anywhere can include it by a relative path.
  var self = document.currentScript && document.currentScript.src;
  var base = self ? self.replace(/[^/]*$/, "") : "sectors/";
  document.write('<script src="' + base + current + '.js"><\/script>');

  /* ---- Binding ------------------------------------------------------------------------------------ */

  function resolve(item, key) {
    var optional = key.charAt(key.length - 1) === "?";
    if (optional) key = key.slice(0, -1);
    if (key === ".") return item;
    var top = key.charAt(0) === "/";
    var value = (top ? key.slice(1) : key).split(".").reduce(function (at, step) {
      return at == null ? at : at[step];
    }, top ? window.SAMAI_SECTOR : item);
    if (value == null && !optional) console.error("sectors/" + current + ".js has no value at " + key);
    return value == null ? "" : value;
  }

  // Sector text is trusted, and may carry <b> for emphasis; anything else in it is escaped.
  function text(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/&lt;(\/?)b&gt;/g, "<$1b>");
  }

  /** A template's text cut into [own, list, own, list, …], where each list is a whole inner template. */
  function split(template) {
    var parts = [];
    var tags = /<(\/?)template\b[^>]*>/gi;
    var depth = 0, start = 0, from = 0, match;
    while ((match = tags.exec(template))) {
      if (!match[1]) {
        if (depth === 0) { parts.push(template.slice(from, match.index)); start = match.index; }
        depth++;
      } else if (--depth === 0) {
        parts.push(template.slice(start, tags.lastIndex));
        from = tags.lastIndex;
      }
    }
    parts.push(template.slice(from));
    return parts;
  }

  /** A template's text with its placeholders filled, leaving the lists inside it for later. */
  function fill(template, item, index, asText) {
    return split(template).map(function (part, at) {
      if (at % 2) return part;
      return part.replace(/\{(=?)([^{}\s]+)\}/g, function (match, asMarkup, key) {
        if (key === "#") return String(index + 1);
        if (key === "##") return String(index + 1).padStart(2, "0");
        var value = resolve(item, key);
        return asText || asMarkup ? String(value) : text(value);
      });
    }).join("");
  }

  /** Writes out every list template under `root`, reading from `item`. */
  function lists(root, item) {
    var templates = Array.prototype.slice.call(root.querySelectorAll("template[data-sector-each]"));
    templates.forEach(function (template) {
      if (!template.parentNode) return;
      var items = resolve(item, template.getAttribute("data-sector-each"));
      var times = Number(template.getAttribute("data-sector-repeat") || 1);
      var made = document.createDocumentFragment();
      for (var round = 0; round < times; round++) {
        for (var i = 0; i < items.length; i++) {
          var holder = document.createElement("template");
          holder.innerHTML = fill(template.innerHTML, items[i], i);
          lists(holder.content, items[i]);
          made.appendChild(holder.content);
        }
      }
      var first = made.firstElementChild;
      var cls = template.getAttribute("data-sector-first-class");
      if (first && cls) first.classList.add(cls);
      template.parentNode.replaceChild(made, template);
    });
  }

  function bind(root) {
    if (!window.SAMAI_SECTOR) { console.error("No sector data loaded"); return; }
    root = root || document;
    var data = window.SAMAI_SECTOR;
    lists(root, data);

    // A template holds markup a lesson's script shows later, kept apart from the page; it is filled now too.
    Array.prototype.slice.call(root.querySelectorAll("template")).forEach(function (template) { bind(template.content); });

    // A filled element may hold more of them, so the walk goes until none is left.
    var node;
    while ((node = root.querySelector("[data-sector]"))) {
      var template = node.getAttribute("data-sector");
      node.removeAttribute("data-sector");
      if (node.tagName === "TITLE") node.textContent = fill(template, data, 0, true).replace(/<[^>]*>/g, "");
      else node.innerHTML = fill(template, data, 0);
      if (node.tagName === "TEMPLATE") bind(node.content);
    }
    Array.prototype.slice.call(root.querySelectorAll("[data-sector-attrs]")).forEach(function (element) {
      var map = JSON.parse(element.getAttribute("data-sector-attrs"));
      element.removeAttribute("data-sector-attrs");
      Object.keys(map).forEach(function (name) { element.setAttribute(name, fill(map[name], data, 0, true)); });
    });
  }

  /** Switches the course to another sector: remembered, and the page reloaded in it at the same place. */
  function choose(slug) {
    if (!known(slug) || slug === current) return;
    store(slug);
    var url = new URL(window.location.href);
    url.searchParams.set("sector", slug);
    window.location.replace(url.href);
  }

  window.SAMAI_SECTORS = { list: LIST, current: current, bind: bind, choose: choose };
})();
