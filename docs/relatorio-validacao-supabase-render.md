# Relatório de validação — Supabase/PostgreSQL e preparação do Render

Atualizado em: 24/10/2026
Branch: `feat/supabase-postgres-phase-1`

## 1. Correção do aviso PostgreSQL

O projeto usa `pg` 8.23.1. A inicialização de fuso saiu do evento
`pool.on('connect')`, que não aguardava a Promise de `client.query()`, e passou
para a opção assíncrona `onConnect` do `Pool`:

```js
onConnect: async (client) => {
  await client.query("SET TIME ZONE 'America/Sao_Paulo'");
},
```

A conexão só é liberada para a aplicação depois que o `SET TIME ZONE` termina.
O diagnóstico abriu oito consultas simultâneas com `--trace-deprecation` e não
registrou o aviso `client is already executing a query` nem qualquer outro
warning. As consultas de transação continuam sequenciais e aguardadas. Não foi
encontrado outro compartilhamento concorrente de um mesmo client.

Durante o teste real também foi corrigido o retorno de ID de inserts em
`profissionais`, incluindo a tabela no adaptador `RETURNING id`.

## 2. Arquivos da continuação

- `backend/src/database.js`: `onConnect`, pool PostgreSQL e IDs gerados.
- `backend/scripts/check-postgres.mjs`: diagnóstico remoto somente leitura.
- `backend/tests/postgres-integration.mjs`: integração real e concorrência.
- `backend/scripts/cleanup-postgres-test-fixtures.mjs`: limpeza restrita às
  fixtures `codex-pg-*`.
- `backend/scripts/provision-demo.mjs`: provisionamento idempotente e protegido.
- `backend/src/services/email.js` e `backend/tests/email.test.js`: Resend HTTPS
  exige o ID de aceitação retornado pelo provedor.
- `backend/src/services/appointmentNotifications.js` e testes: endereços
  `@example.invalid` nunca são enviados ao provedor.
- `backend/src/app.js`: `TRUST_PROXY=1` interpretado como número de saltos.
- `backend/src/server.js`: `PORT`, bind em `0.0.0.0` e encerramento gracioso.
- `backend/package.json`, `backend/package-lock.json` e `.env.example`: scripts,
  `pg`, Node 22–24 e variáveis documentadas.
- `render.yaml`: serviço gratuito, health check, secrets externos e deploy manual.
- `.env.example`: URL da API separada para o build do frontend.
- `.gitignore`: protege `supabase/.temp/`, `.env` e `.vercel`.
- `docs/migracao-supabase-fase-1.md`: procedimentos de diagnóstico e demo.

## 3. Migration

A migration aplicada permanece em:

`supabase/migrations/202610230001_initial_schema.sql`

Ela contém as oito tabelas esperadas, relacionamentos, índices, checks, triggers,
RLS sem políticas públicas, fila de notificações e exclusão GiST que impede
intervalos ativos sobrepostos. A migration não foi reaplicada e nenhum `db reset`
foi executado. `supabase/seed.sql` continua destinado somente ao ambiente local.

## 4. Testes executados

- `npm run test:unit`: 22/22 aprovados.
- `DB_CLIENT=mysql npm run test:mysql`: 75/75 aprovados, usando banco de teste
  aleatório e tabelas temporárias; o banco MySQL original foi preservado.
- `npm run test:postgres` no Supabase real: aprovado para verificação de e-mail,
  autenticação, disponibilidade, isolamento entre pacientes, ciclo de consulta,
  bloqueios, agenda administrativa e concorrência.
- Concorrência PostgreSQL: duas reservas simultâneas do mesmo slot produziram
  exatamente um HTTP 201 e um HTTP 409, restando uma única reserva ativa.
- `npm run check:postgres`: conexão, fuso, oito tabelas, `/api/health` e
  `/api/horarios` aprovados; `warnings: []`.
- `npm run start:demo`: provisionamento idempotente, health check, configuração
  pública e os dois acessos demonstrativos aprovados no Supabase real.
- Limpeza remota: zero registros nas oito tabelas e zero fixtures restantes.
- Inicialização real: API respondeu `status: ok` na porta local configurada.
- `npm run build`: build Vite aprovado.
- `npm audit --omit=dev`: zero vulnerabilidades no backend.
- `render.yaml`: sintaxe/formatação YAML validada.

Todos os registros usados na integração foram aleatórios e fictícios, com
endereços reservados. O envio externo de e-mail ficou desabilitado durante o
teste. Nenhum dado MySQL foi importado.

## 5. Contas e agenda de demonstração

O Supabase contém somente a demonstração fictícia preparada: uma profissional,
uma conta profissional, uma paciente, cinco disponibilidades semanais e uma
consulta futura. O comando `npm run demo:provision`:

- exige `ALLOW_REMOTE_DEMO_SEED=true` apenas durante a execução;
- aceita somente e-mails `@example.invalid`;
- gera hashes de senhas aleatórios e não imprime credenciais;
- cria/atualiza uma profissional, uma paciente, agenda de segunda a sexta e uma
  consulta futura confirmada;
- não envia e-mail, não executa migration e não acessa o MySQL.

O login público do modo demo não usa senha compartilhada: ele emite o JWT atual
somente para os dois e-mails reservados e verificados. O isolamento entre
pacientes também foi comprovado com duas contas temporárias no teste remoto.

## 6. E-mail

O transporte HTTPS do Resend está implementado. Uma resposta 2xx só é marcada
como enviada se o provedor devolver um identificador de mensagem. A fila
persistente registra falhas para nova tentativa. SMTP continua disponível para
ambientes compatíveis, mas não deve ser usado no Render Free.

No ambiente demonstrativo, `DEMO_MODE=true` e `EMAIL_PROVIDER=disabled`
bloqueiam qualquer chamada externa. Resend permanece implementado para ativação
futura, quando houver domínio validado e secrets próprios.

## 7. Render e frontend

`render.yaml` usa plano `free`, `npm ci`, `npm run start:demo`, `/api/health`, PostgreSQL
com SSL, pool máximo de cinco conexões, proxy confiável e rate limit local para
uma única instância. O deploy automático está desligado até a revisão dos
secrets, das contas demo e do CORS.

Não houve deploy: não existe Render CLI nem `RENDER_API_KEY` disponível nesta
máquina. Portanto ainda não existe URL pública da API. O projeto local está
vinculado a um projeto Vercel, mas não há token/CLI nem `VITE_API_URL` de
produção configurado.

## 8. Comandos de validação

Diagnóstico remoto somente leitura:

```powershell
Set-Location backend
npm ci
npm run test:unit
npm run check:postgres
```

Integração remota com fixtures isoladas e limpeza automática:

```powershell
Set-Location backend
$env:ALLOW_REMOTE_TEST_WRITES='true'
npm run test:postgres
Remove-Item Env:ALLOW_REMOTE_TEST_WRITES
npm run check:postgres
```

Regressão MySQL isolada:

```powershell
Set-Location backend
$env:DB_CLIENT='mysql'
npm run test:mysql
Remove-Item Env:DB_CLIENT
```

Servidor e frontend locais:

```powershell
Set-Location backend
npm start
```

```powershell
Set-Location ..
npm ci
npm run build
npm run dev
```

## 9. Pendências externas

1. Criar/autorizar o serviço pelo Blueprint do Render e cadastrar, sem commit:
   `DATABASE_URL` do Session pooler Supabase, `JWT_SECRET` e `FRONTEND_URL`.
2. Informar no frontend hospedado `VITE_API_URL=https://<api>.onrender.com` e
   usar a origem HTTPS exata do frontend em `FRONTEND_URL`.
3. Após o primeiro deploy manual, validar `/api/health`, CORS, acessos demo e
   agenda pela URL pública; só então habilitar deploy automático.
4. Futuramente, validar o domínio do Resend e realizar um envio real controlado
   antes de reativar o cadastro público.

Nenhuma credencial foi adicionada aos arquivos versionáveis e nenhum segredo foi
impresso no relatório.
