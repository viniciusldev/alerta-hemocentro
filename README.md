# Alerta Hemocentro — site ligado ao PostgreSQL

Esta versão parte do **site original** (HTML, CSS e JavaScript puro) e conecta os dados à API Node.js/Express + PostgreSQL. Não há mais banco simulado no `localStorage`: o `js/core/store.js` chama `/api/...` por `fetch` e recebe os dados do PostgreSQL.

> **Importante:** não execute o `schema.sql` de novo se você já criou as tabelas. A API usa a estrutura existente. Não existem os logins fictícios do protótipo; crie um gerente e os demais usuários via cadastro.

## Como executar no Windows (VS Code)

**1.** Extraia o ZIP. No VS Code, abra a pasta `alerta_hemocentro_integrado` (a pasta onde existe `package.json`).

**2.** No terminal do VS Code, execute:

```powershell
npm install
```

**3.** Copie `.env.example` para `.env`. Caso você já tenha um `.env` com `DATABASE_URL` funcionando (do teste `node teste.js`), copie **a linha inteira** desse arquivo para o novo `.env`. Adicione `SESSION_SECRET` e mantenha `PORT=3000`:

```env
DATABASE_URL=postgresql://alerta_app:SENHA@localhost:5432/alerta_hemocentro
SESSION_SECRET=COLE_AQUI_UMA_CHAVE_SEGURA_DE_64_CARACTERES
PORT=3000
NODE_ENV=development
```

Gere uma chave aleatória com:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie a saída e use como valor de `SESSION_SECRET` (sem aspas). **Não compartilhe seu `.env` nem suba esse arquivo ao GitHub.**

**4.** Confira no pgAdmin se o banco `alerta_hemocentro` já possui as tabelas e o serviço PostgreSQL está iniciado. Teste a conexão com:

```powershell
npm start
```

O terminal deve exibir `Alerta Hemocentro: http://localhost:3000`. Abra **http://localhost:3000/api/saude** e confirme `{"ok":true,"banco":"conectado"}`. Se der erro `password authentication failed`, confira a senha em `DATABASE_URL`.

**5.** Em outro terminal do VS Code (com o servidor ainda ligado), crie a primeira conta de gerente:

```powershell
npm run criar-gerente
```

Preencha nome, CPF/RG, telefone, e-mail, tipo sanguíneo e escolha uma senha. O script insere apenas **uma conta gerente** e faz o hash da senha. Não precisa executar SQL manual para criar a conta. Se você já tiver um gerente criado no PostgreSQL, pule este passo.

**6.** Abra **http://localhost:3000** no navegador. Faça login com o documento e a senha que você informou. Cadastre doadores, altere o estoque, lance um alerta e confira os registros no pgAdmin.

Não abra `index.html` diretamente (`file://`) e não use Live Server na porta 5500: a API e o site são servidos juntos pelo Node na porta **3000**.

## Como confirmar os dados no pgAdmin

Execute os comandos abaixo na **Query Tool do banco `alerta_hemocentro`**, sem modificar o `schema.sql`:

```sql
SELECT perfil, nome, tipo_sanguineo, criado_em FROM usuarios ORDER BY criado_em DESC;
SELECT tipo_sanguineo, nivel FROM estoque ORDER BY tipo_sanguineo;
SELECT tipo_sanguineo, urgencia, bolsas_necessarias, prazo, status FROM alertas;
SELECT usuario_id, alerta_id, data_agendada, status FROM agendamentos;
```

Verifique o cadastro feito no site e recarregue a página (F5). Os registros devem permanecer, porque são consultados novamente no PostgreSQL. As senhas estão no campo `senha_hash`, nunca em texto puro.

## Estrutura principal

```
api/db.js                 conexão PostgreSQL (pg Pool)
api/server.js             rotas e segurança de acesso (Express)
scripts/criar-gerente.js  cria conta gerente local por prompt
js/core/store.js          busca dados da API, sem localStorage
js/screens/               telas originais, adaptadas para requisições assíncronas
js/core/                   roteador, validação, componentes e regras do projeto
css/style.css             visual original preservado
.env.example              modelo de configuração; sem senha real
.gitignore                protege o .env e as dependências
```

## Principais rotas da API

| Método | Rota | Função |
|---|---|---|
| GET | `/api/saude` | Testa se o banco responde |
| GET | `/api/bootstrap` | Dados da sessão, estoque, alertas e agendamentos |
| POST | `/api/auth/login` | Login por documento e senha; cookie de sessão |
| POST | `/api/auth/logout` | Sair |
| POST | `/api/usuarios` | Cadastro de doador |
| PATCH / DELETE | `/api/usuarios/:id` | Alterar / excluir doador ou atualizar a própria conta |
| POST | `/api/auth/change-password` | Alterar senha |
| PATCH | `/api/estoque/:tipo` | Alterar nível do estoque (gerente) |
| POST | `/api/alertas` | Lançar alerta e registrar destinatários (gerente) |
| PATCH | `/api/alertas/:id/encerrar` | Encerrar alerta (gerente) |
| POST | `/api/agendamentos` | Agendar doação (doador apto) |
| PATCH | `/api/agendamentos/:id/cancelar` | Cancelar agendamento |
| POST | `/api/recuperacao/iniciar` | Pedir código de recuperação |
| POST | `/api/recuperacao/verificar` | Validar código |
| POST | `/api/recuperacao/redefinir` | Definir nova senha |

A API usa consultas SQL parametrizadas, senhas com bcrypt e cookies de sessão HTTP-only. As rotas de gerente verificam o perfil **no servidor**. A lista de destinatários é calculada no banco no momento do alerta.

## Observações e limites desta etapa

- **Relatórios:** o protótipo tinha doações e números mensais inventados. Os relatórios agora usam **as datas de última doação informadas nos cadastros**. Isso não é um histórico completo de doações: para isso seria necessária outra tabela/fluxo de registro de doação. O gráfico do dashboard foi ajustado para não exibir uma série fictícia.
- **Notificação real:** a lista de destinatários fica salva na tabela `alerta_destinatarios`, mas o sistema **ainda não envia mensagens via WhatsApp/SMS/e-mail** quando um alerta é criado. O painel mostra quem deve ser contatado.
- **Recuperação de senha:** para testar sem SMTP, o código de cinco dígitos é exibido **somente no terminal do Node**. Para envio real por e-mail, configure SMTP no `.env`; não publique a aplicação com esse modo de desenvolvimento.
- **Critérios de aptidão:** os 60 dias foram mantidos conforme o protótipo e o `schema.sql`, como regra demonstrativa. Antes do uso real, devem ser revisados por profissionais do hemocentro com as regras atuais para elegibilidade.
- **Privacidade:** o projeto envolve dados pessoais sensíveis. Este pacote destina-se a **desenvolvimento local**, não a um serviço de saúde em produção. Antes de publicar: revisar segurança, LGPD, política de acesso, registro de operações, notificações, backups e HTTPS.
- **Execução local:** a conexão depende do PostgreSQL que está no seu computador. O pacote não contém seu banco nem sua senha, e não foi executado contra sua instalação do pgAdmin.

## Testes de código (sem precisar conectar ao banco)

```powershell
npm test
```

Os testes simulam respostas HTTP para conferir o comportamento das telas. **Não substituem os testes com PostgreSQL real.**

## Erros comuns

- `password authentication failed` → senha incorreta na `DATABASE_URL`.
- `ECONNREFUSED` → PostgreSQL parado, porta incorreta ou host diferente.
- `relation "usuarios" does not exist` → a API está apontando para outro banco ou schema.
- `permission denied` → faltaram `GRANT`s para `alerta_app`; confira a parte de permissões do `schema.sql`.
- `Configure SESSION_SECRET` → a chave deve ter pelo menos 32 caracteres.
- `EADDRINUSE: 3000` → já existe outro servidor usando a porta 3000; pare-o ou ajuste `PORT`.
