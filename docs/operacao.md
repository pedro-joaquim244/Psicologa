# Operação do site

## Monitoramento

Configure o serviço de monitoramento escolhido pela equipe para consultar `GET /api/health` no domínio público da API. A rota verifica a conexão com o banco e retorna `200` com `{ "status": "ok" }`; quando a API ou o banco não estiverem disponíveis, ela retorna `503` sem incluir dados pessoais.

Crie um alerta para duas falhas consecutivas e encaminhe-o ao canal de operação definido pela profissional. Os logs devem ser consultados apenas para diagnosticar falhas: não inclua tokens, senhas, e-mails, telefones ou conteúdo de atendimentos em ferramentas de monitoramento.

## Backup

Use os backups gerenciados do Supabase/PostgreSQL conforme o plano contratado e retenha cópias em local separado quando a política da operação exigir. Antes de depender da rotina, confirme uma restauração em projeto descartável e restrinja o acesso ao armazenamento.

Em um ambiente com credenciais configuradas fora do shell compartilhado, a exportação segue este formato:

```sh
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "backup-$(date +%F).dump"
```

Não coloque senhas, tokens nem arquivos de backup no Git. A conta usada para backup deve ter somente as permissões necessárias para leitura e restauração do banco.

## Restauração

Teste a restauração periodicamente em uma base descartável. Confirme primeiro o nome da base de destino e a origem do arquivo, depois execute:

```sh
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL_DE_TESTE" backup-AAAA-MM-DD.dump
```

Em uma ocorrência real, coloque o agendamento em manutenção, restaure uma cópia validada conforme o procedimento aprovado pela operação e confirme `GET /api/health` antes de liberar novamente o atendimento. Registre data, backup utilizado e resultado da verificação para permitir acompanhamento posterior.
