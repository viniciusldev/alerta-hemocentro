-- Use SOMENTE em banco ja existente, conectado ao banco alerta_hemocentro.
-- Se as restricoes ja existirem, nao recria. Nao remove dados.
-- Se houver agendamentos conflitantes, a operacao falha sem apagar registros.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE UNIQUE INDEX IF NOT EXISTS agendamento_unico_por_dia
ON agendamentos (usuario_id, data_agendada)
WHERE status = 'agendada';
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'intervalo_minimo_agendamentos'
          AND conrelid = 'agendamentos'::regclass
    ) THEN
        ALTER TABLE agendamentos
        ADD CONSTRAINT intervalo_minimo_agendamentos
        EXCLUDE USING gist (
            usuario_id WITH =,
            daterange(data_agendada, data_agendada + 60, '[)') WITH &&
        ) WHERE (status = 'agendada');
    END IF;
END $$;
COMMIT;
