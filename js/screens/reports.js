/* Tela: Relatórios (#/relatorios) — filtros, tabela e exportação CSV. */
(function (HC) {
  'use strict';
  const { h, $, today, diffDays, fmtDate, shortName } = HC.u, { ui, api, router, data: D } = HC;

  /** Datas de última doação informadas pelos doadores no PostgreSQL; não são uma série histórica completa. */
  const allRows = () => api.donors().filter((u) => u.ultima)
    .map((u) => ({ nome: shortName(u.nome), tipo: u.tipo, data: u.ultima, status: 'Informada pelo doador' }))
    .sort((a, b) => b.data.localeCompare(a.data));

  // Evita "injeção de fórmula" ao abrir o CSV no Excel
  const csvCell = (c) => { const s = String(c), safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s; return `"${safe.replace(/"/g, '""')}"`; };

  router.add('/relatorios', {
    access: 'private', roles: ['gerente'], title: 'Relatórios',
    view: ({ user }) => ({
      html: ui.appLayout('relatorios', h`${ui.pageHeader('r', 'Relatórios', 'Consulte as últimas doações informadas pelos doadores e exporte os registros.')}
        <div class="row">
          <div><label for="rp">Período</label><select id="rp"><option value="7">Últimos 7 dias</option><option value="30" selected>Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Último ano</option></select></div>
          <div><label for="rt">Tipo sanguíneo</label><select id="rt"><option value="">Todos</option>${D.BLOOD_TYPES.map((t) => h`<option>${t}</option>`)}</select></div>
          <button class="btn sm" id="csv" type="button">Exportar CSV</button>
        </div>
        <p class="sub" id="count" aria-live="polite" style="margin-top:18px"></p>
        <div class="tbl"><table><thead><tr><th>Data</th><th>Doador</th><th>Tipo</th><th>Situação</th></tr></thead><tbody id="rows"></tbody></table></div>
        <div class="row-actions"><a class="btn sm ghost" href="#/dashboard">Voltar ao dashboard</a></div>`, user),
      mount(root) {
        const rows = () => { const p = +$('#rp', root).value, t = $('#rt', root).value; return allRows().filter((r) => diffDays(r.data, today()) <= p && (!t || r.tipo === t)); };
        const draw = () => {
          const list = rows();
          $('#count', root).textContent = `${list.length} registro(s) encontrado(s)`;
          $('#rows', root).innerHTML = String(list.length
            ? h`${list.map((r) => h`<tr><td>${fmtDate(r.data)}</td><td>${r.nome}</td><td>${r.tipo}</td><td>${ui.pill(r.status, r.status === 'Concluída' ? 'mod' : 'urg')}</td></tr>`)}`
            : h`<tr><td colspan="4">Nenhuma doação no período. Tente ampliar o filtro.</td></tr>`);
        };
        $('#rp', root).addEventListener('change', draw); $('#rt', root).addEventListener('change', draw);
        $('#csv', root).addEventListener('click', () => {
          const body = rows().map((r) => [fmtDate(r.data), r.nome, r.tipo, r.status].map(csvCell).join(';'));
          const blob = new Blob(['\ufeff' + ['Data', 'Doador', 'Tipo', 'Situação'].map(csvCell).join(';') + '\n' + body.join('\n')], { type: 'text/csv;charset=utf-8' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'relatorio-doacoes.csv'; a.click(); URL.revokeObjectURL(a.href);
          ui.toast('Relatório exportado.');
        });
        draw();
      },
    }),
  });
})(window.HC = window.HC || {});
