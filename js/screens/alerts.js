/* Telas do DOADOR em "Alertas e Doações":
   #/alertas → #/alertas/:id → #/agendar/:id → #/agendamento/:id  ·  #/historico
   (O gerente tem o painel próprio em manager-alerts.js, mesma rota, outro perfil.) */
(function (HC) {
  'use strict';
  const { h, $, $$, today, fmtDate } = HC.u, { ui, api, router, v, Form, data: D, domain: d } = HC;
  const ROLE = ['doador'];

  const shell = (user, inner) => ui.appLayout('alertas', inner, user);
  const back = (href, text) => h`<a class="back-link" href="${href}">‹ ${text}</a>`;
  const urgPill = (a) => ui.pill(a.nivel === 'urgente' ? 'Urgente' : 'Moderado', a.nivel === 'urgente' ? 'urg' : 'mod');
  const statusPill = (s) => ui.pill(s, s === 'Concluída' ? 'mod' : s === 'Agendada' ? 'urg' : 'off');
  const eligNote = (u) => {
    const e = d.eligibility(u);
    if (e.unknown) return h`<div class="note" style="margin-top:0"><b>Aptidão não confirmada</b>Aptidão: ${ui.aptPill(u)} · Tipo ${u.tipo} · você não informou a data da última doação. Procure o hemocentro para confirmar e liberar sua doação.</div>`;
    return h`<div class="note" style="margin-top:0"><b>${e.apto ? 'Você já está apto a doar' : 'Você está em período de descanso'}</b>Aptidão: ${ui.aptPill(u)} · Tipo ${u.tipo} · próxima data de aptidão: ${fmtDate(e.date)}${e.apto ? '' : ` (faltam ${e.dias} dias)`}</div>`;
  };

  const card = (u, a) => {
    const why = d.reason(u, a), mine = api.activeAppt(u.id, a.id);
    return h`<article class="al ${d.canHelp(u, a) ? '' : 'off'}"><div class="bt">${a.tipo}</div>
      <div><strong>Faltam ${a.faltam} bolsas · Prazo: ${d.deadlineLabel(a)}</strong><span class="s">${D.LOCAL.nome}</span>${why ? h`<span class="s why">${why}</span>` : ''}</div>
      ${urgPill(a)}
      <div class="acts">${mine ? h`<a class="btn sm" href="#/agendamento/${mine.id}">Ver agendamento</a>` : !why ? h`<a class="btn sm" href="#/agendar/${a.id}">Quero doar</a>` : ''}<a class="lk" href="#/alertas/${a.id}">Detalhes</a></div></article>`;
  };

  // Lista de alertas ativos
  router.add('/alertas', {
    access: 'private', roles: ROLE, title: 'Alertas e Doações',
    view({ user }) {
      const alerts = api.activeAlerts();
      return {
        html: shell(user, h`${ui.pageHeader('b', 'Alertas e Doações', 'Veja quando o hemocentro precisa do seu tipo sanguíneo e agende sua doação.')}
          ${eligNote(user)}
          <label class="chk"><input type="checkbox" id="only">Mostrar só os alertas que combinam com meu tipo</label>
          <div>${alerts.length ? alerts.map((a) => card(user, a)) : h`<p class="mut">Nenhum alerta ativo no momento. Avisaremos você assim que o hemocentro precisar do seu tipo.</p>`}</div>
          <div class="row-actions"><a class="btn sm ghost" href="#/historico">Ver meu histórico</a></div>`),
        mount(root) { $('#only', root).addEventListener('change', (e) => $$('.al.off', root).forEach((el) => (el.hidden = e.target.checked))); },
      };
    },
  });

  // Detalhe do alerta
  router.add('/alertas/:id', {
    access: 'private', roles: ROLE, title: 'Detalhes do alerta',
    view({ user, params }) {
      const a = api.getAlert(params.id); if (!a) return { redirect: '/404' };
      const why = d.reason(user, a), mine = api.activeAppt(user.id, a.id);
      return {
        html: shell(user, h`${back('#/alertas', 'Voltar para alertas')}
          <div class="hd"><div class="bt big">${a.tipo}</div><div><h1>Doadores ${a.tipo} são necessários</h1><p class="sub">${urgPill(a)}</p></div></div>
          <dl class="facts"><div><dt>Bolsas necessárias</dt><dd>${a.faltam}</dd></div><div><dt>Prazo</dt><dd>${d.deadlineLabel(a)}</dd></div><div><dt>Local</dt><dd>${D.LOCAL.nome}</dd></div><div><dt>Horário</dt><dd>${D.LOCAL.horario}</dd></div></dl>
          ${why ? h`<div class="note"><b>Você não pode doar para este alerta agora</b>${why}</div>` : h`<div class="note"><b>Você pode ajudar!</b>Seu tipo ${user.tipo} é compatível e você está apto a doar.</div>`}
          <h2>Antes de doar</h2><ul class="reqs">${D.REQUIREMENTS.map((r) => h`<li>${r}</li>`)}</ul>
          <div class="row-actions">${mine ? h`<a class="btn" href="#/agendamento/${mine.id}">Ver meu agendamento</a>` : !why ? h`<a class="btn" href="#/agendar/${a.id}">Agendar doação</a>` : ''}<a class="lk" href="#/alertas">Voltar para alertas</a></div>`),
      };
    },
  });

  // Agendar
  router.add('/agendar/:id', {
    access: 'private', roles: ROLE, title: 'Agendar doação',
    view({ user, params }) {
      const a = api.getAlert(params.id); if (!a) return { redirect: '/404' };
      if (d.reason(user, a) || api.activeAppt(user.id, a.id)) return { redirect: '/alertas/' + a.id }; // não deixa agendar sem poder
      const max = a.prazo;
      return {
        html: shell(user, h`${back('#/alertas/' + a.id, 'Voltar ao alerta')}${ui.pageHeader('b', 'Agendar doação', `Alerta ${a.tipo} · escolha uma data até ${fmtDate(max)}.`)}
          <form id="ag" novalidate><div class="grid2">
            ${ui.field({ name: 'data', label: 'Data', type: 'date', required: true, min: today(), max })}
            ${ui.field({ name: 'hora', label: 'Horário', required: true, options: D.SLOTS, placeholder: 'Selecione o horário' })}</div>
            <p class="err" data-form-error role="alert"></p>
            <div class="row-actions"><button class="btn">Confirmar agendamento</button><a class="lk" href="#/alertas/${a.id}">Cancelar</a></div></form>`),
        mount(root) {
          Form.bind($('#ag', root), {
            data: { validate: (x) => (!x ? 'Escolha uma data.' : x < today() || x > max ? `Escolha uma data entre hoje e ${fmtDate(max)}.` : '') },
            hora: { validate: v.select('Escolha um horário.') },
          }, async ({ data, hora }) => {
            const ap = await api.createAppt({ alertId: a.id, data, hora });
            ui.toast('Doação agendada!'); router.go('/agendamento/' + ap.id);
          });
        },
      };
    },
  });

  // Comprovante do agendamento
  router.add('/agendamento/:id', {
    access: 'private', roles: ROLE, title: 'Agendamento',
    view({ user, params }) {
      const ap = api.getAppt(params.id);
      if (!ap || ap.userId !== user.id) return { redirect: '/404' };
      const a = api.getAlert(ap.alertId), ativo = ap.status === 'Agendada';
      return {
        html: shell(user, h`${back('#/historico', 'Histórico')}
          <div class="hd"><div class="bt big">${a?.tipo || '–'}</div><div><h1>${ativo ? 'Doação agendada' : 'Agendamento ' + ap.status.toLowerCase()}</h1><p class="sub">Protocolo ${ap.id.toUpperCase()}</p></div></div>
          <dl class="facts"><div><dt>Data</dt><dd>${fmtDate(ap.data)}</dd></div><div><dt>Horário</dt><dd>${ap.hora}</dd></div><div><dt>Local</dt><dd>${D.LOCAL.nome}</dd></div><div><dt>Situação</dt><dd>${statusPill(ap.status)}</dd></div></dl>
          <div class="note"><b>Leve um documento com foto</b>Chegue com 15 minutos de antecedência, bem alimentado e hidratado.</div>
          <div class="row-actions"><a class="btn" href="#/historico">Ver histórico</a><a class="btn ghost" href="#/alertas">Voltar para alertas</a>
            ${ativo ? h`<button class="lk" id="cancel" type="button">Cancelar agendamento</button>` : ''}</div>`),
        mount(root) {
          $('#cancel', root)?.addEventListener('click', async () => {
            const ok = await ui.confirm({ title: 'Cancelar agendamento?', text: `Sua doação de ${fmtDate(ap.data)} às ${ap.hora} será cancelada.`, ok: 'Cancelar agendamento', cancel: 'Manter' });
            if (!ok) return;
            try {
              await api.cancelAppt(ap.id); ui.toast('Agendamento cancelado.'); router.go('/historico');
            } catch (err) { ui.toast(err.message); }
          });
        },
      };
    },
  });

  // Histórico do doador
  router.add('/historico', {
    access: 'private', roles: ROLE, title: 'Histórico',
    view({ user }) {
      const rows = [...api.appts(user.id).map((a) => ({ id: a.id, data: a.data, hora: a.hora, status: a.status })), ...(user.ultima ? [{ data: user.ultima, status: 'Concluída' }] : [])]
        .sort((x, y) => y.data.localeCompare(x.data));
      return {
        html: ui.appLayout('historico', h`${ui.pageHeader('r', 'Histórico', 'Acompanhe suas doações e agendamentos.')}
          <div class="tbl"><table><thead><tr><th>Data</th><th>Local</th><th>Situação</th><th></th></tr></thead><tbody>
          ${rows.map((r) => h`<tr><td>${fmtDate(r.data)}${r.hora ? ' · ' + r.hora : ''}</td><td>${D.LOCAL.nome}</td><td>${statusPill(r.status)}</td><td>${r.id ? h`<a class="lk" style="margin:0" href="#/agendamento/${r.id}">Ver</a>` : ''}</td></tr>`)}
          </tbody></table></div><div class="row-actions"><a class="btn" href="#/alertas">Ver alertas ativos</a></div>`, user),
      };
    },
  });
  router.add('/doacoes', { access: 'private', title: 'Histórico', view: () => ({ redirect: '/historico' }) }); // endereço antigo
})(window.HC = window.HC || {});
