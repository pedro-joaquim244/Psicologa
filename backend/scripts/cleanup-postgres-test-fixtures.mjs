import 'dotenv/config';

if (process.env.ALLOW_REMOTE_TEST_WRITES !== 'true') {
  throw new Error('Defina ALLOW_REMOTE_TEST_WRITES=true para remover apenas fixtures codex-pg-* conhecidos.');
}

const { default: db } = await import('../src/database.js');
if (db.dialect !== 'postgres') throw new Error('Esta limpeza exige DB_CLIENT=postgres.');

const professionalPattern = 'codex-pg-%-profissional@example.invalid';
const patientPattern = 'codex-pg-%-paciente-%@example.invalid';
const connection = await db.getConnection();
try {
  await connection.beginTransaction();
  await connection.query(`DELETE FROM notificacoes_agendamento WHERE agendamento_id IN (
    SELECT a.id FROM agendamentos a JOIN profissionais p ON p.id = a.profissional_id WHERE p.email LIKE ?
  )`, [professionalPattern]);
  await connection.query('DELETE FROM agendamentos WHERE profissional_id IN (SELECT id FROM profissionais WHERE email LIKE ?)', [professionalPattern]);
  await connection.query('DELETE FROM bloqueios_agenda WHERE profissional_id IN (SELECT id FROM profissionais WHERE email LIKE ?)', [professionalPattern]);
  await connection.query('DELETE FROM disponibilidades WHERE profissional_id IN (SELECT id FROM profissionais WHERE email LIKE ?)', [professionalPattern]);
  await connection.query("DELETE FROM verificacoes_email WHERE perfil = 'paciente' AND usuario_id IN (SELECT id FROM pacientes WHERE email LIKE ?)", [patientPattern]);
  await connection.query('DELETE FROM usuarios_admin WHERE email LIKE ?', [professionalPattern]);
  await connection.query('DELETE FROM pacientes WHERE email LIKE ?', [patientPattern]);
  const [removed] = await connection.query('DELETE FROM profissionais WHERE email LIKE ?', [professionalPattern]);
  await connection.commit();
  console.log(JSON.stringify({ removedFixtureProfessionals: removed.affectedRows }));
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
  await db.end();
}
