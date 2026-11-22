-- Alerta Hemocentro - PostgreSQL 13+
-- Rodar na Query Tool do banco alerta_hemocentro. Trocar a senha do papel alerta_app antes de publicar.

BEGIN;

-- Necessaria para a restricao GiST com igualdade de UUID.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE tipo_sanguineo     AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE perfil_usuario     AS ENUM ('gerente','doador');
CREATE TYPE ultima_doacao_info AS ENUM ('nunca','desconhecida');
CREATE TYPE nivel_estoque      AS ENUM ('estavel','alerta','critico');
CREATE TYPE urgencia_alerta    AS ENUM ('urgente','moderado');
CREATE TYPE status_alerta      AS ENUM ('ativo','encerrado');
CREATE TYPE status_agendamento AS ENUM ('agendada','cancelada','concluida');

CREATE FUNCTION atualiza_timestamp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END $$;

CREATE TABLE usuarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil         perfil_usuario NOT NULL DEFAULT 'doador',
  ativo          boolean NOT NULL DEFAULT true,
  nome           varchar(100) NOT NULL CHECK (char_length(trim(nome)) >= 3),
  documento      varchar(11) NOT NULL UNIQUE CHECK (documento ~ '^[0-9]{7,11}$'),
  telefone       varchar(11) NOT NULL CHECK (telefone ~ '^[1-9]{2}[0-9]{8,9}$'),
  email          varchar(120) CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$'),
  tipo_sanguineo tipo_sanguineo NOT NULL,
  ultima_doacao  date CHECK (ultima_doacao >= DATE '1980-01-01'),
  ultima_info    ultima_doacao_info,
  aviso_whatsapp boolean NOT NULL DEFAULT true,
  aviso_email    boolean NOT NULL DEFAULT false,
  aviso_sms      boolean NOT NULL DEFAULT false,
  senha_hash     text NOT NULL,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  -- ou tem a data da última doação, ou o motivo de não ter; nunca os dois
  CONSTRAINT ultima_ou_info CHECK (ultima_doacao IS NULL OR ultima_info IS NULL)
);
CREATE UNIQUE INDEX usuarios_email_unico ON usuarios (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX usuarios_doadores_ativos ON usuarios (tipo_sanguineo) WHERE perfil = 'doador' AND ativo;
CREATE TRIGGER usuarios_atualizado BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION atualiza_timestamp();

CREATE TABLE recuperacoes_senha (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  codigo_hash   text NOT NULL,
  expira_em     timestamptz NOT NULL,
  tentativas    smallint NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 5),
  verificado_em timestamptz,
  usado_em      timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recuperacoes_por_usuario ON recuperacoes_senha (usuario_id, criado_em DESC);

CREATE TABLE compatibilidade_sanguinea (
  tipo_doador   tipo_sanguineo NOT NULL,
  tipo_receptor tipo_sanguineo NOT NULL,
  PRIMARY KEY (tipo_doador, tipo_receptor)
);
INSERT INTO compatibilidade_sanguinea (tipo_doador, tipo_receptor) VALUES
  ('O-','O-'),('O-','O+'),('O-','A-'),('O-','A+'),('O-','B-'),('O-','B+'),('O-','AB-'),('O-','AB+'),
  ('O+','O+'),('O+','A+'),('O+','B+'),('O+','AB+'),
  ('A-','A-'),('A-','A+'),('A-','AB-'),('A-','AB+'),
  ('A+','A+'),('A+','AB+'),
  ('B-','B-'),('B-','B+'),('B-','AB-'),('B-','AB+'),
  ('B+','B+'),('B+','AB+'),
  ('AB-','AB-'),('AB-','AB+'),
  ('AB+','AB+');

CREATE TABLE estoque (
  tipo_sanguineo tipo_sanguineo PRIMARY KEY,
  nivel          nivel_estoque NOT NULL DEFAULT 'estavel',
  atualizado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER estoque_atualizado BEFORE UPDATE ON estoque FOR EACH ROW EXECUTE FUNCTION atualiza_timestamp();
INSERT INTO estoque (tipo_sanguineo, nivel) VALUES
  ('A+','estavel'),('A-','critico'),('B+','estavel'),('B-','critico'),
  ('O+','alerta'),('O-','critico'),('AB+','estavel'),('AB-','alerta');

CREATE TABLE alertas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_sanguineo     tipo_sanguineo NOT NULL,
  urgencia           urgencia_alerta NOT NULL,
  bolsas_necessarias integer NOT NULL CHECK (bolsas_necessarias BETWEEN 1 AND 500),
  prazo              date NOT NULL,
  status             status_alerta NOT NULL DEFAULT 'ativo',
  criado_por         uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alertas_ativos ON alertas (prazo) WHERE status = 'ativo';

-- quem foi avisado no momento do lançamento (relação N:N entre alertas e usuarios)
CREATE TABLE alerta_destinatarios (
  alerta_id  uuid NOT NULL REFERENCES alertas(id)  ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (alerta_id, usuario_id)
);

CREATE TABLE agendamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  alerta_id     uuid NOT NULL REFERENCES alertas(id)  ON DELETE RESTRICT,
  data_agendada date NOT NULL,
  hora_agendada time NOT NULL,
  status        status_agendamento NOT NULL DEFAULT 'agendada',
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agendamento_ativo_unico ON agendamentos (usuario_id, alerta_id) WHERE status = 'agendada';

-- Impede dois agendamentos ativos do mesmo doador na mesma data.
CREATE UNIQUE INDEX agendamento_unico_por_dia
ON agendamentos (usuario_id, data_agendada)
WHERE status = 'agendada';

-- Regra provisoria de demonstracao: intervalo minimo de 60 dias
-- entre agendamentos ativos do mesmo doador.
ALTER TABLE agendamentos
ADD CONSTRAINT intervalo_minimo_agendamentos
EXCLUDE USING gist (
    usuario_id WITH =,
    daterange(data_agendada, data_agendada + 60, '[)') WITH &&
)
WHERE (status = 'agendada');

CREATE INDEX agendamentos_por_usuario ON agendamentos (usuario_id, data_agendada DESC);
CREATE TRIGGER agendamentos_atualizado BEFORE UPDATE ON agendamentos FOR EACH ROW EXECUTE FUNCTION atualiza_timestamp();

CREATE TABLE auditoria (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  acao        text NOT NULL,
  entidade    text NOT NULL,
  entidade_id text,
  detalhes    jsonb,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- regra de aptidão em um lugar só: 60 dias desde a última doação; "nunca doei" é apto, "não sei" não
CREATE VIEW doadores_aptos AS
SELECT id, nome, tipo_sanguineo, telefone, email
FROM usuarios
WHERE perfil = 'doador' AND ativo
  AND ((ultima_doacao IS NULL AND ultima_info IS DISTINCT FROM 'desconhecida')
       OR ultima_doacao <= CURRENT_DATE - 60);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alerta_app') THEN
    CREATE ROLE alerta_app LOGIN PASSWORD 'TROQUE_ESTA_SENHA_FORTE';
  END IF;
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO alerta_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON usuarios, recuperacoes_senha TO alerta_app;
GRANT SELECT, INSERT, UPDATE ON alertas, agendamentos TO alerta_app;
GRANT SELECT, UPDATE ON estoque TO alerta_app;
GRANT SELECT, INSERT ON alerta_destinatarios, auditoria TO alerta_app;
GRANT SELECT ON compatibilidade_sanguinea, doadores_aptos TO alerta_app;

COMMIT;
