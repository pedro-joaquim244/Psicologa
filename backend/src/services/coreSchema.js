import db from '../database.js';

// Base schema for a new installation. Existing tables are left untouched;
// the focused migrations add the fields introduced after the first release.
export async function ensureCoreSchema(connection = db) {
  const [adminColumns] = await connection.query("SHOW COLUMNS FROM usuarios_admin LIKE 'profissional_id'");
  if (!adminColumns.length) {
    await connection.query(`ALTER TABLE usuarios_admin
      ADD COLUMN profissional_id INT UNSIGNED NULL`);
  }
  await connection.query(`UPDATE usuarios_admin u
    JOIN profissionais p ON LOWER(u.email) = LOWER(p.email)
    SET u.profissional_id = p.id
    WHERE u.profissional_id IS NULL AND u.tipo = 'psicologa'`);
  await connection.query(`UPDATE usuarios_admin
    SET profissional_id = 1
    WHERE profissional_id IS NULL AND tipo = 'psicologa' AND EXISTS (SELECT 1 FROM profissionais WHERE id = 1)`);
  await connection.query(`CREATE TABLE IF NOT EXISTS profissionais (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NULL,
    telefone VARCHAR(30) NULL,
    google_calendar_id VARCHAR(255) NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS usuarios_admin (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    tipo ENUM('psicologa', 'admin') NOT NULL DEFAULT 'psicologa',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    email_verificado_em TIMESTAMP NULL DEFAULT NULL,
    profissional_id INT UNSIGNED NULL,
    INDEX idx_usuario_admin_profissional (profissional_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS pacientes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telefone VARCHAR(30) NOT NULL,
    senha VARCHAR(255) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    email_verificado_em TIMESTAMP NULL DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS disponibilidades (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    profissional_id INT UNSIGNED NOT NULL,
    dia_semana TINYINT UNSIGNED NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    duracao_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 50,
    intervalo_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 10,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_especifica DATE NULL DEFAULT NULL,
    INDEX idx_disponibilidade_dia (dia_semana),
    INDEX idx_disponibilidade_data (profissional_id, data_especifica, dia_semana, ativo),
    CONSTRAINT fk_disponibilidade_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS bloqueios_agenda (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    profissional_id INT UNSIGNED NOT NULL,
    inicio DATETIME NULL DEFAULT NULL,
    fim DATETIME NULL DEFAULT NULL,
    motivo VARCHAR(150) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    dia_semana TINYINT UNSIGNED NULL DEFAULT NULL,
    hora_inicio TIME NULL DEFAULT NULL,
    hora_fim TIME NULL DEFAULT NULL,
    INDEX idx_bloqueios_inicio (inicio),
    INDEX idx_bloqueio_recorrente (profissional_id, dia_semana, hora_inicio, hora_fim),
    CONSTRAINT fk_bloqueio_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await connection.query(`CREATE TABLE IF NOT EXISTS agendamentos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    paciente_id INT UNSIGNED NULL,
    profissional_id INT UNSIGNED NOT NULL,
    nome_cliente VARCHAR(150) NOT NULL,
    email_cliente VARCHAR(255) NULL,
    telefone_cliente VARCHAR(30) NOT NULL,
    modalidade ENUM('online', 'presencial') NOT NULL,
    inicio DATETIME NOT NULL,
    fim DATETIME NOT NULL,
    status ENUM('agendado', 'confirmado', 'cancelado', 'concluido') NOT NULL DEFAULT 'agendado',
    google_event_id VARCHAR(255) NULL,
    origem VARCHAR(100) NULL DEFAULT 'site',
    slot_ativo TINYINT GENERATED ALWAYS AS (IF(status IN ('agendado', 'confirmado'), 1, NULL)) STORED,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    token_cancelamento VARCHAR(255) NULL,
    UNIQUE KEY uq_horario_agendamento (profissional_id, inicio, slot_ativo),
    UNIQUE KEY uq_token_cancelamento (token_cancelamento),
    INDEX idx_agendamentos_inicio (inicio),
    INDEX idx_agendamentos_status (status),
    INDEX idx_agendamento_paciente (paciente_id),
    CONSTRAINT fk_agendamento_paciente FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
    CONSTRAINT fk_agendamento_profissional FOREIGN KEY (profissional_id) REFERENCES profissionais(id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}
