/* Tela: página não encontrada (#/404) */
(function (HC) {
  'use strict';
  const { h } = HC.u, { ui, router } = HC;
  router.add('/404', {
    access: 'public', title: 'Página não encontrada',
    view: () => ({
      html: ui.authLayout(h`<div class="okc" style="font-size:44px;font-weight:600">404</div>
      <h2 class="center">Página não encontrada</h2><p class="mut center">O endereço não existe ou foi removido.</p><a class="btn" href="#/login">Voltar ao início</a>`)
    }),
  });
})(window.HC = window.HC || {});
