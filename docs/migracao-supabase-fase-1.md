# Migração Supabase/PostgreSQL — fase 1

Esta fase troca a camada de persistência sem alterar os contratos REST, o JWT,
o bcrypt ou o frontend. Nenhuma migration é executada automaticamente ao subir
a API em PostgreSQL.

## Seleção do banco

- `DB_CLIENT=postgres` usa `pg` e exige `DATABASE_URL`.
- Se `DB_CLIENT` não estiver definido, a presença de `DATABASE_URL` seleciona PostgreSQL.
- Sem `DATABASE_URL`, o caminho MySQL legado permanece ativo.
- As rotinas `ensure*Schema` são executadas apenas no caminho MySQL.

O backend conserva strings SQL de data/hora no fuso da clínica para manter o
JSON existente. O pool PostgreSQL usa até cinco conexões por padrão e TLS é
obrigatório por padrão. Use `DATABASE_SSL=disable` apenas no banco local sem TLS.

## Validação local com Supabase CLI

Pré-requisitos: Docker Desktop e Supabase CLI. Na raiz do repositório:

```powershell
npx supabase init
npx supabase start
npx supabase db reset
Copy-Item backend/.env.example backend/.env
```

No `backend/.env`, use somente no ambiente local:

```dotenv
DB_CLIENT=postgres
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
DATABASE_SSL=disable
JWT_SECRET=substitua-por-um-segredo-local-com-pelo-menos-32-bytes
FRONTEND_URL=http://localhost:5173
EMAIL_PROVIDER=smtp
```

O `supabase db reset` aplica `supabase/migrations` e carrega o `seed.sql`, que
contém apenas uma profissional fictícia no domínio reservado `.invalid`.

Depois:

```powershell
Set-Location backend
npm ci
npm run test:unit
npm start
```

Em outro terminal:

```powershell
Invoke-RestMethod http://localhost:3333/api/health
Invoke-RestMethod "http://localhost:3333/api/horarios?data=2035-09-18&profissional_id=1"
```

## Validação local com PostgreSQL já instalado

Crie um banco local vazio e configure `DATABASE_URL` no `backend/.env`. Então:

```powershell
Set-Location backend
npm ci
npm run migrate:postgres
npm run seed:postgres
npm run test:unit
npm start
```

O runner e o seed recusam hosts remotos por padrão. O seed nunca pode ser usado
fora de `localhost`, `127.0.0.1`, `::1` ou `host.docker.internal`.

## E-mail no Render

O caminho SMTP continua disponível, mas o Render Free bloqueia as portas 25,
465 e 587. Para a API HTTPS do Resend, configure:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=
EMAIL_FROM="Nome da profissional <remetente@dominio-verificado.example>"
```

É necessário validar o domínio no provedor. Tanto a verificação de e-mail
quanto as notificações de agendamento usam o mesmo transportador. Falhas das
notificações ficam na fila persistente; falhas ao emitir o código mantêm o fluxo
de reenvio já existente.

## Conexão posterior com Supabase e Render

1. Crie o projeto Supabase, sem importar dados reais nesta fase.
2. Para migrations, prefira a conexão direta. A execução remota permanece
   bloqueada até que `ALLOW_REMOTE_MIGRATIONS=true` seja deliberadamente definido.
3. Para o backend persistente no Render e rede IPv4, copie do painel Supabase a
   URL do **Session pooler** (porta 5432). Não tente montar o host manualmente.
4. Cadastre `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `RESEND_API_KEY` e
   `EMAIL_FROM` como secrets no Render. Não os grave no Git.
5. Use `DATABASE_SSL=require` no Supabase. Para verificação completa do
   certificado, use `DATABASE_SSL=verify-full`.
6. Aplique a migration remota somente após revisão e autorização explícita.
7. Não execute `seed:postgres` no Supabase. A migração de dados MySQL será uma
   etapa separada, com sanitização e ensaio local antes de qualquer publicação.

As tabelas estão com RLS habilitado e sem políticas públicas. Nesta fase, todo
acesso continua passando pelo Express e pela autenticação JWT/bcrypt existente;
Supabase Auth não é utilizado.

## Diagnóstico e teste de integração no Supabase

Com `backend/.env` apontando para o projeto remoto já migrado, a verificação
somente leitura abre várias conexões simultâneas, valida o fuso, as oito tabelas,
o health check e o contrato público de horários:

```powershell
Set-Location backend
npm run check:postgres
```

O teste de integração remoto cria somente fixtures aleatórias em
`@example.invalid`, desabilita o envio externo de e-mail e remove tudo no bloco
`finally`. Ele exige autorização explícita por execução:

```powershell
Set-Location backend
$env:ALLOW_REMOTE_TEST_WRITES='true'
npm run test:postgres
Remove-Item Env:ALLOW_REMOTE_TEST_WRITES
npm run check:postgres
```

Não execute a suíte MySQL completa apontando para PostgreSQL: ela usa recursos
específicos do MySQL. `test:postgres` é a comprovação de compatibilidade remota.

## Demonstração fictícia

O provisionador é idempotente e aceita somente e-mails no domínio reservado
`@example.invalid`. Ele cria uma conta profissional, uma conta de paciente,
agenda recorrente de segunda a sexta e uma consulta futura fictícia. Se senhas
não forem informadas, ele gera hashes aleatórios que nunca são impressos; o modo
demo usa rotas específicas para emitir o mesmo JWT seguro da aplicação.

```powershell
Set-Location backend
$env:ALLOW_REMOTE_DEMO_SEED='true'
npm run demo:provision
Remove-Item Env:ALLOW_REMOTE_DEMO_SEED
```

O script não envia mensagens, não recria o schema e não acessa o MySQL. Para a
demonstração hospedada, consulte `docs/demonstracao-gratuita.md`.
