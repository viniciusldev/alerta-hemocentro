/* Carrega os dados do PostgreSQL via API antes de abrir as telas. */
(function (HC) {
  'use strict';
  document.addEventListener('click', async (e) => {
    const eye = e.target.closest('[data-toggle-pwd]');
    if (eye) {
      const input = eye.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
      return;
    }
    const el = e.target.closest('[data-action]');
    if (el && el.dataset.action === 'logout') {
      el.disabled = true;
      try {
        await HC.api.logout();
        HC.ui.toast('Você saiu da conta.');
        HC.router.go('/login');
      } catch (err) {
        HC.ui.toast(err.message);
        el.disabled = false;
      }
    }
  });

  (async () => {
    const root = document.getElementById('app');
    root.innerHTML = '<main style="padding:3rem;font-family:sans-serif;text-align:center">Conectando ao servidor...</main>';
    try {
      await HC.api.refresh();
      HC.router.start();
    } catch (error) {
      root.textContent = 'Não foi possível carregar o Alerta Hemocentro. ' + error.message;
      const btn = document.createElement('button');
      btn.textContent = 'Tentar novamente';
      btn.style.margin = '20px';
      btn.addEventListener('click', () => location.reload());
      root.appendChild(document.createElement('br'));
      root.appendChild(btn);
    }
  })();
})(window.HC = window.HC || {});
