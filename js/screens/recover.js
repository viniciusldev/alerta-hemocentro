/* Recuperação de senha: o servidor gera o código, verifica o prazo e salva um hash da nova senha.
   Em desenvolvimento sem SMTP, o código aparece somente no terminal do Node. */
(function (HC) {
  'use strict';
  const { h, $, $$ } = HC.u, { ui, api, router, v, Form } = HC;
  const rec = api.recovery;
  const wrap = (step, inner, back) => ui.authLayout(h`${ui.stepper(step)}${inner}`, { back });

  async function sendCode(email) {
    await api.recoveryStart(email);
    rec.set({ email, verified: false });
    ui.toast('Se o e-mail estiver cadastrado, o código de recuperação será enviado. No ambiente local, confira o terminal do Node.', 7000);
  }

  router.add('/recuperar', {
    access: 'guest', title: 'Recuperar senha',
    view: () => ({
      html: wrap(0, h`<h2>Recuperar senha</h2><p class="mut">Digite seu e-mail para recuperar o acesso.</p>
        <form id="f" novalidate>${ui.field({ name: 'email', label: 'Seu e-mail', type: 'email', required: true, placeholder: 'contato@exemplo.com', autocomplete: 'email', value: rec.get()?.email || '' })}
        <p class="err" data-form-error role="alert"></p><button class="btn">Continuar</button></form>
        <a class="lk" href="#/login">Voltar para o Login</a>`),
      mount(root) {
        Form.bind($('#f', root), { email: { validate: v.email(false) } }, async ({ email }) => {
          await sendCode(email);
          router.go('/recuperar/codigo');
        });
      },
    }),
  });

  router.add('/recuperar/codigo', {
    access: 'guest', title: 'Verificar código',
    view() {
      const state = rec.get(); if (!state?.email) return { redirect: '/recuperar' };
      return {
        html: wrap(1, h`<h2>Verifique o código</h2><p class="mut">Digite o código de 5 dígitos para ${state.email}. Em desenvolvimento, sem e-mail configurado, consulte o terminal do Node.</p>
          <label id="lc">Digite o código</label>
          <div class="code" role="group" aria-labelledby="lc">${[1, 2, 3, 4, 5].map((n) => h`<input inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="Dígito ${n}">`)}</div>
          <p class="err center" id="e" role="alert"></p>
          <button class="btn" id="verify" style="margin-top:8px">Verificar código</button>
          <button class="lk" id="resend" type="button" style="width:100%">Reenviar código</button>
          <a class="lk" href="#/login">Voltar para o Login</a>`, '#/recuperar'),
        mount(root) {
          const boxes = $$('.code input', root), err = $('#e', root), val = () => boxes.map((b) => b.value).join('');
          const reset = () => { boxes.forEach((b) => (b.value = '')); boxes[0].focus(); };
          boxes[0].focus();
          boxes.forEach((b, i) => {
            b.addEventListener('input', () => { b.value = b.value.replace(/\D/g, '').slice(-1); if (b.value && boxes[i + 1]) boxes[i + 1].focus(); });
            b.addEventListener('keydown', (e) => { if (e.key === 'Backspace' && !b.value && boxes[i - 1]) boxes[i - 1].focus(); });
            b.addEventListener('paste', (e) => {
              e.preventDefault();
              const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 5);
              [...digits].forEach((c, j) => (boxes[j].value = c)); boxes[Math.min(digits.length, 4)].focus();
            });
          });
          $('#verify', root).addEventListener('click', async () => {
            const code = val();
            if (code.length !== 5) { err.textContent = 'Digite os 5 dígitos do código.'; return; }
            try {
              await api.recoveryVerify(state.email, code);
              rec.set({ ...state, code, verified: true });
              router.go('/recuperar/nova-senha');
            } catch (error) { err.textContent = error.message; reset(); }
          });
          $('#resend', root).addEventListener('click', async () => {
            try { await sendCode(state.email); err.textContent = ''; reset(); }
            catch (error) { err.textContent = error.message; }
          });
        },
      };
    },
  });

  router.add('/recuperar/nova-senha', {
    access: 'guest', title: 'Nova senha',
    view() {
      const state = rec.get(); if (!state?.verified || !state.code) return { redirect: '/recuperar' };
      return {
        html: wrap(2, h`<h2>Digite sua nova senha</h2><p class="mut">Crie uma nova senha diferente da anterior.</p>
          <form id="f" novalidate>
            ${ui.field({ name: 'nova', label: 'Digite a nova senha', type: 'password', required: true, placeholder: 'Mínimo de 8 caracteres, com letras e números', autocomplete: 'new-password' })}
            ${ui.field({ name: 'confirmar', label: 'Confirme a nova senha', type: 'password', required: true, placeholder: 'Confirme a nova senha', autocomplete: 'new-password' })}
            <p class="err" data-form-error role="alert"></p><button class="btn">Salvar nova senha</button></form>`, '#/recuperar/codigo'),
        mount(root) {
          Form.bind($('#f', root), { nova: { validate: v.password }, confirmar: { validate: v.match('nova') } }, async ({ nova }) => {
            await api.recoveryReset(state.email, state.code, nova);
            rec.clear(); router.go('/recuperar/sucesso');
          });
        },
      };
    },
  });

  router.add('/recuperar/sucesso', {
    access: 'guest', title: 'Senha alterada',
    view: () => ({
      html: wrap(3, h`<div class="okc">${ui.icon('k', 64)}</div><h2 class="center" style="font-size:30px">Senha alterada com sucesso!</h2>
        <p class="mut center">Sua senha foi atualizada no banco de dados. Agora você pode acessar sua conta.</p>
        <a class="btn" href="#/login">Ir para login</a>`, '#/login'),
    }),
  });
})(window.HC = window.HC || {});
