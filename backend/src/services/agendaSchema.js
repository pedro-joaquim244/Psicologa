import db from '../database.js';

// NULL mantém os períodos semanais existentes; uma data representa uma exceção disponível.
// Pode receber uma conexão de teste com tabelas TEMPORARY, sem tocar na base persistente.
export async function ensureAgendaSchema(connection = db) {
  const [columns] = await connection.query("SHOW COLUMNS FROM disponibilidades LIKE 'data_especifica'");
  if (!columns.length) await connection.query('ALTER TABLE disponibilidades ADD COLUMN data_especifica DATE NULL DEFAULT NULL');
  const [indexes] = await connection.query("SHOW INDEX FROM disponibilidades WHERE Key_name = 'idx_disponibilidade_data'");
  if (!indexes.length) await connection.query('ALTER TABLE disponibilidades ADD INDEX idx_disponibilidade_data (profissional_id, data_especifica, dia_semana, ativo)');
}
