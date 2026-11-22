/* Regras de negócio (sem DOM): aptidão para doar, compatibilidade, prazos e destinatários de alertas. */
(function (HC) {
  'use strict';
  const { today, addDays, diffDays, fmtDate } = HC.u, D = HC.data;

  const eligibility = (user) => {
    // Sem data: "nunca doei" = apto; "não sei quando foi" (ultimaInfo = 'desconhecida') = inapto até o hemocentro confirmar.
    if (!user.ultima) return user.ultimaInfo === 'desconhecida' ? { date: null, apto: false, dias: 0, unknown: true } : { date: today(), apto: true, dias: 0, nunca: true };
    const date = addDays(user.ultima, D.MIN_INTERVAL_DAYS), dias = diffDays(today(), date);
    return { date, apto: dias <= 0, dias: Math.max(dias, 0) };
  };
  const canHelp = (user, alert) => D.CAN_DONATE_TO[user.tipo].includes(alert.tipo);
  const isOpen = (alert) => alert.status === 'ativo' && alert.prazo >= today();
  const deadlineLabel = (alert) => (alert.prazo === today() ? 'Hoje' : alert.prazo === addDays(today(), 1) ? 'Amanhã' : fmtDate(alert.prazo));

  /** Motivo pelo qual o doador NÃO pode atender ao alerta ('' se pode). */
  function reason(user, alert) {
    if (!isOpen(alert)) return 'Este alerta foi encerrado.';
    if (!canHelp(user, alert)) return `Seu tipo (${user.tipo}) não é compatível com este alerta.`;
    const e = eligibility(user);
    if (e.unknown) return 'Sua aptidão não foi confirmada. Procure o hemocentro para informar a data da última doação.';
    return e.apto ? '' : `Você poderá doar a partir de ${fmtDate(e.date)}.`;
  }

  /** Doadores que devem ser avisados: ativos, compatíveis com o tipo do alerta e aptos hoje. */
  const recipients = (alert) => HC.api.donors().filter((u) => u.ativo && canHelp(u, alert) && eligibility(u).apto);

  /** Nível de estoque -> urgência sugerida para o alerta. */
  const urgencyFor = (nivelEstoque) => (nivelEstoque === 'Crítico' ? 'urgente' : 'moderado');

  HC.domain = { eligibility, canHelp, isOpen, deadlineLabel, reason, recipients, urgencyFor };
})(window.HC = window.HC || {});
