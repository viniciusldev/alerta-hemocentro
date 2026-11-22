/* Telas: Configurações (#/configuracoes) e Alterar senha (#/configuracoes/senha) */
(function (HC) {
  'use strict';
  const { h, $, fmtDate } = HC.u, { ui, api, router, v, mask, Form, data: D, domain } = HC;
  const shell = (user, inner) => ui.appLayout('configuracoes', inner, user);

  // Status visual de aptidão no perfil do doador (Apto / Inapto)
  const aptNote = (u) => { const e = domain.eligibility(u); return h`<div class="note" style="margin-top:0"><b>Sua aptidão para doar</b>${ui.aptPill(u)} ${e.unknown ? 'Data da última doação desconhecida. Procure o hemocentro para confirmar.' : e.apto ? 'Você já pode doar.' : `Em descanso até ${fmtDate(e.date)} (faltam ${e.dias} dias).`}</div>`; };

  const CANAIS = [['whats', 'WhatsApp', 'Alertas urgentes do seu tipo sanguíneo'], ['email', 'E-mail', 'Resumo e confirmações de agendamento'], ['sms', 'SMS', 'Somente quando não houver internet']];

  router.add('/configuracoes', {
    access: 'private', title: 'Configurações',
    view: ({ user }) => ({
      html: shell(user, h`${ui.pageHeader('g', 'Configurações', 'Atualize seus dados e escolha como quer receber os alertas.')}
        ${user.perfil === 'doador' ? aptNote(user) : ''}
        <form id="dados" novalidate><div class="grid2">
          ${ui.field({ name: 'nome', label: 'Nome completo', required: true, value: user.nome, maxlength: 100 })}
          ${ui.field({ name: 'docv', label: 'CPF ou RG', value: mask.fmtDoc(user.doc), disabled: true })}
          ${ui.field({ name: 'tel', label: 'Telefone/ Whatsapp', required: true, value: mask.fmtPhone(user.tel), inputmode: 'tel', maxlength: 16 })}
          ${ui.field({ name: 'email', label: 'E-mail (Opcional)', type: 'email', value: user.email || '' })}
          ${ui.field({ name: 'tipo', label: 'Tipo Sanguíneo', required: true, options: D.BLOOD_TYPES, value: user.tipo, placeholder: 'Selecione' })}</div>
          <p class="err" data-form-error role="alert"></p><button class="btn sm" style="margin-top:12px">Salvar alterações</button></form>

        <h2 style="margin-top:34px">Como avisar você</h2>
        ${CANAIS.map(([k, t, s]) => h`<div class="opt"><label for="c-${k}">${t}<small>${s}</small></label><input class="sw" id="c-${k}" data-canal="${k}" type="checkbox" role="switch" ${user.canais[k] ? 'checked' : ''}></div>`)}

        <h2 style="margin-top:34px">Conta</h2>
        <div class="row-actions"><a class="btn sm ghost" href="#/configuracoes/senha">Alterar senha</a>${user.perfil === 'gerente' ? h`<a class="btn sm ghost" href="#/cadastro">Cadastrar outro doador</a>` : ''}<button class="btn sm ghost" data-action="logout" type="button">Sair da conta</button></div>`),
      mount(root) {
        Form.bind($('#dados', root), {
          nome: { validate: v.name }, tel: { mask: mask.phone, validate: v.phone, normalize: v.digits },
          email: { validate: v.email(true) }, tipo: { validate: v.select('Selecione seu tipo sanguíneo.') },
        }, async (val) => {
          await api.updateUser(user.id, val); ui.toast('Alterações salvas.');
          router.go('/configuracoes');
        });
        root.querySelectorAll('[data-canal]').forEach((sw) => sw.addEventListener('change', async () => {
          sw.disabled = true;
          try {
            await api.updateUser(user.id, { canais: { ...api.currentUser().canais, [sw.dataset.canal]: sw.checked } });
            ui.toast('Preferência salva.');
          } catch (err) { sw.checked = !sw.checked; ui.toast(err.message); }
          finally { sw.disabled = false; }
        }));
      },
    }),
  });

  router.add('/configuracoes/senha', {
    access: 'private', title: 'Alterar senha',
    view: ({ user }) => ({
      html: shell(user, h`<a class="back-link" href="#/configuracoes">‹ Voltar às configurações</a>${ui.pageHeader('g', 'Alterar senha', 'Por segurança, confirme sua senha atual antes de criar a nova.')}
        <form id="senha" novalidate style="max-width:430px">
          ${ui.field({ name: 'atual', label: 'Senha atual', type: 'password', required: true, autocomplete: 'current-password' })}
          ${ui.field({ name: 'nova', label: 'Nova senha', type: 'password', required: true, placeholder: 'Mínimo de 8 caracteres, com letras e números', autocomplete: 'new-password' })}
          ${ui.field({ name: 'confirmar', label: 'Confirme a nova senha', type: 'password', required: true, autocomplete: 'new-password' })}
          <p class="err" data-form-error role="alert"></p>
          <div class="row-actions"><button class="btn">Salvar nova senha</button><a class="lk" href="#/configuracoes">Cancelar</a></div></form>`),
      mount(root) {
        Form.bind($('#senha', root), {
          atual: { validate: v.required('Informe sua senha atual.') }, nova: { validate: v.password }, confirmar: { validate: v.match('nova') },
        }, async ({ atual, nova }, { show }) => {
          if (atual === nova) return show('nova', 'Use uma senha diferente da atual.');
          await api.changePassword(atual, nova);
          ui.toast('Senha alterada com sucesso!'); router.go('/configuracoes');
        });
      },
    }),
  });
})(window.HC = window.HC || {});
