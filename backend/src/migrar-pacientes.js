import 'dotenv/config';
import db from './database.js';

// Additive and repeatable: existing appointments remain intact.
try {
  await db.query(`CREATE TABLE IF NOT EXISTS pacientes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(30) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const [columns] = await db.query("SHOW COLUMNS FROM agendamentos LIKE 'paciente_id'");
  if (!columns.length) {
    await db.query(`ALTER TABLE agendamentos
      ADD COLUMN paciente_id INT UNSIGNED NULL,
      ADD CONSTRAINT fk_agendamento_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id)`);
  }
  console.log('Estrutura de contas de pacientes pronta.');
  for (const table of ['pacientes', 'usuarios_admin']) {
    const [emailColumns] = await db.query(`SHOW COLUMNS FROM ${table} LIKE 'email_verificado_em'`);
    if (!emailColumns.length) await db.query(`ALTER TABLE ${table} ADD COLUMN email_verificado_em TIMESTAMP NULL DEFAULT NULL`);
  }
  await db.query(`CREATE TABLE IF NOT EXISTS verificacoes_email (
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
  console.log('Estrutura de verificação de e-mail pronta.');
} finally {
  await db.end();
}
