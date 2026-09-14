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
