import 'dotenv/config';

const configuredDialect = String(process.env.DB_CLIENT || (process.env.DATABASE_URL ? 'postgres' : 'mysql')).toLowerCase();

if (!['mysql', 'postgres'].includes(configuredDialect)) {
  throw new Error('DB_CLIENT deve ser "mysql" ou "postgres".');
}

function normalizeDatabaseError(error) {
  if (!error || configuredDialect !== 'postgres') return error;
  const postgresCode = error.code;
  const mysqlCompatibleCodes = {
    '23505': 'ER_DUP_ENTRY',
    '23P01': 'ER_DUP_ENTRY',
    '40P01': 'ER_LOCK_DEADLOCK',
    '55P03': 'ER_LOCK_WAIT_TIMEOUT',
    '57014': 'ER_LOCK_WAIT_TIMEOUT',
    '42P01': 'ER_NO_SUCH_TABLE',
  };
  if (mysqlCompatibleCodes[postgresCode]) {
    error.postgresCode = postgresCode;
    error.code = mysqlCompatibleCodes[postgresCode];
  }
  return error;
}

// Converts mysql2 positional placeholders without touching quoted SQL text.
// All values remain parameterized; this function never interpolates data.
export function toPostgresPlaceholders(sql) {
  let result = '';
  let parameter = 0;
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const previous = sql[index - 1];
    if (quote) {
      result += character;
      if (character === quote && previous !== '\\') quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      result += character;
    } else if (character === '?') {
      parameter += 1;
      result += `$${parameter}`;
    } else {
      result += character;
    }
  }
  return result;
}

function needsGeneratedId(sql) {
  return /^\s*INSERT\s+INTO\s+(profissionais|pacientes|usuarios_admin|agendamentos|disponibilidades|bloqueios_agenda|notificacoes_agendamento)\b/i.test(sql)
    && !/\bRETURNING\b/i.test(sql);
}

function postgresResult(result) {
  if (result.command === 'SELECT' || result.command === 'SHOW') return [result.rows, result.fields];
  return [{
    affectedRows: result.rowCount,
    insertId: result.rows?.[0]?.id == null ? undefined : Number(result.rows[0].id),
    changedRows: result.rowCount,
  }, result.fields];
}

async function createPostgresDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL e obrigatoria quando DB_CLIENT=postgres.');
  const { Pool, types } = await import('pg');
  // Preserve the REST contract used by the frontend: dates remain SQL strings,
  // not JavaScript Date objects serialized as ISO/UTC values.
  types.setTypeParser(20, (value) => Number(value)); // int8 (ids and COUNT)
  types.setTypeParser(1114, (value) => value); // timestamp without time zone

  const sslMode = String(process.env.DATABASE_SSL || 'require').toLowerCase();
  const ssl = ['disable', 'false', '0'].includes(sslMode)
    ? false
    : { rejectUnauthorized: !['require', 'no-verify'].includes(sslMode) };
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: Math.max(1, Number(process.env.DB_POOL_MAX || 5)),
    min: Math.max(0, Number(process.env.DB_POOL_MIN || 0)),
    connectionTimeoutMillis: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
    idleTimeoutMillis: Math.max(1000, Number(process.env.DB_IDLE_TIMEOUT_MS || 30000)),
    allowExitOnIdle: process.env.NODE_ENV === 'test',
    application_name: process.env.DB_APPLICATION_NAME || 'agenda-api',
    onConnect: async (client) => {
      await client.query("SET TIME ZONE 'America/Sao_Paulo'");
    },
  });

  pool.on('error', (error) => console.error('Conexao PostgreSQL ociosa falhou:', error?.code || error?.name || 'unknown'));

  async function run(target, sql, params = []) {
    const statement = `${toPostgresPlaceholders(sql)}${needsGeneratedId(sql) ? ' RETURNING id' : ''}`;
    try {
      return postgresResult(await target.query(statement, params));
    } catch (error) {
      throw normalizeDatabaseError(error);
    }
  }

  return {
    dialect: 'postgres',
    query: (sql, params) => run(pool, sql, params),
    async getConnection() {
      const client = await pool.connect();
      return {
        dialect: 'postgres',
        query: (sql, params) => run(client, sql, params),
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
        release: () => client.release(),
      };
    },
    end: () => pool.end(),
  };
}

async function createMysqlDatabase() {
  const { default: mysql } = await import('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: Math.max(1, Number(process.env.DB_POOL_MAX || 10)),
    queueLimit: 0,
    dateStrings: true,
  });
  // Expose the selected dialect without changing mysql2's established API.
  Object.defineProperty(pool, 'dialect', { value: 'mysql', enumerable: true });
  return pool;
}

const db = configuredDialect === 'postgres'
  ? await createPostgresDatabase()
  : await createMysqlDatabase();

export const databaseDialect = configuredDialect;
export default db;
