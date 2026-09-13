# Helena Martins — Psicologia & Escuta

Landing page editorial e área administrativa em React + Vite. O projeto usa Cormorant Garamond e Manrope, Bootstrap Icons e animações GSAP com ScrollTrigger.

## Executar

```sh
npm install
npm run dev
```

O frontend fica em `http://localhost:5173`. A API deve estar ativa em `http://localhost:3333`.

O Vite mantém essa origem com `strictPort`. O backend atual autoriza `http://localhost:5173` no CORS; usar `127.0.0.1` ou outra porta exige ajustar `FRONTEND_URL` no ambiente do backend. O comando `preview` serve para conferir o build; para testar contra a API real, use a origem autorizada.

Para gerar e conferir a versão de produção:

```sh
npm run build
npm run preview
```

## Área administrativa

- `/adm/login`: autenticação da psicóloga;
- `/adm/agenda`: agenda protegida, resumo, filtros e ações de confirmar, concluir e cancelar.

O link discreto **Área profissional** fica na linha inferior do rodapé existente. As credenciais de desenvolvimento fornecidas são `psicologa@email.com` e `123456`.

## Agendamento público

A seção `#agendamento` fica entre o FAQ e o contato final. Os CTAs do hero, menu e atalho mobile levam ao mesmo calendário. Links explicitamente destinados ao WhatsApp continuam abrindo o WhatsApp.

1. Clique em **Agendar uma conversa** e selecione uma data.
2. Escolha um horário retornado por `GET /api/horarios?data=AAAA-MM-DD`.
3. Entre ou crie uma conta de paciente e confirme o código recebido por e-mail. Nome, WhatsApp e e-mail vêm da conta. Escolha Online ou Presencial.
4. Confira o resumo e clique em **Confirmar agendamento**.
5. A reserva usa `POST /api/agendamentos`, com JWT de paciente confirmado por e-mail. O sucesso limpa as seleções e atualiza a disponibilidade. Um conflito `409` atualiza os horários e mantém os dados digitados.
6. Entre pela **Área profissional**, localize a reserva em `/adm/agenda`, confirme, conclua ou cancele e use **Sair** para encerrar a sessão.

A landing não consulta nem exibe a lista de pacientes. Os dados básicos da própria conta ficam na sessão do navegador.

O token e os dados básicos ficam em `localStorage`: `psicologa_token` / `psicologa_usuario` para a profissional e `paciente_token` / `paciente_usuario` para o paciente. A senha nunca é armazenada. As requisições privadas enviam o JWT em `Authorization`; uma resposta `401` remove somente a sessão correspondente ao token rejeitado. Sessões antigas de paciente são migradas automaticamente para suas próprias chaves.

## Área do paciente

No cabeçalho existente, clique no nome do paciente e em **Minhas consultas**. No celular, abra primeiro o menu principal. `/minhas-consultas` oferece filtros instantâneos, detalhes e cancelamento com confirmação; `/minha-conta` mostra os dados da própria conta. As duas páginas exigem login de paciente e preservam o destino após a confirmação por e-mail.

`GET /api/usuario/agendamentos` e `PATCH /api/usuario/agendamentos/:id/cancelar` reutilizam os middlewares de JWT e validação da conta. Toda consulta SQL inclui `paciente_id = req.usuario.id`. O banco já possui essa chave estrangeira; novas reservas já a preenchem usando a conta autenticada. Registros antigos sem vínculo não são associados por nome ou e-mail.

Não há migração nova nem dependência adicional. O cancelamento mantém a regra administrativa existente (qualquer status diferente de `cancelado`, sem prazo de antecedência), conserva o histórico e libera a disponibilidade conforme as regras atuais. Os detalhes não exibem links de videochamada inexistentes. Consulte [a entrega e o roteiro de testes](docs/area-paciente.md).

A URL da API é centralizada em `src/services/api.js`. Para apontar para outro endereço, copie `.env.example` para `.env.local` e altere:

```env
VITE_API_URL=http://localhost:3333
```

## Confirmação de e-mail

O cadastro de paciente e cada login (paciente ou profissional) exigem senha e um código enviado ao e-mail da conta. A resposta inicial não contém JWT; a sessão só é criada após confirmar o código. A data `email_verificado_em` fica registrada no banco para uso em futuras notificações. Isso confirma o acesso ao endereço naquele momento; não implementa o envio dessas notificações.

No backend, instale as dependências com `npm install` e execute `npm run migrate` antes de iniciar a API. A migração é aditiva e pode ser repetida: cria a tabela de desafios e acrescenta a data de verificação às contas existentes. Sessões antigas precisam de novo login.

Adicione ao `backend/.env` as variáveis de `backend/.env.example`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `SMTP_FROM`. Use um remetente autorizado pelo provedor. A integração usa [SMTP com Nodemailer](https://nodemailer.com/smtp), com TLS na porta 465 e STARTTLS nas demais (587 por padrão). Reinicie o backend após configurar. Nunca use variáveis `VITE_` para essas credenciais.

Sem SMTP configurado, o envio retorna erro e o acesso permanece bloqueado. Se o cadastro já tiver sido criado antes de uma falha de envio, a tela orienta a tentar novamente pelo login.

Os códigos têm seis dígitos, valem por 10 minutos e são de uso único. O reenvio pode ocorrer após 60 segundos e invalida o código anterior. Há limite de cinco erros e cinco envios por conta em uma janela de 15 minutos, persistido no MySQL, além do limite de requisições por IP no processo da API. O banco guarda um HMAC do código, nunca o código em texto. A validação e o consumo usam transação e bloqueio da conta para evitar reutilização simultânea.

As rotas `POST /api/pacientes/verificar-email` e `/api/auth/verificar-email` recebem `{ desafio, codigo }`. As rotas correspondentes `/reenviar-codigo` recebem `{ desafio }`. O desafio é temporário e fica apenas em memória na tela; recarregar a página exige reiniciar o login.

Para verificar o backend, execute `npm test` dentro de `backend/`, com o MySQL configurado e a migração aplicada. Os testes usam tabelas temporárias na conexão e entrega de e-mail simulada, sem alterar contas reais nem enviar mensagens. A interface é coberta por `tests/email-verification.spec.js` e pelos fluxos de cadastro, login e reserva.

## Estrutura

- `src/pages/Home.jsx`: landing page.
- `src/components/Scheduling/`: calendário, formulário e fluxo público.
- `src/utils/scheduling.js`: datas e validação do agendamento.
- `src/styles/scheduling.css`: composição editorial do calendário e formulário.
- `src/pages/admin/`: login e agenda administrativa.
- `src/components/admin/`: marca, filtros, resumo, consultas, modal e estados de interface.
- `src/context/AuthContext.jsx`: sessão e autenticação.
- `src/services/`: cliente HTTP e armazenamento local.
- `src/config/site.js`: dados da profissional, contato e imagens.
- `src/styles/global.css`: tokens de cor, tipografia, espaçamento e transições.
- `src/styles/admin.css`: layout responsivo da área administrativa.
- `src/lib/motion.js`: integração GSAP/ScrollTrigger com limpeza na desmontagem.

## Design e acessibilidade

A área administrativa reutiliza a mesma identidade da landing: fundo creme, verde profundo, detalhe floral, linhas finas, títulos em Cormorant Garamond e controles em Manrope. A agenda usa linhas editoriais responsivas em vez de tabelas largas.

O projeto inclui navegação por teclado, estados de foco, modal com foco preso e retorno ao acionador, mensagens acessíveis, alternativa para movimento reduzido e layouts testados entre 320 e 1920 pixels.

## Testes

```sh
npm run build
npm run test:e2e
```

Os testes Playwright cobrem a landing e a área administrativa em desktop, celular e movimento reduzido. São verificados login, proteção de rota, persistência e expiração da sessão, filtros, ações, modal, ausência de rolagem horizontal, imagens, menu, FAQ, âncoras e animações.

Para executar apenas a verificação de leitura contra a API local real no PowerShell:

```powershell
$env:REAL_API='1'; npx playwright test tests/admin.spec.js -g "integração de leitura" --project=desktop
```

Esse teste exige `REAL_ADMIN_TOKEN` de uma sessão confirmada por e-mail e lista os agendamentos sem alterar status. Obtenha o token fazendo login normalmente em uma conta de teste. Os demais testes administrativos simulam a API.

O teste completo com a API real é opcional:

```powershell
$env:REAL_BOOKING='1'; npx playwright test tests/scheduling-live.spec.js --project=desktop
```

Ele exige `REAL_ADMIN_TOKEN` e `REAL_PATIENT_TOKEN` de contas de teste já confirmadas por e-mail. Use um paciente dedicado, identificado pelo nome como teste. Verifica reserva, disponibilidade, confirmação e saída do painel, e cancela apenas a reserva criada ao terminar. Requer um horário livre nos próximos 14 dias. O registro cancelado permanece no histórico. A suíte normal simula a entrega do código e cobre cadastro, login, conflito, erro, lista vazia, validação, teclado e respostas fora de ordem. Não existe código fixo nem bypass de verificação na API real.

## Publicação no GitHub Pages

```sh
npm run build:pages
npm run deploy
```

`build:pages` usa a base `/Psicologa/` e cria `dist/404.html`, permitindo abrir diretamente rotas como `/Psicologa/adm/login` no GitHub Pages.

Depois desse build, `node scripts/check-pages.mjs` verifica a landing, assets e rotas administrativas em um servidor estático local que reproduz o fallback `404.html` do Pages. Para voltar à suíte padrão, gere novamente `npm run build`.

Para a integração funcionar na publicação, hospede a API em HTTPS e defina `VITE_API_URL` com esse endereço **antes do build**. Configure `FRONTEND_URL` no backend com a origem do site, por exemplo `https://seu-usuario.github.io` (sem `/Psicologa/`). GitHub Pages hospeda o frontend estático; `localhost:3333` serve apenas ao desenvolvimento local. Nenhum segredo do backend deve ser colocado em variáveis `VITE_`.

## Personalização antes da publicação

Nome, CRP, retrato e contatos presentes na landing são demonstrativos. Atualize `src/config/site.js`, os textos dos componentes e as fotografias de `public/images/` com dados e imagens autorizados antes de publicar.

## Dependências principais

- `react` e `react-dom`;
- `react-router-dom` para as rotas pública e administrativas;
- `gsap` para animações;
- `bootstrap` e `bootstrap-icons`;
- `vite` e `@vitejs/plugin-react`;
- `@playwright/test` para testes no navegador.
