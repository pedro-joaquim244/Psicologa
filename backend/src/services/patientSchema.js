import db from '../database.js';

// Additive migration for installations created before patient accounts and
// e-mail verification were introduced.
export async function ensurePatientSchema(connection = db) {
  const [columns] = await connection.query("SHOW COLUMNS FROM agendamentos LIKE 'paciente_id'");
  if (!columns.length) {
    await connection.query(`ALTER TABLE agendamentos
      ADD COLUMN paciente_id INT UNSIGNED NULL,
      ADD CONSTRAINT fk_agendamento_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)`);
  }

  for (const table of ['pacientes', 'usuarios_admin']) {
    const [emailColumns] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'email_verificado_em'`);
    if (!emailColumns.length) await connection.query(`ALTER TABLE ${table} ADD COLUMN email_verificado_em TIMESTAMP NULL DEFAULT NULL`);
  }

  await connection.query(`CREATE TABLE IF NOT EXISTS verificacoes_email (
    perfil VARCHAR(20) NOT NULL,
    usuario_id INT UNSIGNED NOT NULL,
    desafio CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    codigo_hash CHAR(64) NOT NULL,
    expira_em BIGINT UNSIGNED NOT NULL,
    reenviar_em BIGINT UNSIGNED NOT NULL,
    janela_ate BIGINT UNSIGNED NOT NULL,
    envios INT UNSIGNED NOT NULL DEFAULT 0,
    tentativas INT UNSIGNED NOT NULL DEFAULT 0,
    consumido TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (perfil, usuario_id)
  ) ENGINE=InnoDB`);
}
