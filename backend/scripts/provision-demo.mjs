import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import db from '../src/database.js';

function demoEmail(name, fallback) {
  const value = String(process.env[name] || fallback).trim().toLowerCase();
  if (!/^[^\s@]+@example\.invalid$/.test(value)) {
    throw new Error(`${name} deve usar o domínio reservado @example.invalid.`);
  }
  return value;
}

function demoPassword(name) {
  const value = String(process.env[name] || randomBytes(32).toString('base64url'));
  if (value.length < 12 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new Error(`${name} deve ter entre 12 e 72 bytes.`);
  }
  return value;
}

function nextWeekday(offset = 7) {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const explicitlyAllowed = process.env.ALLOW_REMOTE_DEMO_SEED === 'true';
const automaticDemoProvision = process.env.DEMO_MODE === 'true' && process.env.DEMO_AUTO_PROVISION === 'true';
if (!explicitlyAllowed && !automaticDemoProvision) {
  throw new Error('Provisionamento bloqueado. Autorize a execução manual ou habilite o provisionamento do modo demo.');
}
if (db.dialect !== 'postgres') throw new Error('O provisionamento de demonstração exige DB_CLIENT=postgres.');

const fixture = {
  professionalName: String(process.env.DEMO_PROFESSIONAL_NAME || 'Profissional Demonstração').trim(),
  professionalEmail: demoEmail('DEMO_PROFESSIONAL_EMAIL', 'profissional.demo@example.invalid'),
  professionalPassword: demoPassword('DEMO_PROFESSIONAL_PASSWORD'),
  patientName: String(process.env.DEMO_PATIENT_NAME || 'Paciente Demonstração').trim(),
  patientEmail: demoEmail('DEMO_PATIENT_EMAIL', 'paciente.demo@example.invalid'),
  patientPassword: demoPassword('DEMO_PATIENT_PASSWORD'),
};

if (!fixture.professionalName || fixture.professionalName.length > 150
    || !fixture.patientName || fixture.patientName.length > 150) {
  throw new Error('Os nomes fictícios devem ter entre 1 e 150 caracteres.');
}
if (fixture.professionalEmail === fixture.patientEmail) {
  throw new Error('As contas fictícias precisam usar e-mails distintos.');
}

const connection = await db.getConnection();
try {
  await connection.beginTransaction();

  let [[professional]] = await connection.query(
    'SELECT id FROM profissionais WHERE email = ? FOR UPDATE',
    [fixture.professionalEmail],
  );
  if (!professional) {
    const [inserted] = await connection.query(
      'INSERT INTO profissionais (nome, email, telefone, ativo) VALUES (?, ?, ?, 1)',
      [fixture.professionalName, fixture.professionalEmail, '(11) 90000-0000'],
    );
    professional = { id: inserted.insertId };
  } else {
    await connection.query(
      'UPDATE profissionais SET nome = ?, telefone = ?, ativo = 1 WHERE id = ?',
      [fixture.professionalName, '(11) 90000-0000', professional.id],
    );
  }

  const [[admin]] = await connection.query(
    'SELECT id FROM usuarios_admin WHERE email = ? FOR UPDATE',
    [fixture.professionalEmail],
  );
  let adminId = admin?.id;
  if (adminId) {
    await connection.query(
      `UPDATE usuarios_admin
       SET nome = ?, tipo = 'psicologa', ativo = 1,
           email_verificado_em = CURRENT_TIMESTAMP, profissional_id = ?
       WHERE id = ?`,
      [fixture.professionalName, professional.id, adminId],
    );
  } else {
    const professionalHash = await bcrypt.hash(fixture.professionalPassword, 12);
    const [inserted] = await connection.query(
      `INSERT INTO usuarios_admin
       (nome, email, senha, tipo, ativo, email_verificado_em, profissional_id)
       VALUES (?, ?, ?, 'psicologa', 1, CURRENT_TIMESTAMP, ?)`,
      [fixture.professionalName, fixture.professionalEmail, professionalHash, professional.id],
    );
    adminId = inserted.insertId;
  }

  const [[patient]] = await connection.query(
    'SELECT id FROM pacientes WHERE email = ? FOR UPDATE',
    [fixture.patientEmail],
  );
  let patientId = patient?.id;
  if (patientId) {
    await connection.query(
      `UPDATE pacientes
       SET nome = ?, telefone = ?, ativo = 1, email_verificado_em = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [fixture.patientName, '(11) 98888-0000', patientId],
    );
  } else {
    const patientHash = await bcrypt.hash(fixture.patientPassword, 12);
    const [inserted] = await connection.query(
      `INSERT INTO pacientes
       (nome, email, telefone, senha, ativo, email_verificado_em)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
      [fixture.patientName, fixture.patientEmail, '(11) 98888-0000', patientHash],
    );
    patientId = inserted.insertId;
  }

  let availabilityCreated = 0;
  for (const weekday of [1, 2, 3, 4, 5]) {
    const [[existing]] = await connection.query(
      `SELECT id FROM disponibilidades
       WHERE profissional_id = ? AND data_especifica IS NULL AND dia_semana = ?
         AND hora_inicio = '09:00:00' AND hora_fim = '12:00:00'
         AND duracao_minutos = 50 AND intervalo_minutos = 10 AND ativo = 1
       LIMIT 1 FOR UPDATE`,
      [professional.id, weekday],
    );
    if (!existing) {
      await connection.query(
        `INSERT INTO disponibilidades
         (profissional_id, dia_semana, hora_inicio, hora_fim, duracao_minutos, intervalo_minutos, ativo)
         VALUES (?, ?, '09:00:00', '12:00:00', 50, 10, 1)`,
        [professional.id, weekday],
      );
      availabilityCreated += 1;
    }
  }

  let appointmentCreated = false;
  let appointmentDate;
  const [[existingAppointment]] = await connection.query(
    `SELECT id, inicio FROM agendamentos
     WHERE profissional_id = ? AND paciente_id = ? AND origem = 'demo-provision'
       AND status IN ('agendado', 'confirmado') AND inicio >= CURRENT_DATE
     ORDER BY inicio DESC LIMIT 1 FOR UPDATE`,
    [professional.id, patientId],
  );
  if (existingAppointment) {
    appointmentDate = String(existingAppointment.inicio).slice(0, 10);
  } else {
    for (let offset = 7; offset <= 60 && !appointmentCreated; offset += 1) {
      const candidate = nextWeekday(offset);
      const [[occupied]] = await connection.query(
        `SELECT id FROM agendamentos
         WHERE profissional_id = ? AND status IN ('agendado', 'confirmado')
           AND inicio < ? AND fim > ? LIMIT 1`,
        [professional.id, `${candidate} 10:50:00`, `${candidate} 10:00:00`],
      );
      if (occupied) continue;
      await connection.query(
        `INSERT INTO agendamentos
         (paciente_id, profissional_id, nome_cliente, email_cliente, telefone_cliente,
          modalidade, inicio, fim, status, origem)
         VALUES (?, ?, ?, ?, ?, 'online', ?, ?, 'confirmado', 'demo-provision')`,
        [patientId, professional.id, fixture.patientName, fixture.patientEmail, '(11) 98888-0000',
          `${candidate} 10:00:00`, `${candidate} 10:50:00`],
      );
      appointmentCreated = true;
      appointmentDate = candidate;
    }
    if (!appointmentCreated) throw new Error('Não foi possível reservar um horário fictício isolado nos próximos 60 dias.');
  }

  await connection.commit();
  console.log(JSON.stringify({
    status: 'ok',
    professionalId: Number(professional.id),
    professionalAccountId: Number(adminId),
    patientId: Number(patientId),
    availabilityCreated,
    appointmentCreated,
    appointmentDate,
    credentialsPrinted: false,
  }, null, 2));
} catch (error) {
  await connection.rollback().catch(() => {});
  throw error;
} finally {
  connection.release();
  await db.end();
}
