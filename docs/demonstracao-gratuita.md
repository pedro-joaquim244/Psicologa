# Demonstração gratuita sem domínio e sem e-mail

Este modo publica o backend em um subdomínio gratuito `onrender.com`, mantém o
frontend em sua hospedagem atual e não abre conexões SMTP nem chamadas ao Resend.

## Comportamento

- `DEMO_MODE=true` força todo envio externo de e-mail a permanecer desativado.
- `EMAIL_PROVIDER=disabled` documenta explicitamente a intenção do ambiente.
- `PUBLIC_REGISTRATION_ENABLED=false` bloqueia `POST /api/pacientes/cadastro`
  antes de qualquer insert.
- Reenvios de código e logins de contas não verificadas retornam HTTP 503.
- Resend e SMTP continuam no código para ativação futura.
- `POST /api/demo/paciente` e `POST /api/demo/profissional` emitem o mesmo
  JWT seguro das rotas normais, mas somente para as duas contas fictícias exatas.
- O acesso demonstrativo nunca concede o papel global `admin`; a conta
  profissional usa `psicologa` e permanece limitada ao próprio `profissional_id`.
- A agenda pública resolve a profissional pelo e-mail fictício verificado em vez
  de presumir que seu identificador no banco seja `1`. O mesmo ID resolvido é
  usado na consulta de horários e dentro da transação de reserva.

As contas usam `paciente.demo@example.invalid` e
`profissional.demo@example.invalid`, estão verificadas e têm hashes de senhas
aleatórios que não são impressos nem compartilhados. A interface oferece botões
de acesso demo, então nenhuma senha pública é necessária.

## Inicialização no Render

O `render.yaml` executa `npm run start:demo`. Antes de iniciar a API, o comando
provisiona de modo idempotente apenas os identificadores fictícios reservados.
Ele não remove nem substitui outros profissionais, pacientes ou consultas.

Cadastre manualmente no Render apenas:

- `DATABASE_URL`: URL secreta do Session pooler do Supabase;
- `JWT_SECRET`: valor aleatório com pelo menos 32 bytes;
- `FRONTEND_URL`: origem HTTPS exata do frontend, sem caminho.

`PUBLIC_PROFESSIONAL_ID` é opcional. No modo demonstrativo, deixe-o vazio para
que a API localize automaticamente a conta definida em `DEMO_PROFESSIONAL_EMAIL`.

Após o Render fornecer a URL `https://<servico>.onrender.com`, configure no
frontend `VITE_API_URL` com essa origem, sem `/api`, e gere um novo build.

## Ativação futura do e-mail

Quando houver domínio/remetente validado:

1. troque o start command para `npm start`;
2. defina `DEMO_MODE=false`;
3. defina `EMAIL_PROVIDER=resend`;
4. cadastre `RESEND_API_KEY` e `EMAIL_FROM` como secrets;
5. defina `PUBLIC_REGISTRATION_ENABLED=true`;
6. valide um envio controlado antes de liberar o cadastro no frontend.

Nenhuma chave do Resend deve usar prefixo `VITE_` ou ser gravada no Git.
