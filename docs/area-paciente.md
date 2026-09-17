# Área do paciente

Implementação integrada ao AuthContext, login com confirmação de e-mail, Navbar, Footer, serviço de API e calendário já existentes. A interface conserva Cormorant Garamond, Manrope, fundo creme, verde sálvia, linhas finas e movimento discreto com suporte a movimento reduzido.

## Rotas

| Camada | Rota | Comportamento |
| --- | --- | --- |
| Frontend | `/minhas-consultas` | Lista privada, filtros, contadores, detalhes e cancelamento |
| Frontend | `/minha-conta` | Consulta dos próprios dados da conta; não altera cadastro |
| Backend | `GET /api/usuario/agendamentos` | Lista somente os agendamentos do paciente identificado pelo JWT |
| Backend | `PATCH /api/usuario/agendamentos/:id/cancelar` | Cancela somente um agendamento desse paciente |

`GET /api/pacientes/me`, `/login`, `/cadastro`, `/adm/login`, `/adm/agenda`, `/api/horarios` e `/api/agendamentos` já existiam e foram reutilizados.

## Banco e privacidade

O esquema real foi conferido: `pacientes.id` e `agendamentos.paciente_id` são `INT UNSIGNED`, com índice e chave estrangeira. `paciente_id` permite `NULL`, preservando agendamentos antigos. Não houve alteração no banco; nenhum SQL adicional é necessário. Para instalações antigas que ainda não receberam o cadastro de pacientes, permanece disponível a migração aditiva existente: `cd backend` e `npm run migrate`.

Os middlewares validam assinatura e expiração do JWT, perfil de paciente, conta ativa e e-mail confirmado. A listagem usa `WHERE paciente_id = req.usuario.id`. O cancelamento usa `WHERE id = ? AND paciente_id = req.usuario.id`. IDs enviados no corpo ou na query não escolhem o proprietário. Uma consulta alheia e um ID inexistente recebem a mesma resposta `404`. Registros sem vínculo não aparecem para nenhum paciente; não se infere propriedade pelo e-mail ou nome.

São retornados somente `id`, `modalidade`, `inicio`, `fim`, `status` e `criado_em`, com `Cache-Control: no-store`. Nenhuma informação clínica ou lista administrativa é enviada ao paciente.

O POST de agendamento já exigia login de paciente: essa regra foi preservada. Ele obtém `paciente_id`, nome, e-mail e telefone da conta validada no servidor. O calendário de disponibilidade continua público.

Paciente e profissional permanecem no mesmo AuthContext, com sessões independentes. Paciente usa `paciente_token` e `paciente_usuario`; profissional conserva `psicologa_token` e `psicologa_usuario`. O logout e o `401` de uma sessão não apagam a outra. Sessões antigas de paciente são migradas automaticamente. Uma resposta atrasada com token antigo não remove uma sessão nova.

## Status, datas e cancelamento

- Marcadas: `agendado` e `confirmado`, com rótulos Agendada e Confirmada.
- Realizadas: `concluido`, com rótulo Realizada.
- Canceladas: `cancelado`, com rótulo Cancelada.
- Encontros futuros ativos: mais próximo primeiro. Histórico: mais recente primeiro.
- Datas MySQL mantêm o horário de parede do consultório, exibido como horário de Brasília. A classificação de encontros futuros também usa `America/Sao_Paulo`.

O cancelamento preserva exatamente a política do endpoint administrativo atual: permite qualquer status diferente de `cancelado`, inclusive `concluido`, sem antecedência mínima. Essa condição fica localizada no UPDATE da nova rota, permitindo definir uma política futura. Nenhuma nova regra clínica ou comercial foi presumida.

Não são excluídos registros. O status cancelado deixa de ocupar o índice de horário ativo e é desconsiderado pela consulta de disponibilidade existente. Repetir um cancelamento concluído é idempotente. A interface atualiza registro, contadores e filtros sem recarregar a página.

Os detalhes aceitam futuramente uma URL HTTPS de sessão por propriedade explícita do componente. A API atual não fornece esse dado e nenhum link de reunião é inventado.

## Como conferir na interface

1. Abra `/minhas-consultas` sem sessão: será redirecionado a `/login`. Entre e confirme o e-mail para retornar à página solicitada.
2. No cabeçalho, clique no primeiro nome e em **Minhas consultas**. No celular, abra o menu principal antes. O dropdown também contém **Minha conta** e **Sair**.
3. Alterne **Todas**, **Marcadas**, **Realizadas** e **Canceladas**. A lista muda imediatamente, sem outra chamada de listagem. Consultas concluídas/canceladas existentes permitem conferir o histórico.
4. Expanda **Ver detalhes** e confira data, horário, modalidade, status e solicitação. Use Escape ou Voltar no modal para desistir de cancelar.
5. Em uma consulta de teste, clique em **Cancelar consulta** e confirme. Ela deve sair de Marcadas e aparecer em Canceladas, com os contadores atualizados. No calendário, o horário volta a aparecer se nenhuma outra reserva ou bloqueio o ocupar.
6. Crie uma consulta pelo calendário da landing. Ela aparece em Minhas consultas → Marcadas.
7. Com contas de teste A e B, confirme que cada conta vê somente suas consultas. Mesmo usando manualmente o ID da consulta de A com o JWT de B, o cancelamento responde `404`.
8. Entre também na conta profissional. Sair do paciente deve preservar `/adm/agenda`, e o inverso também preserva a sessão do paciente.

## Arquivos criados

- `backend/src/routes/usuario.routes.js`
- `backend/tests/patient-appointments.test.js`
- `src/components/Shared/SectionLink.jsx`
- `src/components/UserMenu/UserMenu.jsx`
- `src/components/patient/ProtectedPatientRoute.jsx`
- `src/components/patient/PatientLayout.jsx`
- `src/components/patient/AppointmentItem.jsx`
- `src/pages/MinhasConsultas.jsx`
- `src/pages/MinhaConta.jsx`
- `src/utils/patientAppointments.js`
- `src/styles/patient.css`
- `tests/patient-appointments.spec.js`
- `docs/area-paciente.md`

## Arquivos alterados nesta funcionalidade

- `backend/src/server.js`: registro das novas rotas.
- `src/App.jsx`: páginas protegidas do paciente e preservação da barra final da base do GitHub Pages nos links para a landing.
- `src/context/AuthContext.jsx`: seleção e atualização de sessões independentes.
- `src/services/authStorage.js`: armazenamento separado e migração compatível.
- `src/services/api.js`: listagem/cancelamento privados, dados da conta e limpeza por token.
- `src/pages/admin/LoginAdmin.jsx`: retorno ao destino privado depois de autenticar.
- `src/components/Navbar/Navbar.jsx`: dropdown de paciente e links entre páginas.
- `src/components/Footer/Footer.jsx`: links para seções da landing a partir das novas páginas.
- `src/components/admin/ConfirmationModal.jsx`: textos configuráveis e erro recuperável, mantendo os padrões da agenda.
- `src/styles/navbar.css`: menu de usuário adaptável a desktop e mobile.
- `src/components/Scheduling/Scheduling.jsx`: atualização segura do ScrollTrigger, sem interromper a rolagem por âncoras.
- `src/pages/Home.jsx`: restaura o destino também quando a âncora muda dentro da mesma página.
- `src/styles/global.css`: contém a rotação do ícone decorativo da seção Para quem é, evitando excesso lateral em telas pequenas.
- `tests/email-verification.spec.js`: verifica as chaves próprias do paciente.
- `tests/scheduling.spec.js`: identifica o CTA do hero sem ambiguidade com o CTA da seção Para quem é.
- `scripts/check-pages.mjs`: verifica rotas privadas e links com base `/Psicologa/`.
- `README.md`: sessões, área do paciente e roteiro.

As alterações anteriores de fotos, seção Para quem é, abordagem e telas de entrada foram preservadas.

## Verificação e configuração

```powershell
npm run build
npx playwright test tests/patient-appointments.spec.js tests/admin.spec.js tests/patient-auth.spec.js tests/email-verification.spec.js tests/scheduling.spec.js tests/auth-layout.spec.js
cd backend
npm test
cd ..
```

Os testes de backend usam JWTs assinados e SQL real em tabelas temporárias exclusivas da conexão. Não modificam contas ou agendamentos persistentes e não enviam e-mails reais. Os testes do navegador simulam respostas da API; a entrega real de SMTP não faz parte dessa execução.

```powershell
npm run build:pages
node scripts/check-pages.mjs
npm run build
```

Não foi instalada dependência nem adicionada variável de ambiente. Reutilizam-se `VITE_API_URL`, `FRONTEND_URL`, `JWT_SECRET`, MySQL e SMTP já configurados. O segredo continua apenas no backend. Para disponibilizar a funcionalidade, o backend precisa executar o código atualizado e o frontend precisa receber o novo build. O GitHub Pages hospeda somente o frontend; a API deve permanecer no endereço configurado.

### Resultado da validação

- `npm run build`: aprovado.
- `npm run build:pages` e `node scripts/check-pages.mjs`: aprovados, incluindo acesso direto com fallback `404.html` e links sob `/Psicologa/`.
- `npm test` no backend: 15 testes aprovados, incluindo isolamento entre pacientes, IDs adulterados, JWT inválido/expirado, perfis, cancelamento, disponibilidade, nova reserva e endpoints administrativos.
- Suítes de navegador de consultas, autenticação, cadastro, verificação de e-mail, agenda, agendamento, landing, seção Para quem é e composição editorial: aprovadas nos cenários executados. Matrizes de tamanho são executadas uma única vez; os testes opcionais que exigem credenciais de contas reais não foram executados.
- Interface conferida entre 320 e 1440 pixels na nova página, com navegação por teclado, foco no modal, movimento reduzido e datas em navegador configurado em outro fuso.

### Pendência local

A API que já estava aberta em `localhost:3333` ainda executava a versão anterior e retornou `404` na nova rota. A revisão automática de aprovação bloqueou o comando de reinício por política de execução. No terminal onde o backend está rodando, interrompa com **Ctrl+C** e execute novamente **`npm start`** dentro de `backend`. Não é necessário alterar o `.env`. Os testes acima exercitaram as rotas novas em uma instância isolada com tabelas temporárias, preservando os dados reais.
