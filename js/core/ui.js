/* Componentes de interface reutilizáveis (todos devolvem HTML seguro via h``). */
(function (HC) {
  'use strict';
  const { h, raw, esc, $ } = HC.u;

  const ICONS = {
    u: '<circle cx="9" cy="8" r="4"/><path d="M1 21c0-4 3-7 8-7s8 3 8 7zM19 5h2v2h2v2h-2v2h-2V9h-2V7h2z"/>',
    b: '<path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1z"/>',
    c: '<rect x="3" y="12" width="4" height="9"/><rect x="10" y="7" width="4" height="14"/><rect x="17" y="2" width="4" height="19"/>',
    r: '<path fill-rule="evenodd" d="M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 4v2h10V6zm0 4v2h10v-2zm0 4v2h6v-2z"/>',
    g: '<path fill-rule="evenodd" d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5v-2l-2.2-.6a7 7 0 0 0-.7-1.6l1.1-2-1.4-1.4-2 1.1a7 7 0 0 0-1.6-.7L13 3h-2l-.6 2.2a7 7 0 0 0-1.6.7l-2-1.1-1.4 1.4 1.1 2a7 7 0 0 0-.7 1.6L3 11v2l2.2.6c.2.6.4 1.1.7 1.6l-1.1 2 1.4 1.4 2-1.1c.5.3 1 .5 1.6.7L11 21h2l.6-2.2c.6-.2 1.1-.4 1.6-.7l2 1.1 1.4-1.4-1.1-2c.3-.5.5-1 .7-1.6z"/>',
    p: '<circle cx="12" cy="8" r="5"/><path d="M3 22c0-5 4-8 9-8s9 3 9 8z"/>',
    e: '<path fill-rule="evenodd" d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/>',
    eo: '<path fill-rule="evenodd" d="M12 5C7 5 2.7 8.1 1 12c1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8z"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    k: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
    x: '<path d="M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h6v-2H5V5h5zm5 4-1.4 1.4 2.6 2.6H9v2h7.2l-2.6 2.6L15 17l5-5z"/>',
  };
  const icon = (name, size = 24) => h`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${raw(ICONS[name])}</svg>`;

  // Logo: gota com ícone de wifi (mesma forma dos vetores enviados)
  const drop = (fill = '#ae0000', w = 52) => raw(`<svg width="${w}" viewBox="0 0 48 66" aria-hidden="true"><path fill="${fill}" d="M24 0S2 26 2 42a22 22 0 0 0 44 0C46 26 24 0 24 0z"/><path fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" d="M13 37a15 15 0 0 1 22 0M18 43a8 8 0 0 1 12 0"/><circle cx="24" cy="49" r="2.5" fill="#fff"/></svg>`);
  const logo = () => h`<div class="logo">${drop()}<div><b>Alerta</b><i>Hemocentro</i><small>Conectando doadores<br>a quem mais precisa.</small></div></div>`;
  const tag = () => h`<div class="tag"><span class="h">♥</span><div>Sua doação<br>salva vidas!<em>Juntos, podemos<br>fazer a diferença.</em></div></div>`;
  const deco = () => h`<div class="deco">${drop('#f0d6d6', 190)}</div>`;

  /** Tela dividida (login, recuperação). `back` = link da seta de voltar. */
  const authLayout = (inner, { back } = {}) => h`<main class="auth"><div class="brand">${logo()}${tag()}</div>
    <section class="pane">${back ? h`<a class="back" href="${back}" aria-label="Voltar">‹</a>` : ''}${inner}</section></main>${deco()}`;

  const NAV = [
    { key: 'cadastro', path: '/cadastro', label: 'Cadastro do Doador', icon: 'u', roles: ['gerente'] },
    { key: 'alertas', path: '/alertas', label: 'Alertas e Doações', icon: 'b', roles: ['gerente', 'doador'] },
    { key: 'doadores', path: '/doadores', label: 'Doadores', icon: 'p', roles: ['gerente'] },
    { key: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: 'c', roles: ['gerente'] },
    { key: 'relatorios', path: '/relatorios', label: 'Relatórios', icon: 'r', roles: ['gerente'] },
    { key: 'historico', path: '/historico', label: 'Histórico', icon: 'r', roles: ['doador'] },
    { key: 'configuracoes', path: '/configuracoes', label: 'Configurações', icon: 'g', roles: ['gerente', 'doador'] },
  ];
  /** Tela com menu lateral. O menu depende do perfil (gerente/doador). Sem `user`, mostra o menu de visitante. */
  const appLayout = (active, inner, user) => h`<div class="shell"><aside class="side">${logo()}
    ${user ? h`<nav aria-label="Menu principal">${NAV.filter((n) => n.roles.includes(user.perfil)).map((n) => h`<a href="#${n.path}" class="${n.key === active ? 'on' : ''}" ${raw(n.key === active ? 'aria-current="page"' : '')}>${icon(n.icon)}${n.label}</a>`)}</nav>
      <button class="out" data-action="logout">${icon('x')}Sair</button>`
    : h`<nav><a class="on" href="#/cadastro" aria-current="page">${icon('u')}Cadastro do Doador</a><a href="#/login">${icon('p')}Já tenho conta</a></nav>`}
    ${tag()}</aside><main class="main"><div class="card">${inner}</div></main></div>${deco()}`;

  const pageHeader = (ic, title, sub) => h`<div class="hd"><div class="ic">${icon(ic, 44)}</div><div><h1>${title}</h1><p class="sub">${sub}</p></div></div>`;
  const pill = (text, kind = 'mod') => h`<span class="pill ${kind}">${text}</span>`;
  const stepper = (i) => h`<div class="steps" role="img" aria-label="Etapa ${i + 1} de 4">${[0, 1, 2, 3].map((n) => h`${n ? h`<i class="ln ${n <= i ? 'done' : ''}"></i>` : ''}<span class="d ${n < i ? 'done' : n === i ? 'cur' : ''}"></span>`)}</div>`;

  const attrs = (o) => raw(Object.entries(o).filter(([, x]) => x != null && x !== false)
    .map(([k, x]) => (x === true ? k : `${k}="${esc(x)}"`)).join(' '));

  /** Campo com rótulo, controle e mensagem de erro acessível (preenchida pelo Form.bind). */
  function field({ name, label, type = 'text', required = false, options, placeholder = '', value = '', ...rest }) {
    const id = 'f-' + name;
    const common = attrs({ id, name, 'aria-describedby': id + '-err', 'aria-invalid': 'false', 'aria-required': required ? 'true' : null, 'data-secret': type === 'password' ? true : null, ...rest });
    const input = h`<input ${common} type="${type}" value="${value}" placeholder="${placeholder}">`;
    const control = options
      ? h`<select ${common}><option value="">${placeholder}</option>${options.map((o) => h`<option ${o === value ? 'selected' : ''}>${o}</option>`)}</select>`
      : type === 'password'
        ? h`<div class="pwd">${input}<button type="button" class="eye" data-toggle-pwd aria-label="Mostrar senha" aria-pressed="false"><span class="ei-on">${icon('e', 22)}</span><span class="ei-off">${icon('eo', 22)}</span></button></div>`
        : input;
    return h`<div class="field"><label for="${id}">${label}${required ? h` <span class="req" aria-hidden="true">*</span>` : ''}</label>${control}<p class="ferr" id="${id}-err" data-error-for="${name}" role="alert"></p></div>`;
  }

  let toastTimer;
  function toast(msg, ms = 3000) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }

  /** Diálogo de confirmação. Devolve Promise<boolean>. Esc e clique fora cancelam. */
  const confirm = ({ title, text, ok = 'Confirmar', cancel = 'Voltar' }) => new Promise((resolve) => {
    const prev = document.activeElement, m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = String(h`<div class="box" role="alertdialog" aria-modal="true" aria-labelledby="md-t"><h2 id="md-t">${title}</h2><p class="sub">${text}</p>
      <div class="actions"><button class="btn sm ghost" data-v="0">${cancel}</button><button class="btn sm" data-v="1">${ok}</button></div></div>`);
    const close = (val) => { m.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); resolve(val); };
    const onKey = (e) => e.key === 'Escape' && close(false);
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) close(b.dataset.v === '1'); else if (e.target === m) close(false); });
    document.addEventListener('keydown', onKey);
    document.body.append(m); m.querySelector('[data-v="1"]').focus();
  });

  // Selos de status: Apto/Inapto (doador) e nível de estoque (Estável/Alerta/Crítico)
  const aptPill = (u) => { const e = HC.domain.eligibility(u); return pill(e.apto ? 'Apto' : 'Inapto', e.apto ? 'ok' : 'no'); };
  const LEVEL_KIND = { 'Estável': 'ok', 'Alerta': 'warn', 'Crítico': 'crit' };
  const levelPill = (nivel) => pill(nivel, LEVEL_KIND[nivel]);

  /** Lista de doadores com dados de contato (nome, telefone, e-mail). Usada em Doadores e nos alertas. */
  const donorTable = (list, { status = false, empty = 'Nenhum doador encontrado.' } = {}) => h`<div class="tbl"><table>
    <thead><tr><th>Nome</th><th>Tipo</th><th>Aptidão</th><th>Telefone</th><th>E-mail</th>${status ? h`<th>Situação</th>` : ''}<th><span class="sr">Ações</span></th></tr></thead>
    <tbody>${list.length ? list.map((u) => h`<tr><td>${u.nome}</td><td>${u.tipo}</td><td>${aptPill(u)}</td><td>${HC.mask.fmtPhone(u.tel)}</td><td>${u.email || '—'}</td>${status ? h`<td>${pill(u.ativo ? 'Ativo' : 'Inativo', u.ativo ? 'mod' : 'off')}</td>` : ''}<td><a class="lk" style="margin:0" href="#/doadores/${u.id}">Perfil</a></td></tr>`) : h`<tr><td colspan="${status ? 7 : 6}">${empty}</td></tr>`}</tbody></table></div>`;

  HC.ui = { icon, logo, authLayout, appLayout, pageHeader, pill, aptPill, levelPill, donorTable, stepper, field, toast, confirm };
})(window.HC = window.HC || {});
