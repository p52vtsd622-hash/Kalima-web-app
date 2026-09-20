/* Kalima text search: finds real occurrences of an Arabic word (and its forms) inside
   bundled texts (Quran, Nahj al-Balagha). It only ever returns text taken from the data files. */
(function (root) {
  "use strict";

  var MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200c-\u200f\u202a-\u202e]/g;
  var STRIDE = 512; // max tokens per unit (verse / passage)

  /* Normalise ordinary (standard-spelling) Arabic: no vowel marks, one alef, one yeh. */
  function baseNorm(s) {
    return String(s == null ? "" : s)
      .replace(MARKS, "")
      .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")   // آ أ إ ٱ -> ا
      .replace(/\u0649/g, "\u064A")                         // ى -> ي
      .replace(/\u0624/g, "\u0648")                         // ؤ -> و
      .replace(/\u0626/g, "\u064A")                         // ئ -> ي
      .replace(/[^\u0621-\u064A]/g, "");                    // keep letters only
  }

  /* Uthmani spelling differs from standard spelling (dagger alef, hamza seats, small yeh...).
     Return several normalised readings of one Uthmani word so standard spellings can match. */
  function quranVariants(tok) {
    var t = tok
      .replace(/\u0648\u0670/g, "\u0627")                                   // waw + dagger alef -> alef (الصلوٰة -> الصلاة)
      .replace(/\u0640(?:\u0654([\u064E\u064F\u0650])|([\u064E\u064F\u0650])\u0654)/g, function (m, v1, v2) { // hamza on tatweel: the seat letter follows its vowel
        var v = v1 || v2;
        return v === "\u064E" ? "\u0627" : (v === "\u064F" ? "\u0648" : "\u064A");
      })
      .replace(/\u06E7/g, "\u064A");                                          // small yeh -> yeh (إبراهيم)
    var out = {};
    [t.replace(/\u0670/g, "\u0627"), t.replace(/\u0670/g, "")].forEach(function (v) {
      var n = baseNorm(v).replace(/\u0621\u0627/g, "\u0627");                  // ءا (Uthmani madd) -> ا (standard آ)
      if (!n) return;
      out[n] = 1;
      if (/\u062A$/.test(n)) out[n.slice(0, -1) + "\u0629"] = 1;            // final ت may be standard ة (رحمت -> رحمة)
    });
    return Object.keys(out);
  }

  function standardVariants(tok) {
    var n = baseNorm(tok);
    return n ? [n] : [];
  }

  function tokenize(text) { return String(text).split(/\s+/).filter(Boolean); }

  /* units: array of strings. variantFn: token -> array of normalised readings. */
  function buildIndex(units, variantFn) {
    var idx = new Map(), toks = new Array(units.length);
    for (var u = 0; u < units.length; u++) {
      var t = tokenize(units[u]);
      toks[u] = t;
      for (var k = 0; k < t.length && k < STRIDE; k++) {
        var vs = variantFn(t[k]);
        for (var j = 0; j < vs.length; j++) {
          var arr = idx.get(vs[j]);
          if (!arr) { arr = []; idx.set(vs[j], arr); }
          arr.push(u * STRIDE + k);
        }
      }
    }
    return { idx: idx, toks: toks };
  }

  var P1 = ["", "\u0648", "\u0641"];                                                   // و ف
  var P2 = ["", "\u0628", "\u0644", "\u0643", "\u0633", "\u0627\u0644", "\u0628\u0627\u0644", "\u0643\u0627\u0644", "\u0644\u0644"]; // ب ل ك س ال بال كال لل
  var SUF = ["", "\u0647", "\u0647\u0627", "\u0647\u0645", "\u0647\u0645\u0627", "\u0647\u0646", "\u0643", "\u0643\u0645", "\u0643\u0645\u0627", "\u0643\u0646", "\u0646\u064A", "\u0646\u0627", "\u064A"];

  /* All spellings a form can take once common prefixes and pronoun endings are attached. */
  var P2_VERB = ["", "\u0628", "\u0644", "\u0643", "\u0633"]; // verbs never take the article ال

  function expandForm(form, looseOnly, isVerb) {
    var f = baseNorm(form);
    if (!f) return [];
    if (f.length < 3 || looseOnly) return [f];
    var pre2 = isVerb ? P2_VERB : P2;
    var stems = {}; stems[""] = f;
    var out = {};
    for (var s = 0; s < SUF.length; s++) {
      var suf = SUF[s], variants = [f];
      if (suf) {
        if (/\u0629$/.test(f)) variants.push(f.slice(0, -1) + "\u062A");            // ة -> ت before an ending
        if (/\u064A$/.test(f)) variants.push(f.slice(0, -1) + "\u0627");            // ى -> ا before an ending
        if (/\u0648\u0627$/.test(f)) variants.push(f.slice(0, -1));                  // silent alef dropped: كتبوا -> كتبوه
      }
      for (var v = 0; v < variants.length; v++) {
        var core = variants[v] + suf;
        for (var a = 0; a < P1.length; a++)
          for (var b = 0; b < pre2.length; b++) out[P1[a] + pre2[b] + core] = 1;
      }
    }
    return Object.keys(out);
  }

  /* Find units containing any form of the word.
     forms: list of word forms (standard spelling, vowels optional).
     exactForms: forms that count as the word the user actually searched (ranked higher).
     verbForms: conjugated verb forms (they never take the article ال, which avoids false matches). */
  function findMatches(index, forms, exactForms, verbForms, exactIsVerb) {
    var keys = new Set(), exactKeys = new Set(), verbKeys = new Set();
    (forms || []).forEach(function (f) { expandForm(f).forEach(function (k) { keys.add(k); }); });
    (verbForms || []).forEach(function (f) { expandForm(f, false, true).forEach(function (k) { keys.add(k); verbKeys.add(k); }); });
    (exactForms || []).forEach(function (f) { expandForm(f, false, !!exactIsVerb).forEach(function (k) { exactKeys.add(k); keys.add(k); if (exactIsVerb) verbKeys.add(k); }); });
    var by = new Map();
    keys.forEach(function (key) {
      var occ = index.idx.get(key);
      if (!occ) return;
      var isExact = exactKeys.has(key), isVerb = verbKeys.has(key);
      for (var i = 0; i < occ.length; i++) {
        var u = (occ[i] / STRIDE) | 0, k = occ[i] % STRIDE;
        var e = by.get(u);
        if (!e) { e = { u: u, toks: {}, exact: false, v: 0, nn: 0 }; by.set(u, e); }
        if (!e.toks[k]) { e.toks[k] = 1; if (isVerb) e.v++; else e.nn++; }
        if (isExact) e.exact = true;
      }
    });
    var res = [];
    by.forEach(function (e) {
      res.push({ u: e.u, toks: Object.keys(e.toks).map(Number).sort(function (a, b) { return a - b; }), exact: e.exact, v: e.v, nn: e.nn });
    });
    return res;
  }

  /* Rank: exact form first, then real verb-form hits, then other forms, then shorter units. */
  function score(m, index) {
    return (m.exact ? 100 : 0) + Math.min(m.v, 3) * 3 + Math.min(m.nn, 3) - index.toks[m.u].length / 40;
  }
  function rank(matches, index) {
    return matches.slice().sort(function (a, b) {
      return score(b, index) - score(a, index) || a.u - b.u;
    });
  }

  root.KalimaSearch = {
    baseNorm: baseNorm, quranVariants: quranVariants, standardVariants: standardVariants,
    tokenize: tokenize, buildIndex: buildIndex, expandForm: expandForm, findMatches: findMatches, rank: rank
  };
})(typeof window !== "undefined" ? window : globalThis);
