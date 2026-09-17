import fs from 'node:fs';

// 1. autenticacao.js
let aut = fs.readFileSync('backend/src/middlewares/autenticacao.js', 'utf8');
aut = aut.replace(
  'req.profissional_id = user.profissional_id || req.usuario.profissional_id || null;',
  'req.profissional_id = user.profissional_id || req.usuario.profissional_id || 1;'
);
fs.writeFileSync('backend/src/middlewares/autenticacao.js', aut, 'utf8');

// 2. agenda.routes.js
let agenda = fs.readFileSync('backend/src/routes/agenda.routes.js', 'utf8');
agenda = agenda.replace(
  `const requestedId = req.body?.profissional_id ?? req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    if (req.usuario.tipo === 'psicologa' && req.profissional_id && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(requestedId ?? req.profissional_id ?? 1);`,
  `const requestedId = req.body?.profissional_id ?? req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    const hasFixedProfile = req.usuario.tipo === 'psicologa' && Boolean(req.usuario.profissional_id);
    if (hasFixedProfile && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(hasFixedProfile ? req.profissional_id : (requestedId ?? req.profissional_id ?? 1));`
);

agenda = agenda.replace(
  `const requestedId = req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    if (req.usuario.tipo === 'psicologa' && req.profissional_id && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(requestedId ?? req.profissional_id ?? 1);`,
  `const requestedId = req.query.profissional_id;
    if (requestedId != null) professionalId(requestedId);
    const hasFixedProfile = req.usuario.tipo === 'psicologa' && Boolean(req.usuario.profissional_id);
    if (hasFixedProfile && requestedId != null && Number(requestedId) !== req.profissional_id) {
      throw new AgendaError('Acesso não autorizado para este profissional.', 403);
    }
    const id = professionalId(hasFixedProfile ? req.profissional_id : (requestedId ?? req.profissional_id ?? 1));`
);
fs.writeFileSync('backend/src/routes/agenda.routes.js', agenda, 'utf8');

console.log('Correção de profissional_id aplicada');

