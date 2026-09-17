import fs from 'node:fs';

// 1. autenticacao.js
let aut = fs.readFileSync('backend/src/middlewares/autenticacao.js', 'utf8');
aut = aut.replace('req.profissional_id = user.profissional_id || req.usuario.profissional_id || 1;', 'req.profissional_id = user.profissional_id || req.usuario.profissional_id || null;');
fs.writeFileSync('backend/src/middlewares/autenticacao.js', aut, 'utf8');

// 2. agenda.routes.js
let agenda = fs.readFileSync('backend/src/routes/agenda.routes.js', 'utf8');
// Em mutate
agenda = agenda.replace(
  /const isSuperAdmin = req\.usuario\.tipo === 'admin';\s*const id = isSuperAdmin && \(req\.body\?\.profissional_id \?\? req\.query\.profissional_id\) \? professionalId\(req\.body\?\.profissional_id \?\? req\.query\.profissional_id\) : \(req\.profissional_id \|\| professionalId\(req\.body\?\.profissional_id \?\? req\.query\.profissional_id\)\);/,
  `const requestedId = req.body?.profissional_id ?? req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    if (req.usuario.tipo === 'psicologa' && req.profissional_id && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(requestedId ?? req.profissional_id ?? 1);`
);

// Em GET /
agenda = agenda.replace(
  /const isSuperAdmin = req\.usuario\.tipo === 'admin';\s*const id = isSuperAdmin && req\.query\.profissional_id \? professionalId\(req\.query\.profissional_id\) : \(req\.profissional_id \|\| professionalId\(req\.query\.profissional_id\)\);/,
  `const requestedId = req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    if (req.usuario.tipo === 'psicologa' && req.profissional_id && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(requestedId ?? req.profissional_id ?? 1);`
);

fs.writeFileSync('backend/src/routes/agenda.routes.js', agenda, 'utf8');

// 3. agendamentos.routes.js
let ag = fs.readFileSync('backend/src/routes/agendamentos.routes.js', 'utf8');
ag = ag.replace(
  /const isSuperAdmin = req\.usuario\.tipo === "admin";\s*const profId = isSuperAdmin && req\.query\.profissional_id \? Number\(req\.query\.profissional_id\) : req\.profissional_id;\s*const query = isSuperAdmin && !req\.query\.profissional_id\s*\? `SELECT[^`]+`\s*: `SELECT[^`]+`;\s*const params = isSuperAdmin && !req\.query\.profissional_id \? \[\] : \[profId\];/,
  `const profId = req.profissional_id || (req.query.profissional_id ? Number(req.query.profissional_id) : null);
      const query = profId
        ? \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE profissional_id = ? ORDER BY inicio ASC\`
        : \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos ORDER BY inicio ASC\`;
      const params = profId ? [profId] : [];`
);
fs.writeFileSync('backend/src/routes/agendamentos.routes.js', ag, 'utf8');

console.log('Arquivos refinados com sucesso');

