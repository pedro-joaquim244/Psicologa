import 'dotenv/config';

const warnings = [];
process.on('warning', (warning) => warnings.push({ name: warning.name, message: warning.message }));

const [{ default: db }, { createApp }] = await Promise.all([
  import('../src/database.js'),
  import('../src/app.js'),
]);

if (db.dialect !== 'postgres') throw new Error('Este diagnostico exige DB_CLIENT=postgres.');

let server;
try {
  // Open more than one pooled connection at once. This exercises onConnect and
  // fails if per-client initialization races with the first application query.
  const concurrentChecks = await Promise.all(Array.from({ length: 8 }, () => db.query(
    `SELECT current_setting('TimeZone') AS timezone,
            to_regclass('public.agendamentos') IS NOT NULL AS schema_ok`,
  )));
  const timezones = [...new Set(concurrentChecks.map(([rows]) => rows[0].timezone))];
  const schemaOk = concurrentChecks.every(([rows]) => rows[0].schema_ok === true);

  const expectedTables = [
    'profissionais', 'usuarios_admin', 'pacientes', 'disponibilidades',
    'bloqueios_agenda', 'agendamentos', 'notificacoes_agendamento', 'verificacoes_email',
  ];
  const [tableRows] = await db.query(
    `SELECT COUNT(*)::bigint AS total
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY(?)`,
    [expectedTables],
  );
  const [[counts]] = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM profissionais)::bigint AS profissionais,
       (SELECT COUNT(*) FROM usuarios_admin)::bigint AS usuarios_admin,
       (SELECT COUNT(*) FROM pacientes)::bigint AS pacientes,
       (SELECT COUNT(*) FROM disponibilidades)::bigint AS disponibilidades,
       (SELECT COUNT(*) FROM bloqueios_agenda)::bigint AS bloqueios_agenda,
       (SELECT COUNT(*) FROM agendamentos)::bigint AS agendamentos,
       (SELECT COUNT(*) FROM notificacoes_agendamento)::bigint AS notificacoes_agendamento,
       (SELECT COUNT(*) FROM verificacoes_email)::bigint AS verificacoes_email,
       (
         SELECT COUNT(*) FROM profissionais
         WHERE email LIKE 'codex-pg-%@example.invalid'
       )::bigint AS fixtures_integracao_restantes`,
  );

  const app = createApp({ production: false });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const { port } = server.address();
  const [healthResponse, scheduleResponse] = await Promise.all([
    fetch(`http://127.0.0.1:${port}/api/health`),
    fetch(`http://127.0.0.1:${port}/api/horarios?data=2035-09-18&profissional_id=1`),
  ]);
  const health = await healthResponse.json();
  const schedule = await scheduleResponse.json();

  const result = {
    dialect: db.dialect,
    concurrentQueries: concurrentChecks.length,
    timezone: timezones.length === 1 ? timezones[0] : timezones,
    schemaOk,
    expectedTables: Number(tableRows[0].total),
    rowCounts: counts,
    healthStatus: healthResponse.status,
    healthBodyStatus: health.status,
    scheduleStatus: scheduleResponse.status,
    scheduleContractOk: schedule.data === '2035-09-18' && Array.isArray(schedule.horarios),
    warnings: warnings.map((warning) => warning.message),
  };
  console.log(JSON.stringify(result, null, 2));

  if (!schemaOk || Number(tableRows[0].total) !== expectedTables.length
      || healthResponse.status !== 200 || health.status !== 'ok'
      || scheduleResponse.status !== 200 || !result.scheduleContractOk
      || warnings.some((warning) => warning.message.includes('already executing a query'))) {
    process.exitCode = 1;
  }
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.end();
}
