/* Validadores puros: recebem o valor (e todos os valores do form) e devolvem '' ou a mensagem de erro. */
(function (HC) {
  'use strict';

  const digits = (s) => String(s).replace(/\D/g, '');

  /** Valida os dígitos verificadores do CPF. */
  function cpfOk(d) {
    if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return dv(9) == d[9] && dv(10) == d[10];
  }

  const v = {
    digits, cpfOk,
    required: (msg = 'Campo obrigatório.') => (x) => (x ? '' : msg),
    select: (msg) => (x) => (x ? '' : msg),

    // 11 números = CPF (com dígito verificador). 7 a 10 números = RG.
    doc(x) {
      const d = digits(x);
      if (!d) return 'Informe seu CPF ou RG.';
      if (d.length === 11) return cpfOk(d) ? '' : 'CPF inválido. Confira os números.';
      if (d.length >= 7 && d.length <= 10) return '';
      return 'Digite um CPF (11 números) ou um RG (7 a 10 números).';
    },
    name(x) {
      if (!x) return 'Informe seu nome completo.';
      if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/.test(x)) return 'Use apenas letras no nome.';
      if (x.split(/\s+/).length < 2) return 'Digite nome e sobrenome.';
      return x.length > 100 ? 'Máximo de 100 caracteres.' : '';
    },
    phone(x) {
      const d = digits(x);
      if (!d) return 'Informe seu telefone.';
      if (d.length < 10 || d.length > 11) return 'Telefone incompleto. Use DDD + número.';
      if (!/^[1-9]{2}/.test(d)) return 'DDD inválido.';
      if (d.length === 11 && d[2] !== '9') return 'Celular deve começar com 9 depois do DDD.';
      return '';
    },
    email: (optional) => (x) => {
      if (!x) return optional ? '' : 'Informe seu e-mail.';
      return x.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x) ? '' : 'E-mail inválido. Ex.: nome@exemplo.com';
    },
    password(x) {
      if (x.length < 8) return 'Use pelo menos 8 caracteres.';
      return /[A-Za-z]/.test(x) && /\d/.test(x) ? '' : 'Misture letras e números.';
    },
    match: (other, msg = 'As senhas não são iguais.') => (x, all) => (x === all[other] ? '' : msg),
    pastDate(x) {
      if (!x) return 'Informe a data da última doação.';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x) || isNaN(new Date(x))) return 'Data inválida.';
      if (x > HC.u.today()) return 'A data não pode ser no futuro.';
      return x < '1980-01-01' ? 'Data muito antiga. Confira o ano.' : '';
    },
  };

  HC.v = v;
})(window.HC = window.HC || {});
