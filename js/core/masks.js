/* Máscaras de digitação. Cada máscara pode ter input/focus/blur. O valor "limpo" é sempre só dígitos. */
(function (HC) {
  'use strict';

  const only = (s, max) => String(s).replace(/\D/g, '').slice(0, max);
  const fmtCpf = (d) => d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  const fmtDoc = (d) => (d.length === 11 ? fmtCpf(d) : d);

  function fmtPhone(value) {
    const d = only(value, 11);
    if (d.length < 3) return d;
    const r = d.slice(2), mobile = r[0] === '9';
    const head = mobile ? (r.length > 1 ? `${r[0]} ${r.slice(1, 5)}` : r[0]) : r.slice(0, 4);
    const tail = mobile ? r.slice(5) : r.slice(4);
    return `(${d.slice(0, 2)}) ${head}${tail ? '-' + tail : ''}`;
  }

  HC.mask = {
    fmtCpf, fmtDoc, fmtPhone,
    // CPF/RG: só números, no máximo 11; formata como CPF ao sair do campo.
    doc: {
      input: (el) => { el.value = only(el.value, 11); },
      focus: (el) => { el.value = only(el.value, 11); },
      blur: (el) => { el.value = fmtDoc(el.value); },
    },
    phone: { input: (el) => { el.value = fmtPhone(el.value); } },
  };
})(window.HC = window.HC || {});
