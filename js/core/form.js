/* Ligação de formulário: máscara + validação por campo (ao sair e ao enviar) + envio sem duplicar. */
(function (HC) {
  'use strict';

  /**
   * schema = { campo: { mask?, validate?(valor, todos) => msg, normalize?(valor) } }
   * onValid(valores, { show, setError, form }) roda só se tudo estiver válido.
   */
  function bind(form, schema, onValid) {
    const keys = Object.keys(schema), el = (k) => form.elements[k];
    // checkbox -> '1'/''; campos de senha (data-secret) não sofrem trim, mesmo quando o olhinho os deixa visíveis
    const values = () => Object.fromEntries(keys.map((k) => [k, el(k).type === 'checkbox' ? (el(k).checked ? '1' : '') : 'secret' in el(k).dataset ? el(k).value : el(k).value.trim()]));
    const show = (k, msg) => { el(k).setAttribute('aria-invalid', String(!!msg)); const box = form.querySelector(`[data-error-for="${k}"]`); if (box) box.textContent = msg; };
    const setError = (msg) => { const p = form.querySelector('[data-form-error]'); if (p) p.textContent = msg; };
    const check = (k) => { const all = values(), msg = schema[k].validate?.(all[k], all) || ''; show(k, msg); return !msg; };

    keys.forEach((k) => {
      const m = schema[k].mask, input = el(k);
      input.addEventListener('input', () => {
        m?.input?.(input); input.dataset.touched = '1';
        if (input.getAttribute('aria-invalid') === 'true') check(k);
      });
      input.addEventListener('focus', () => m?.focus?.(input));
      input.addEventListener('blur', () => { m?.blur?.(input); if (input.dataset.touched || input.value) check(k); });
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); setError('');
      const ok = keys.map(check), bad = keys.find((_, i) => !ok[i]);
      if (bad) { el(bad).focus(); return; }
      const raw = values(), out = Object.fromEntries(keys.map((k) => [k, schema[k].normalize ? schema[k].normalize(raw[k]) : raw[k]]));
      const btn = form.querySelector('button:not([type=button])');
      if (btn) btn.disabled = true; // evita envio duplo
      try { await onValid(out, { show, setError, form }); }
      catch (error) { setError(error.message || 'Ocorreu um problema. Tente novamente.'); }
      finally { if (btn) btn.disabled = false; }
    });
  }

  HC.Form = { bind };
})(window.HC = window.HC || {});
