/* Tela: Dashboard do gerente (#/dashboard). Cada indicador leva para a tela correspondente
   e cada tipo sanguíneo tem a ação "Acionar alerta" (abre o lançamento já com o tipo escolhido). */
(function (HC) {
  'use strict';
  const { h } = HC.u, { ui, api, router, data: D, domain } = HC;
  const BAR_CLASS = { 'Estável': 'est', 'Alerta': 'warn', 'Crítico': 'low' };

  router.add('/dashboard', {
    access: 'private', roles: ['gerente'], title: 'Dashboard',
    view({ user }) {
      const donors = api.donors().filter((u) => u.ativo), stock = api.stock();
      const aptos = donors.filter((u) => domain.eligibility(u).apto).length;
      const criticos = D.BLOOD_TYPES.filter((t) => stock[t] === 'Crítico').length;
      const refs = Array.from({ length: 6 }, (_, i) => new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1));
      const meses = refs.map((dt) => dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''));
      const totals = refs.map((dt) => donors.filter((u) => u.ultima && u.ultima.slice(0, 7) === [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0')].join('-')).length);
      return {
        html: ui.appLayout('dashboard', h`${ui.pageHeader('c', 'Dashboard', 'Acompanhe o estoque, os alertas e as doações da rede.')}
          <div class="kpis">
            <a class="kpi" href="#/doadores"><strong>${donors.length}</strong><span>Doadores ativos</span></a>
            <a class="kpi" href="#/doadores"><strong>${aptos}</strong><span>Aptos a doar agora</span></a>
            <a class="kpi" href="#/alertas"><strong>${api.activeAlerts().length}</strong><span>Alertas ativos</span></a>
            <a class="kpi" href="#/alertas"><strong>${criticos}</strong><span>Tipos em estoque crítico</span></a>
          </div>
          <div class="grid2 two">
            <section class="panel"><h2>Estoque por tipo sanguíneo</h2>
              ${D.BLOOD_TYPES.map((t) => h`<div class="br4"><span>${t}</span><div class="tr"><i class="${BAR_CLASS[stock[t]]}" style="width:${D.STOCK_BAR[stock[t]]}%"></i></div>${ui.levelPill(stock[t])}<a class="lk" href="#/alertas/novo/${t}" aria-label="Acionar alerta para o tipo ${t}">Acionar alerta</a></div>`)}
              <div class="row-actions"><a class="btn sm ghost" href="#/alertas">Controlar estoque</a></div></section>
            <section class="panel"><h2>Últimas doações informadas (6 meses)</h2>
              <div class="cols">${totals.map((val, i) => h`<div class="col"><em>${val}</em><i style="height:${Math.max(4, val * 12)}px"></i><span>${meses[i]}</span></div>`)}</div>
              <div class="row-actions"><a class="btn sm ghost" href="#/relatorios">Ver relatório completo</a></div></section>
          </div>`, user),
      };
    },
  });

  // Rota raiz: manda cada perfil para a sua tela inicial
  router.add('/', { access: 'public', title: 'Início', view: ({ user }) => ({ redirect: user ? router.home(user) : '/login' }) });
})(window.HC = window.HC || {});
