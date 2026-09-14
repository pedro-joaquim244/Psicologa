# Auditoria antes das alterações — 13/09/2026

Branch examinada: `demo`. Alteração preexistente em `.gitignore` preservada.

Foram examinados as cinco páginas, as rotas React, componentes públicos e privados, todos os estilos, sessão, cliente HTTP, animações, configuração de imagens, scripts, publicação e todos os módulos do backend. A aplicação já oferece menu mobile, calendário por teclado, cards, filtros, verificação por e-mail e separação das sessões. Minha conta é uma consulta de dados, não um formulário de edição. Cadastro e verificação reutilizam LoginAdmin; não há rotas adicionais para esses estados.

## Achados que orientam a implementação

- O MySQL real possui `slot_ativo` e `uq_horario_agendamento(profissional_id,inicio,slot_ativo)`. Preservar ambos. A transação atual faz leitura simples e não serializa intervalos sobrepostos com inícios diferentes.
- Datas impossíveis são normalizadas pelo JavaScript; IDs, horários e datas passadas não têm validação completa no servidor. Disponibilidade com duração zero pode travar a geração de slots. A consulta por `DATE(inicio)` ignora encontros iniciados no dia anterior e prejudica uso de índice.
- O paciente já é validado no banco e suas consultas são filtradas por `paciente_id`. O middleware profissional verifica apenas o papel do JWT, sem revalidar conta ativa e e-mail.
- Algumas respostas retornam `error.message` do banco; erros JSON do Express não seguem o contrato `{ erro }`. Listagens profissionais e desafios precisam de `no-store`.
- API possui fallback localhost mesmo em build de produção; preservar Vercel Services e permitir mesma origem no build sem configuração explícita.
- SMTP tem TLS, timeout, HMAC, expiração, tentativas e consumo transacional. Manter. Corrigir exemplo de ambiente com remetente inválido e script administrativo com senha fixa/impressa.
- Login usa altura fixa e `overflow: clip`; textos longos/teclado podem cortar controles. Modal não limita altura. Inputs de agenda/agendamento podem ficar abaixo de 16px. Cabeçalho administrativo tem pouco espaço em 320px. Nomes longos precisam quebrar em grids.
- GSAP tem cleanup e reduced motion. Imagens já têm variantes WebP; corrigir `sizes` superdimensionado da imagem imersiva. Não regenerar imagens nem redesenhar a landing.
- Backend inicial: 15/15 testes passaram em tabelas temporárias MySQL, sem dados reais alterados. Build inicial passou: JS 472,72 kB, CSS 388,80 kB (sem gzip). Playwright inicial em execução como referência.

Não há necessidade de migration para as correções planejadas: a linha existente de `profissionais` pode serializar reservas e os índices existentes atendem o volume atual. Migração de índices adicionais deve depender de medição de volume/EXPLAIN, não de suposição.
