/* Telas: Cadastro do Doador (#/cadastro) e confirmação (#/cadastro/concluido).
   Visitante: cria a própria conta. Logado: cadastra outro doador. */
(function (HC) {
  'use strict';
  const { h, $, today, fmtDate } = HC.u, { ui, api, router, v, mask, Form, data: D, domain } = HC;

  const SCHEMA = {
    nome: { validate: v.name },
    doc: { mask: mask.doc, validate: v.doc, normalize: v.digits },
    tel: { mask: mask.phone, validate: v.phone, normalize: v.digits },
    email: { validate: v.email(true) },
    tipo: { validate: v.select('Selecione seu tipo sanguíneo.') },
    ultima: { validate: (x, all) => (all.nunca || all.naosabe ? '' : v.pastDate(x)), normalize: (x) => x || null }, // null = sem data informada
    nunca: {}, naosabe: {}, // opções exclusivas: nunca doou (apto) · não sabe a data (inapto)
    senha: { validate: v.password },
    confirmar: { validate: v.match('senha') },
  };

  router.add('/cadastro', {
    access: 'public', title: 'Cadastro do Doador',
    view: ({ user }) => (user && user.perfil !== 'gerente' ? { redirect: '/alertas' } : {
      html: ui.appLayout('cadastro', h`
        ${ui.pageHeader('u', 'Cadastro do Doador', h`Informe seus dados para fazer parte da nossa rede de doadores.<br>Assim, poderemos te avisar apenas quando seu tipo sanguíneo for necessário.`)}
        <form id="cad" novalidate><div class="grid2">
          ${ui.field({ name: 'nome', label: 'Nome completo', required: true, placeholder: 'Digite o nome completo', autocomplete: 'name', maxlength: 100 })}
          ${ui.field({ name: 'doc', label: 'CPF ou RG', required: true, placeholder: '000.000.000-00', inputmode: 'numeric', maxlength: 14 })}
          ${ui.field({ name: 'tel', label: 'Telefone/ Whatsapp', required: true, placeholder: '(00) 9 9999-9999', inputmode: 'tel', autocomplete: 'tel', maxlength: 16 })}
          ${ui.field({ name: 'email', label: 'E-mail (Opcional)', type: 'email', placeholder: 'xivu@exemplo.com', autocomplete: 'email' })}
          ${ui.field({ name: 'tipo', label: 'Tipo Sanguíneo', required: true, options: D.BLOOD_TYPES, placeholder: 'Selecione seu tipo sanguíneo' })}
          <div>${ui.field({ name: 'ultima', label: 'Data da última doação', type: 'date', required: true, max: today(), min: '1980-01-01' })}
            <label class="chk" for="f-nunca" style="margin:12px 0 0"><input type="checkbox" id="f-nunca" name="nunca">Nunca doei</label>
            <label class="chk" for="f-naosabe" style="margin:8px 0 0"><input type="checkbox" id="f-naosabe" name="naosabe">Não sei quando foi a última doação</label>
            <p class="sub" style="font-size:12px;margin-top:6px">A análise de intervalo é preliminar. A aptidão para doar deve ser confirmada pelo hemocentro.</p></div>
          ${ui.field({ name: 'senha', label: 'Crie uma senha', type: 'password', required: true, placeholder: 'Mínimo de 8 caracteres, com letras e números', autocomplete: 'new-password' })}
          ${ui.field({ name: 'confirmar', label: 'Confirme a senha', type: 'password', required: true, placeholder: 'Repita a senha', autocomplete: 'new-password' })}
        </div>
        <div class="note"><b>Importante!</b>Após a doação, é necessário um período de descanso para o seu corpo se recuperar. O sistema calcula automaticamente a sua próxima data de aptidão.</div>
        <p class="err" data-form-error role="alert"></p>
        <button class="btn">Cadastrar Doador</button>
        ${user ? '' : h`<a class="lk" href="#/login">Já tenho cadastro. Entrar</a>`}</form>`, user),
      mount(root) {
        const opts = [$('#f-nunca', root), $('#f-naosabe', root)], data = $('#f-ultima', root);
        opts.forEach((o) => o.addEventListener('change', () => {
          if (o.checked) opts.forEach((x) => { if (x !== o) x.checked = false; }); // só uma das duas
          const semData = opts.some((x) => x.checked);
          data.disabled = semData; // marcou: desativa a data e limpa o erro
          if (semData) { data.value = ''; data.setAttribute('aria-invalid', 'false'); $('[data-error-for="ultima"]', root).textContent = ''; }
        }));
        Form.bind($('#cad', root), SCHEMA, async (val) => {
          const { confirmar, nunca, naosabe, ...dados } = val; // confirmação e checkboxes não são salvos como campos
          dados.ultimaInfo = nunca ? 'nunca' : naosabe ? 'desconhecida' : null;
          const novo = await api.createUser(dados);
          const e = domain.eligibility(novo);
          api.flash.set({ nome: novo.nome, proxima: e.date, apto: e.apto, unknown: !!e.unknown });
          router.go('/cadastro/concluido');
        });
      },
    }),
  });

  router.add('/cadastro/concluido', {
    access: 'public', title: 'Cadastro concluído',
    view({ user }) {
      if (user && user.perfil !== 'gerente') return { redirect: '/alertas' }; // doador logado não cadastra outros
      const f = api.flash.get(); if (!f) return { redirect: '/cadastro' };
      return {
        html: ui.appLayout('cadastro', h`<div class="center"><div class="okc">${ui.icon('k', 64)}</div>
          <h1>Cadastro realizado!</h1>
          <p class="mut">${f.nome} agora faz parte da nossa rede. ${f.apto ? 'Já está apto a doar.' : f.unknown ? 'Fica inapto até confirmar a data da última doação no hemocentro.' : `Poderá doar a partir de ${fmtDate(f.proxima)}.`}</p>
          <div class="row-actions" style="justify-content:center">
            ${user ? h`<a class="btn" href="#/alertas">Ver alertas</a><a class="btn ghost" href="#/cadastro">Cadastrar outro doador</a>` : h`<a class="btn" href="#/login">Ir para login</a>`}
          </div></div>`, user),
      };
    },
  });
})(window.HC = window.HC || {});
