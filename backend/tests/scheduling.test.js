import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicNow, generateSlots, validDate, validTime } from '../src/utils/scheduling.js';
test('validação de calendário real e relógio de Brasília', () => {
  assert.equal(validDate('2032-02-29'), true);
  for (const value of ['2031-02-29', '2030-13-01', '2030-04-31', {}, ['2030-01-01']]) assert.equal(validDate(value), false);
  assert.equal(validTime('23:59'), true);
  assert.equal(validTime('24:00'), false);
  assert.equal(clinicNow(new Date('2030-09-10T02:00:00Z')), '2030-09-09 23:00:00');
});
test('slots respeitam duração e intervalo, deduplicam e ignoram configuração inválida', () => {
  const window = { hora_inicio: '09:00:00', hora_fim: '12:00:00', duracao_minutos: 50, intervalo_minutos: 10 };
  assert.deepEqual(generateSlots([window, window, { ...window, duracao_minutos: 0 }, { ...window, intervalo_minutos: -1 }]), [{ horario: '09:00', fim: '09:50' }, { horario: '10:00', fim: '10:50' }, { horario: '11:00', fim: '11:50' }]);
});
