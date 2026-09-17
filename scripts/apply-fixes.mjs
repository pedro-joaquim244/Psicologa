import fs from 'node:fs';

// 1. Atualizar backend/src/services/coreSchema.js
let coreSchema = fs.readFileSync('backend/src/services/coreSchema.js', 'utf8');
if (!coreSchema.includes('profissional_id INT UNSIGNED NULL')) {
  coreSchema = coreSchema.replace(
    'email_verificado_em TIMESTAMP NULL DEFAULT NULL',
    'email_verificado_em TIMESTAMP NULL DEFAULT NULL,\n    profissional_id INT UNSIGNED NULL,\n    INDEX idx_usuario_admin_profissional (profissional_id),\n    CONSTRAINT fk_usuario_admin_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE SET NULL'
  );
  coreSchema = coreSchema.replace(
    'export async function ensureCoreSchema(connection = db) {',
    `export async function ensureCoreSchema(connection = db) {
  const [adminColumns] = await connection.query("SHOW COLUMNS FROM usuarios_admin LIKE 'profissional_id'");
  if (!adminColumns.length) {
    await connection.query(\`ALTER TABLE usuarios_admin
      ADD COLUMN profissional_id INT UNSIGNED NULL,
      ADD CONSTRAINT fk_usuario_admin_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE SET NULL\`);
  }
  await connection.query(\`UPDATE usuarios_admin u
    JOIN profissionais p ON LOWER(u.email) = LOWER(p.email)
    SET u.profissional_id = p.id
    WHERE u.profissional_id IS NULL AND u.tipo = 'psicologa'\`);
  await connection.query(\`UPDATE usuarios_admin
    SET profissional_id = 1
    WHERE profissional_id IS NULL AND tipo = 'psicologa' AND EXISTS (SELECT 1 FROM profissionais WHERE id = 1)\`);`
  );
  fs.writeFileSync('backend/src/services/coreSchema.js', coreSchema, 'utf8');
  console.log('✓ coreSchema.js atualizado');
}

// 2. Atualizar backend/src/services/authentication.js
let auth = fs.readFileSync('backend/src/services/authentication.js', 'utf8');
if (!auth.includes('profissional_id')) {
  auth = auth.replace(
    "extra: ', tipo'",
    "extra: ', tipo, profissional_id'"
  );
  auth = auth.replace(
    "{ id: user.id, tipo, email: user.email, email_verificado: true },",
    "{ id: user.id, tipo, email: user.email, email_verificado: true, ...(user.profissional_id ? { profissional_id: user.profissional_id } : {}) },"
  );
  auth = auth.replace(
    "...(kind === 'paciente' ? { telefone: user.telefone } : {}),",
    "...(kind === 'paciente' ? { telefone: user.telefone } : {}),\n      ...(user.profissional_id ? { profissional_id: user.profissional_id } : {}),"
  );
  fs.writeFileSync('backend/src/services/authentication.js', auth, 'utf8');
  console.log('✓ authentication.js atualizado');
}

// 3. Atualizar backend/src/middlewares/autenticacao.js
let autMiddleware = fs.readFileSync('backend/src/middlewares/autenticacao.js', 'utf8');
if (!autMiddleware.includes('req.profissional_id')) {
  autMiddleware = autMiddleware.replace(
    "SELECT id, tipo, email, email_verificado_em FROM usuarios_admin WHERE id = ? AND ativo = 1 LIMIT 1",
    "SELECT id, tipo, email, email_verificado_em, profissional_id FROM usuarios_admin WHERE id = ? AND ativo = 1 LIMIT 1"
  );
  autMiddleware = autMiddleware.replace(
    "if (!user || user.tipo !== req.usuario.tipo || user.email !== req.usuario.email || !user.email_verificado_em) {\n      return res.status(401).json({ erro: 'Sua sessão não está mais disponível. Entre novamente.' });\n    }\n    next();",
    "if (!user || user.tipo !== req.usuario.tipo || user.email !== req.usuario.email || !user.email_verificado_em) {\n      return res.status(401).json({ erro: 'Sua sessão não está mais disponível. Entre novamente.' });\n    }\n    req.profissional_id = user.profissional_id || req.usuario.profissional_id || 1;\n    next();"
  );
  fs.writeFileSync('backend/src/middlewares/autenticacao.js', autMiddleware, 'utf8');
  console.log('✓ autenticacao.js atualizado');
}

// 4. Atualizar backend/src/routes/agendamentos.routes.js
let agendamentos = fs.readFileSync('backend/src/routes/agendamentos.routes.js', 'utf8');
if (!agendamentos.includes('req.profissional_id')) {
  // GET /
  agendamentos = agendamentos.replace(
    `      const [agendamentos] = await db.query(
        \`
        SELECT
          id,
          profissional_id,
          nome_cliente,
          email_cliente,
          telefone_cliente,
          modalidade,
          inicio,
          fim,
          status,
          google_event_id,
          origem,
          criado_em,
          atualizado_em
        FROM agendamentos
        ORDER BY inicio ASC
        \`
      );`,
    `      const isSuperAdmin = req.usuario.tipo === "admin";
      const profId = isSuperAdmin && req.query.profissional_id ? Number(req.query.profissional_id) : req.profissional_id;
      const query = isSuperAdmin && !req.query.profissional_id
        ? \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos ORDER BY inicio ASC\`
        : \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE profissional_id = ? ORDER BY inicio ASC\`;
      const params = isSuperAdmin && !req.query.profissional_id ? [] : [profId];
      const [agendamentos] = await db.query(query, params);`
  );

  // GET /:id
  agendamentos = agendamentos.replace(
    `      const [agendamentos] = await db.query(
        \`
        SELECT
          id,
          profissional_id,
          nome_cliente,
          email_cliente,
          telefone_cliente,
          modalidade,
          inicio,
          fim,
          status,
          google_event_id,
          origem,
          criado_em,
          atualizado_em
        FROM agendamentos
        WHERE id = ?
        LIMIT 1
        \`,
        [id]
      );`,
    `      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE id = ? LIMIT 1\`
        : \`SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE id = ? AND profissional_id = ? LIMIT 1\`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [agendamentos] = await db.query(query, params);`
  );

  // PATCH /:id/confirmar
  agendamentos = agendamentos.replace(
    `      const [resultado] = await db.query(
        \`
        UPDATE agendamentos
        SET status = 'confirmado'
        WHERE id = ?
          AND status = 'agendado'
        \`,
        [id]
      );`,
    `      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? \`UPDATE agendamentos SET status = 'confirmado' WHERE id = ? AND status = 'agendado'\`
        : \`UPDATE agendamentos SET status = 'confirmado' WHERE id = ? AND status = 'agendado' AND profissional_id = ?\`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);`
  );

  // PATCH /:id/concluir
  agendamentos = agendamentos.replace(
    `      const [resultado] = await db.query(
        \`
        UPDATE agendamentos
        SET status = 'concluido'
        WHERE id = ?
          AND status IN ('agendado', 'confirmado')
        \`,
        [id]
      );`,
    `      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? \`UPDATE agendamentos SET status = 'concluido' WHERE id = ? AND status IN ('agendado', 'confirmado')\`
        : \`UPDATE agendamentos SET status = 'concluido' WHERE id = ? AND status IN ('agendado', 'confirmado') AND profissional_id = ?\`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);`
  );

  // PATCH /:id/cancelar
  agendamentos = agendamentos.replace(
    `      const [resultado] = await db.query(
        \`
        UPDATE agendamentos
        SET status = 'cancelado'
        WHERE id = ?
          AND status != 'cancelado'
        \`,
        [id]
      );`,
    `      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? \`UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status != 'cancelado'\`
        : \`UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status != 'cancelado' AND profissional_id = ?\`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);`
  );

  fs.writeFileSync('backend/src/routes/agendamentos.routes.js', agendamentos, 'utf8');
  console.log('✓ agendamentos.routes.js atualizado');
}

// 5. Atualizar backend/src/routes/agenda.routes.js
let agenda = fs.readFileSync('backend/src/routes/agenda.routes.js', 'utf8');
if (!agenda.includes('isSuperAdmin')) {
  // Em mutate
  agenda = agenda.replace(
    "const id = professionalId(req.body?.profissional_id ?? req.query.profissional_id);",
    "const isSuperAdmin = req.usuario.tipo === 'admin';\n    const id = isSuperAdmin && (req.body?.profissional_id ?? req.query.profissional_id) ? professionalId(req.body?.profissional_id ?? req.query.profissional_id) : (req.profissional_id || professionalId(req.body?.profissional_id ?? req.query.profissional_id));"
  );
  // Em GET /
  agenda = agenda.replace(
    "const id = professionalId(req.query.profissional_id);",
    "const isSuperAdmin = req.usuario.tipo === 'admin';\n    const id = isSuperAdmin && req.query.profissional_id ? professionalId(req.query.profissional_id) : (req.profissional_id || professionalId(req.query.profissional_id));"
  );
  fs.writeFileSync('backend/src/routes/agenda.routes.js', agenda, 'utf8');
  console.log('✓ agenda.routes.js atualizado');
}

// 6. Atualizar src/pages/admin/LoginAdmin.jsx
let loginAdmin = fs.readFileSync('src/pages/admin/LoginAdmin.jsx', 'utf8');
if (!loginAdmin.includes('confirmPassword')) {
  loginAdmin = loginAdmin.replace(
    "const [password, setPassword] = useState(\"\");",
    "const [password, setPassword] = useState(\"\");\n  const [confirmPassword, setConfirmPassword] = useState(\"\");"
  );
  loginAdmin = loginAdmin.replace(
    "if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Informe um e-mail válido.'); return; }\n    if (registering && (name.trim().length < 3 || !/^\d{10,13}$/.test(phone.replace(/\D/g, '')))) { setError('Informe seu nome completo e WhatsApp com DDD.'); return; }\n    if (registering && (password.length < 8 || new TextEncoder().encode(password).length > 72)) {\n      setError('Use uma senha com pelo menos 8 caracteres. Se ela for muito longa, reduza-a.');\n      return;\n    }",
    `if (registering) {
      if (!name.trim() || !phone.trim() || !email.trim() || !password) {
        setError('Preencha todos os campos obrigatórios.');
        return;
      }
      if (name.trim().length < 3) {
        setError('Informe seu nome completo.');
        return;
      }
      if (!/^\\d{10,13}$/.test(phone.replace(/\\D/g, ''))) {
        setError('Informe um WhatsApp válido com DDD.');
        return;
      }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())) {
        setError('Informe um e-mail válido.');
        return;
      }
      if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
        setError('Use uma senha com pelo menos 8 caracteres. Se ela for muito longa, reduza-a.');
        return;
      }
      if (confirmPassword && password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }
    } else {
      if (!email.trim() || !password) {
        setError('Informe o e-mail e a senha.');
        return;
      }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email.trim())) {
        setError('Informe um e-mail válido.');
        return;
      }
    }`
  );
  // Adicionar campo de confirmar senha
  const passwordFieldTarget = `<div className="admin-field"><div className="password-label"><label htmlFor="admin-password">Senha</label>{registering && <span id="password-requirement">8+ caracteres</span>}</div><span className="field-control"><i className="bi bi-lock" aria-hidden="true" /><input id="admin-password" aria-describedby={registering ? "password-requirement" : undefined} type={showPassword ? "text" : "password"} name="senha" value={password} onChange={(event) => { setPassword(event.target.value); setUnverifiedCredentials(null); }} autoComplete={registering ? 'new-password' : 'current-password'} required placeholder={registering ? 'Crie sua senha' : 'Digite sua senha'} disabled={submitting} /><button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-pressed={showPassword} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}><i className={\`bi \${showPassword ? "bi-eye-slash" : "bi-eye"}\`} aria-hidden="true" /></button></span></div>`;
  const passwordFieldReplacement = passwordFieldTarget + `\n            {registering && <div className="admin-field"><div className="password-label"><label htmlFor="admin-confirm-password">Confirmar senha</label></div><span className="field-control"><i className="bi bi-shield-check" aria-hidden="true" /><input id="admin-confirm-password" type={showPassword ? "text" : "password"} name="confirmar_senha" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setUnverifiedCredentials(null); }} autoComplete="new-password" required placeholder="Repita sua senha" disabled={submitting} /></span></div>}`;

  loginAdmin = loginAdmin.replace(passwordFieldTarget, passwordFieldReplacement);
  fs.writeFileSync('src/pages/admin/LoginAdmin.jsx', loginAdmin, 'utf8');
  console.log('✓ LoginAdmin.jsx atualizado');
}

