-- Migração aditiva e repetível. Execute na mesma base configurada pelo backend.
-- Os registros atuais permanecem recorrentes, pois data_especifica recebe NULL.
SET @agenda_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'disponibilidades'
    AND COLUMN_NAME = 'data_especifica'
);
SET @agenda_migration_sql = IF(@agenda_column_exists = 0,
  'ALTER TABLE disponibilidades ADD COLUMN data_especifica DATE NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

-- Regras semanais de bloqueio coexistem com bloqueios de data/hora. Os campos
-- de data precisam aceitar NULL para que uma regra recorrente nao seja perdida.
SET @bloqueio_inicio_nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND COLUMN_NAME = 'inicio'
);
SET @agenda_migration_sql = IF(@bloqueio_inicio_nullable = 'NO',
  'ALTER TABLE bloqueios_agenda MODIFY COLUMN inicio DATETIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @bloqueio_fim_nullable = (
  SELECT IS_NULLABLE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND COLUMN_NAME = 'fim'
);
SET @agenda_migration_sql = IF(@bloqueio_fim_nullable = 'NO',
  'ALTER TABLE bloqueios_agenda MODIFY COLUMN fim DATETIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @bloqueio_dia_semana_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND COLUMN_NAME = 'dia_semana'
);
SET @agenda_migration_sql = IF(@bloqueio_dia_semana_exists = 0,
  'ALTER TABLE bloqueios_agenda ADD COLUMN dia_semana TINYINT UNSIGNED NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @bloqueio_hora_inicio_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND COLUMN_NAME = 'hora_inicio'
);
SET @agenda_migration_sql = IF(@bloqueio_hora_inicio_exists = 0,
  'ALTER TABLE bloqueios_agenda ADD COLUMN hora_inicio TIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @bloqueio_hora_fim_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND COLUMN_NAME = 'hora_fim'
);
SET @agenda_migration_sql = IF(@bloqueio_hora_fim_exists = 0,
  'ALTER TABLE bloqueios_agenda ADD COLUMN hora_fim TIME NULL DEFAULT NULL',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @bloqueio_recorrente_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bloqueios_agenda'
    AND INDEX_NAME = 'idx_bloqueio_recorrente'
);
SET @agenda_migration_sql = IF(@bloqueio_recorrente_index_exists = 0,
  'ALTER TABLE bloqueios_agenda ADD INDEX idx_bloqueio_recorrente (profissional_id, dia_semana, hora_inicio, hora_fim)',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;

SET @agenda_index_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'disponibilidades'
    AND INDEX_NAME = 'idx_disponibilidade_data'
);
SET @agenda_migration_sql = IF(@agenda_index_exists = 0,
  'ALTER TABLE disponibilidades ADD INDEX idx_disponibilidade_data (profissional_id, data_especifica, dia_semana, ativo)',
  'SELECT 1');
PREPARE agenda_migration FROM @agenda_migration_sql;
EXECUTE agenda_migration;
DEALLOCATE PREPARE agenda_migration;
