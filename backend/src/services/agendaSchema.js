import db from '../database.js';

// NULL mantém os períodos semanais existentes; uma data representa uma exceção disponível.
// Pode receber uma conexão de teste com tabelas TEMPORARY, sem tocar na base persistente.
export async function ensureAgendaSchema(connection = db) {
  const [columns] = await connection.query("SHOW COLUMNS FROM disponibilidades LIKE 'data_especifica'");
  if (!columns.length) await connection.query('ALTER TABLE disponibilidades ADD COLUMN data_especifica DATE NULL DEFAULT NULL');
  const [indexes] = await connection.query("SHOW INDEX FROM disponibilidades WHERE Key_name = 'idx_disponibilidade_data'");
  if (!indexes.length) await connection.query('ALTER TABLE disponibilidades ADD INDEX idx_disponibilidade_data (profissional_id, data_especifica, dia_semana, ativo)');
  const [blockColumns] = await connection.query('SHOW COLUMNS FROM bloqueios_agenda');
  const columnNames = new Set(blockColumns.map((column) => column.Field));
  // NULL distingue regras semanais de bloqueios datados sem recriar a tabela.
  for (const field of ['inicio', 'fim']) {
    if (blockColumns.find((column) => column.Field === field)?.Null === 'NO') {
      await connection.query(`ALTER TABLE bloqueios_agenda MODIFY COLUMN ${field} DATETIME NULL DEFAULT NULL`);
    }
  }
  if (!columnNames.has('dia_semana')) await connection.query('ALTER TABLE bloqueios_agenda ADD COLUMN dia_semana TINYINT UNSIGNED NULL DEFAULT NULL');
  if (!columnNames.has('hora_inicio')) await connection.query('ALTER TABLE bloqueios_agenda ADD COLUMN hora_inicio TIME NULL DEFAULT NULL');
  if (!columnNames.has('hora_fim')) await connection.query('ALTER TABLE bloqueios_agenda ADD COLUMN hora_fim TIME NULL DEFAULT NULL');
  const [blockIndexes] = await connection.query("SHOW INDEX FROM bloqueios_agenda WHERE Key_name = 'idx_bloqueio_recorrente'");
  if (!blockIndexes.length) await connection.query('ALTER TABLE bloqueios_agenda ADD INDEX idx_bloqueio_recorrente (profissional_id, dia_semana, hora_inicio, hora_fim)');
}
