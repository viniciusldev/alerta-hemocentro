/* Telas do GERENTE: lista de doadores (#/doadores) e perfil do doador (#/doadores/:id).
   Aqui ficam: status Apto/Inapto, lista com dados de contato e inativar/excluir doador. */
(function (HC) {
  'use strict';
  const { h, $, fmtDate } = HC.u, { ui, api, router, v, Form, data: D, domain: d } = HC;
  const ROLE = ['gerente'];
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const maskDoc = (doc) => (doc.length === 11 ? `***.***.***-${doc.slice(-2)}` : `****${doc.slice(-2)}`); // não expõe o documento inteiro

  router.add('/doadores', {
    access: 'private', roles: ROLE, title: 'Doadores',
    view: ({ user }) => ({
      html: ui.appLayout('doadores', h`${ui.pageHeader('p', 'Doadores', 'Consulte, filtre e gerencie os doadores da rede.')}
        <div class="row">
          <div><label for="q">Buscar por nome</label><input id="q" type="search" placeholder="Digite o nome" autocomplete="off"></div>
          <div><label for="ft">Tipo sanguíneo</label><select id="ft"><option value="">Todos</option>${D.BLOOD_TYPES.map((t) => h`<option>${t}</option>`)}</select></div>
          <div><label for="fa">Aptidão</label><select id="fa"><option value="">Todos</option><option value="apto">Apto</option><option value="inapto">Inapto</option></select></div>
          <div><label for="fs">Situação</label><select id="fs"><option value="ativo">Ativos</option><option value="inativo">Inativos</option><option value="">Todos</option></select></div>
        </div>
        <p class="sub" id="count" aria-live="polite" style="margin-top:18px"></p>
        <div id="result"></div>
        <div class="row-actions"><a class="btn sm" href="#/cadastro">Cadastrar doador</a><a class="btn sm ghost" href="#/dashboard">Voltar ao dashboard</a></div>`, user),
      mount(root) {
        const draw = () => {
          const q = norm($('#q', root).value.trim()), t = $('#ft', root).value, a = $('#fa', root).value, s = $('#fs', root).value;
          const list = api.donors().filter((u) =>
            (!q || norm(u.nome).includes(q)) && (!t || u.tipo === t) &&
            (!a || (d.eligibility(u).apto ? 'apto' : 'inapto') === a) && (!s || (u.ativo ? 'ativo' : 'inativo') === s))
            .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
          $('#count', root).textContent = `${list.length} doador(es) encontrado(s)`;
          $('#result', root).innerHTML = String(ui.donorTable(list, { status: true, empty: 'Nenhum doador com esses filtros.' }));
        };
        ['#q', '#ft', '#fa', '#fs'].forEach((id) => $(id, root).addEventListener(id === '#q' ? 'input' : 'change', draw));
        draw();
      },
    }),
  });

  router.add('/doadores/:id', {
    access: 'private', roles: ROLE, title: 'Perfil do doador',
    view({ user, params }) {
      const u = api.getUser(params.id);
      if (!u || u.perfil !== 'doador') return { redirect: '/404' };
      const e = d.eligibility(u), appts = api.appts(u.id);
      return {
        html: ui.appLayout('doadores', h`<a class="back-link" href="#/doadores">‹ Voltar para doadores</a>
          <div class="hd"><div class="bt big">${u.tipo}</div><div><h1>${u.nome}</h1><p class="sub">${ui.aptPill(u)} ${ui.pill(u.ativo ? 'Ativo' : 'Inativo', u.ativo ? 'mod' : 'off')}</p></div></div>
          <dl class="facts">
            <div><dt>Aptidão</dt><dd>${e.unknown ? 'Inapto: data da última doação desconhecida' : e.apto ? 'Apto a doar' : `Inapto até ${fmtDate(e.date)}`}</dd></div>
            <div><dt>Última doação</dt><dd>${u.ultima ? fmtDate(u.ultima) : u.ultimaInfo === 'desconhecida' ? 'Não sabe informar' : 'Nunca doou'}</dd></div>
            <div><dt>Telefone / WhatsApp</dt><dd>${HC.mask.fmtPhone(u.tel)}</dd></div>
            <div><dt>E-mail</dt><dd>${u.email || '—'}</dd></div>
            <div><dt>CPF/RG</dt><dd>${maskDoc(u.doc)}</dd></div>
            <div><dt>Avisos por</dt><dd>${[u.canais.whats && 'WhatsApp', u.canais.email && 'E-mail', u.canais.sms && 'SMS'].filter(Boolean).join(', ') || 'Nenhum canal'}</dd></div>
          </dl>
          ${e.unknown ? h`<form id="conf" class="note" novalidate style="max-width:460px"><b>Confirmar última doação</b>Depois da triagem, informe a data para liberar a aptidão deste doador.
            ${ui.field({ name: 'ultima', label: 'Data da última doação', type: 'date', required: true, max: HC.u.today(), min: '1980-01-01' })}<p class="err" data-form-error role="alert"></p><button class="btn sm" style="margin-top:8px">Confirmar data</button></form>` : ''}
          <h2 style="margin-top:22px">Agendamentos</h2>
          ${appts.length ? h`<div class="tbl"><table><thead><tr><th>Data</th><th>Situação</th></tr></thead><tbody>${appts.map((a) => h`<tr><td>${fmtDate(a.data)} · ${a.hora}</td><td>${ui.pill(a.status, a.status === 'Agendada' ? 'urg' : 'off')}</td></tr>`)}</tbody></table></div>` : h`<p class="sub">Nenhum agendamento.</p>`}
          <h2 style="margin-top:22px">Gerenciar doador</h2>
          <p class="sub">Inativar bloqueia o acesso e os avisos, mas guarda os dados (pode ser desfeito). Excluir apaga o doador de vez.</p>
          <div class="row-actions"><button class="btn sm ghost" id="toggle" type="button">${u.ativo ? 'Inativar doador' : 'Reativar doador'}</button><button class="btn sm" id="del" type="button">Excluir doador</button></div>`, user),
        mount(root) {
          if (e.unknown) Form.bind($('#conf', root), { ultima: { validate: v.pastDate } }, async ({ ultima }) => {
            await api.updateUser(u.id, { ultima, ultimaInfo: null }); ui.toast('Data confirmada. Aptidão atualizada.'); router.go('/doadores/' + u.id);
          });
          $('#toggle', root).addEventListener('click', async () => {
            const ok = await ui.confirm(u.ativo
              ? { title: 'Inativar doador?', text: `${u.nome} não poderá entrar nem receberá alertas até ser reativado.`, ok: 'Inativar' }
              : { title: 'Reativar doador?', text: `${u.nome} voltará a acessar o sistema e a receber alertas.`, ok: 'Reativar' });
            if (!ok) return;
            try {
              await api.updateUser(u.id, { ativo: !u.ativo });
              ui.toast(u.ativo ? 'Doador inativado.' : 'Doador reativado.'); router.go('/doadores/' + u.id);
            } catch (err) { ui.toast(err.message); }
          });
          $('#del', root).addEventListener('click', async () => {
            const ok = await ui.confirm({ title: 'Excluir doador?', text: `Os dados e agendamentos de ${u.nome} serão apagados e não poderão ser recuperados.`, ok: 'Excluir definitivamente' });
            if (!ok) return;
            try {
              await api.deleteUser(u.id); ui.toast('Doador excluído.'); router.go('/doadores');
            } catch (err) { ui.toast(err.message); }
          });
        },
      };
    },
  });
})(window.HC = window.HC || {});
