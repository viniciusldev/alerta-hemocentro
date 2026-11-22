/* Utilitários: template seguro (anti-XSS), datas e seletores. */
(function (HC) {
  'use strict';

  /** Marca um trecho de HTML como confiável (não será escapado). */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  const raw = (s) => new Raw(s);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const part = (v) => v == null || v === false ? ''
    : v instanceof Raw ? v.s
    : Array.isArray(v) ? v.map(part).join('')
    : esc(v);

  /** Tag de template: tudo que for interpolado é escapado, exceto outro h`` ou raw(). */
  const h = (strings, ...vals) =>
    new Raw(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ''), ''));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Datas sempre como 'AAAA-MM-DD' (formato do <input type="date">)
  const today = () => new Date().toLocaleDateString('sv');
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
  const diffDays = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
  const fmtDate = (iso) => iso.split('-').reverse().join('/');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /** "Maria da Silva Souza" -> "Maria S." (evita expor nome completo em relatórios) */
  const shortName = (n) => { const p = n.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };

  HC.u = { Raw, raw, esc, h, $, $$, today, addDays, diffDays, fmtDate, uid, shortName };
})(window.HC = window.HC || {});
