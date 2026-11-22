/* Constantes usadas pela interface; registros do sistema vêm da API PostgreSQL. */
(function (HC) {
  'use strict';
  const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  HC.data = {
    BLOOD_TYPES,
    // Para quais tipos cada tipo pode doar
    CAN_DONATE_TO: {
      'O-': BLOOD_TYPES, 'O+': ['O+', 'A+', 'B+', 'AB+'], 'A-': ['A-', 'A+', 'AB-', 'AB+'], 'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'], 'B+': ['B+', 'AB+'], 'AB-': ['AB-', 'AB+'], 'AB+': ['AB+'],
    },
    MIN_INTERVAL_DAYS: 60, // descanso entre doações (ajustar conforme regra do hemocentro)
    LOCAL: { nome: 'Hemocentro – Unidade Central', horario: 'Segunda a sexta, das 7h às 17h' },
    SLOTS: ['08:00', '09:30', '11:00', '14:00', '15:30'],
    REQUIREMENTS: ['Estar bem de saúde e ter dormido ao menos 6 horas', 'Estar alimentado e evitar alimentos gordurosos nas 3 horas antes', 'Não ingerir bebida alcoólica nas 12 horas antes', 'Levar um documento oficial com foto', 'Pesar no mínimo 50 kg'],

    // Níveis de estoque que o gerente pode definir por tipo sanguíneo
    STOCK_LEVELS: ['Estável', 'Alerta', 'Crítico'],
    STOCK_BAR: { 'Estável': 80, 'Alerta': 40, 'Crítico': 12 }, // largura da barra no dashboard (%)

    // Dados de cadastro, estoque e alertas agora vêm do PostgreSQL via /api/bootstrap.
  };
})(window.HC = window.HC || {});
