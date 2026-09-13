import bcrypt from 'bcryptjs';
import db from './database.js';

// Provisionamento explícito, sem senha fixa nem impressão de credenciais.
try {
  const nome = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.ADMIN_PASSWORD;
  if (!nome || nome.length > 150 || !email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !senha || senha.length < 12 || Buffer.byteLength(senha, 'utf8') > 72) {
    throw new Error('Defina ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD (12+ caracteres, até 72 bytes) no ambiente.');
  }
  const [[existing]] = await db.query('SELECT id FROM usuarios_admin WHERE email = ? LIMIT 1', [email]);
  if (existing) console.log('Esse usuário já existe. Nenhum dado foi alterado.');
  else {
    await db.query("INSERT INTO usuarios_admin (nome, email, senha, tipo, ativo) VALUES (?, ?, ?, 'psicologa', 1)", [nome, email, await bcrypt.hash(senha, 12)]);
    console.log('Usuário criado. O acesso exige confirmação por e-mail.');
  }
} catch (error) {
  console.error('Não foi possível criar o usuário:', error.code || error.message);
  process.exitCode = 1;
} finally { await db.end(); }
