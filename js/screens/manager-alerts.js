/* Telas do GERENTE em "Alertas e Doações":
   #/alertas (estoque + alertas lançados) · #/alertas/novo[/:tipo] (lançar alerta) · #/alertas/:id (doadores notificados)
   Registrar antes de alerts.js: '/alertas/novo' precisa casar antes de '/alertas/:id'. */
(function (HC) {
  'use strict';
  const { h, $, $$, today, addDays, fmtDate } = HC.u, { ui, api, router, v, Form, data: D, domain: d } = HC;
  const ROLE = ['gerente'];
  const shell = (user, inner) => ui.appLayout('alertas', inner, user);
  const urgPill = (a) => ui.pill(a.nivel === 'urgente' ? 'Urgente' : 'Moderado', a.nivel === 'urgente' ? 'urg' : 'mod');
  const recipientsOf = (a) => (a.destinatarios ? a.destinatarios.map(api.getUser).filter(Boolean) : d.recipients(a));

  const alertCard = (a) => {
    const open = d.isOpen(a);
    return h`<article class="al ${open ? '' : 'off'}"><div class="bt">${a.tipo}</div>
      <div><strong>Faltam ${a.faltam} bolsas · Prazo: ${d.deadlineLabel(a)}</strong><span class="s">${recipientsOf(a).length} doador(es) compatível(is)</span></div>
      ${urgPill(a)}${ui.pill(open ? 'Ativo' : 'Encerrado', open ? 'ok' : 'off')}
      <div class="acts"><a class="btn sm ghost" href="#/alertas/${a.id}">Ver doadores</a>${open ? h`<button class="lk" type="button" data-close="${a.id}">Encerrar</button>` : ''}</div></article>`;
  };

  async function closeAlert(id) {
    const ok = await ui.confirm({ title: 'Encerrar alerta?', text: 'Os doadores deixam de ver este alerta. Agendamentos já feitos continuam valendo.', ok: 'Encerrar alerta', cancel: 'Manter' });
    if (!ok) return false;
    await api.closeAlert(id); ui.toast('Alerta encerrado.'); return true;
  }

  // Painel: controle de estoque + alertas lançados
  router.add('/alertas', {
    access: 'private', roles: ROLE, title: 'Alertas e Doações',
    view({ user }) {
      const stock = api.stock();
      return {
        html: shell(user, h`${ui.pageHeader('b', 'Alertas e Doações', 'Controle o estoque e lance alertas para os doadores compatíveis.')}
          <h2>Controle de estoque</h2>
          <p class="sub">Defina o nível de cada tipo sanguíneo. Em Alerta ou Crítico, acione um alerta para os doadores.</p>
          <div class="stock-grid">${D.BLOOD_TYPES.map((t) => h`<div class="sc">
            <div class="top"><div class="bt">${t}</div><span data-pill="${t}">${ui.levelPill(stock[t])}</span></div>
            <label class="sr" for="n-${t}">Nível de estoque do tipo ${t}</label>
            <select id="n-${t}" data-tipo="${t}">${D.STOCK_LEVELS.map((l) => h`<option ${l === stock[t] ? 'selected' : ''}>${l}</option>`)}</select>
            <a class="btn sm ghost" href="#/alertas/novo/${t}">Acionar alerta</a></div>`)}</div>
          <div class="row-actions" style="justify-content:space-between"><h2 style="margin:0">Alertas lançados</h2><a class="btn sm" href="#/alertas/novo">Lançar novo alerta</a></div>
          <div style="margin-top:14px">${api.alerts().length ? api.alerts().map(alertCard) : h`<p class="mut">Nenhum alerta lançado ainda.</p>`}</div>`),
        mount(root) {
          $$('select[data-tipo]', root).forEach((sel) => sel.addEventListener('change', async () => {
            const anterior = api.stock()[sel.dataset.tipo];
            sel.disabled = true;
            try {
              await api.setStock(sel.dataset.tipo, sel.value);
              $(`[data-pill="${sel.dataset.tipo}"]`, root).innerHTML = String(ui.levelPill(sel.value));
              ui.toast(`Estoque ${sel.dataset.tipo}: ${sel.value}.`);
            } catch (err) {
              sel.value = anterior;
              ui.toast(err.message);
            } finally { sel.disabled = false; }
          }));
          $$('[data-close]', root).forEach((b) => b.addEventListener('click', async () => {
            try { if (await closeAlert(b.dataset.close)) router.go('/alertas'); }
            catch (err) { ui.toast(err.message); }
          }));
        },
      };
    },
  });

  // Lançar alerta (com ou sem tipo já escolhido, vindo do dashboard ou do estoque)
  const novo = ({ user, params }) => {
    const tipo = params.tipo || '';
    if (tipo && !D.BLOOD_TYPES.includes(tipo)) return { redirect: '/alertas/novo' };
    const max = addDays(today(), 30), nivelEst = tipo ? api.stock()[tipo] : '';
    return {
      html: shell(user, h`<a class="back-link" href="#/alertas">‹ Voltar para alertas</a>
        ${ui.pageHeader('b', 'Lançar alerta', tipo ? `Aviso para doadores compatíveis com o tipo ${tipo}${nivelEst ? ` (estoque ${nivelEst.toLowerCase()})` : ''}.` : 'Escolha o tipo sanguíneo e o prazo. Só doadores ativos, compatíveis e aptos serão avisados.')}
        <form id="novo" novalidate><div class="grid2">
          ${ui.field({ name: 'tipo', label: 'Tipo sanguíneo necessário', required: true, options: D.BLOOD_TYPES, value: tipo, placeholder: 'Selecione o tipo' })}
          ${ui.field({ name: 'nivel', label: 'Urgência', required: true, options: ['Urgente', 'Moderado'], value: d.urgencyFor(nivelEst) === 'urgente' ? 'Urgente' : 'Moderado', placeholder: 'Selecione' })}
          ${ui.field({ name: 'faltam', label: 'Bolsas necessárias', type: 'number', required: true, min: 1, max: 500, inputmode: 'numeric', value: 10 })}
          ${ui.field({ name: 'prazo', label: 'Prazo', type: 'date', required: true, min: today(), max, value: addDays(today(), 3) })}</div>
          <p class="err" data-form-error role="alert"></p>
          <div class="row-actions"><button class="btn">Lançar alerta</button><a class="lk" href="#/alertas">Cancelar</a></div></form>`),
      mount(root) {
        Form.bind($('#novo', root), {
          tipo: { validate: v.select('Selecione o tipo sanguíneo.') },
          nivel: { validate: v.select('Selecione a urgência.'), normalize: (x) => x.toLowerCase() },
          faltam: { validate: (x) => (/^\d+$/.test(x) && +x >= 1 && +x <= 500 ? '' : 'Informe um número de 1 a 500.'), normalize: Number },
          prazo: { validate: (x) => (!x ? 'Escolha o prazo.' : x < today() || x > max ? `Escolha uma data entre hoje e ${fmtDate(max)}.` : '') },
        }, async (val) => {
          const a = await api.createAlert(val);
          const quantidade = a.destinatarios?.length || 0;
          ui.toast(quantidade ? `Alerta lançado para ${quantidade} doador(es).` : 'Alerta lançado, mas nenhum doador está apto agora.');
          router.go('/alertas/' + a.id);
        });
      },
    };
  };
  router.add('/alertas/novo', { access: 'private', roles: ROLE, title: 'Lançar alerta', view: novo });
  router.add('/alertas/novo/:tipo', { access: 'private', roles: ROLE, title: 'Lançar alerta', view: novo });

  // Detalhe: doadores notificados, com dados de contato
  router.add('/alertas/:id', {
    access: 'private', roles: ROLE, title: 'Detalhes do alerta',
    view({ user, params }) {
      const a = api.getAlert(params.id); if (!a) return { redirect: '/404' };
      const open = d.isOpen(a), lista = recipientsOf(a);
      return {
        html: shell(user, h`<a class="back-link" href="#/alertas">‹ Voltar para alertas</a>
          <div class="hd"><div class="bt big">${a.tipo}</div><div><h1>Alerta para o tipo ${a.tipo}</h1><p class="sub">${urgPill(a)} ${ui.pill(open ? 'Ativo' : 'Encerrado', open ? 'ok' : 'off')}</p></div></div>
          <dl class="facts"><div><dt>Bolsas necessárias</dt><dd>${a.faltam}</dd></div><div><dt>Prazo</dt><dd>${d.deadlineLabel(a)}</dd></div><div><dt>Lançado em</dt><dd>${fmtDate(a.criadoEm)}</dd></div><div><dt>Doadores selecionados</dt><dd>${lista.length}</dd></div></dl>
          <h2 style="margin-top:22px">Doadores selecionados para contato</h2>
          <p class="sub">Compatíveis, ativos e aptos no momento do lançamento. Os contatos aparecem abaixo; o envio automático de mensagens ainda não está ativo.</p>
          ${ui.donorTable(lista, { empty: 'Nenhum doador compatível e apto no momento.' })}
          <div class="row-actions">${open ? h`<button class="btn sm ghost" id="close" type="button">Encerrar alerta</button>` : ''}<a class="lk" href="#/alertas">Voltar para alertas</a></div>`),
        mount(root) { $('#close', root)?.addEventListener('click', async () => {
          try { if (await closeAlert(a.id)) router.go('/alertas/' + a.id); }
          catch (err) { ui.toast(err.message); }
        }); },
      };
    },
  });
})(window.HC = window.HC || {});
