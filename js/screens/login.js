/* Tela: Entrar no Alerta Hemocentro  (#/login) */
(function (HC) {
  'use strict';
  const { h, $ } = HC.u, { ui, api, router, v, mask, Form } = HC;

  router.add('/login', {
    access: 'guest', title: 'Entrar',
    view: () => ({
      html: ui.authLayout(h`
        <div class="hd"><div class="ic">${ui.icon('p', 44)}</div><h1>Entrar no Alerta Hemocentro</h1></div>
        <form id="login" novalidate>
          ${ui.field({ name: 'doc', label: 'CPF ou RG', required: true, placeholder: '000.000.000-00', inputmode: 'numeric', autocomplete: 'username', maxlength: 14 })}
          ${ui.field({ name: 'senha', label: 'Senha', type: 'password', required: true, placeholder: 'Digite sua senha', autocomplete: 'current-password' })}
          <a class="lk right" href="#/recuperar">Esqueci minha senha</a>
          <p class="err" data-form-error role="alert"></p>
          <button class="btn">Entrar</button>
        </form>
        <div class="join">Ainda não faz parte da nossa rede ?<a class="lk" href="#/cadastro">Cadastre-se aqui!</a></div>`),
      mount(root) {
        Form.bind($('#login', root), {
          doc: { mask: mask.doc, validate: v.doc, normalize: v.digits },
          senha: { validate: v.required('Informe sua senha.') },
        }, async ({ doc, senha }, { setError }) => {
          const r = await api.login(doc, senha);
          if (r.inactive) return setError('Conta inativa. Procure o hemocentro para reativar seu acesso.');
          if (!r.ok) return setError('CPF/RG ou senha incorretos.'); // mensagem única: não revela qual dos dois errou
          ui.toast(`Bem-vindo(a), ${r.user.nome.split(' ')[0]}!`);
          router.go(router.home(r.user)); // gerente -> dashboard · doador -> alertas
        });
      },
    }),
  });
})(window.HC = window.HC || {});
