import { expect } from '@playwright/test';

export const agendaDay = '2030-09-18'; // Quarta-feira; relógio dos testes fica na semana anterior.
export const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const professional = { id: 7, nome: 'Helena Martins', email: 'helena@example.com', tipo: 'psicologa', email_verificado: true };
const patient = { id: 2, nome: 'Paciente Teste', email: 'paciente@example.com', tipo: 'paciente', email_verificado: true };
const initialAppointments = [
  { id: 1, nome_cliente: 'Marina Oliveira', inicio: `${agendaDay} 15:00:00`, fim: `${agendaDay} 15:50:00`, modalidade: 'online', status: 'agendado' },
  { id: 2, nome_cliente: 'Beatriz Costa', inicio: `${agendaDay} 12:00:00`, fim: `${agendaDay} 12:50:00`, modalidade: 'presencial', status: 'confirmado' },
];
const minutes = (time) => { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute; };
const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const dateWeekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const overlap = (a, b) => a.hora_inicio < b.hora_fim && a.hora_fim > b.hora_inicio;

export function expandPeriod(record) {
  const duration = Number(record.duracao_minutos);
  const step = duration + Number(record.intervalo_minutos ?? 0);
  if (!(duration > 0 && step > 0)) return [];
  const result = [];
  for (let at = minutes(record.hora_inicio); at + duration <= minutes(record.hora_fim); at += step) {
    result.push({ ...record, horario: clock(at), fim: clock(at + duration), hora_inicio: clock(at), hora_fim: clock(at + duration) });
  }
  return result;
}

export async function seedAgendaSession(page, { admin = true, withPatient = false } = {}) {
  await page.clock.setFixedTime(new Date('2030-09-10T15:00:00Z'));
  await page.addInitScript(({ admin, withPatient, professional, patient }) => {
    if (admin) {
      localStorage.setItem('psicologa_token', 'agenda-admin-token');
      localStorage.setItem('psicologa_usuario', JSON.stringify(professional));
    }
    if (withPatient) {
      localStorage.setItem('paciente_token', 'agenda-patient-token');
      localStorage.setItem('paciente_usuario', JSON.stringify(patient));
    }
  }, { admin, withPatient, professional, patient });
}

// Este mock verifica o contrato HTTP e o comportamento da interface. Regras SQL,
// rollback e concorrência são verificadas separadamente nos testes de integração.
export async function mockAgenda(page, options = {}) {
  const state = {
    recorrentes: [
      { id: 10, profissional_id: 1, tipo: 'recorrente', dia_semana: 3, hora_inicio: '08:00', hora_fim: '12:00', duracao_minutos: 50, intervalo_minutos: 10 },
      { id: 11, profissional_id: 1, tipo: 'recorrente', dia_semana: 3, hora_inicio: '14:00', hora_fim: '18:00', duracao_minutos: 50, intervalo_minutos: 10 },
      { id: 12, profissional_id: 1, tipo: 'recorrente', dia_semana: 1, hora_inicio: '08:00', hora_fim: '10:00', duracao_minutos: 50, intervalo_minutos: 10 },
    ],
    extras: [], bloqueios: [], bloqueios_recorrentes: [],
    appointments: structuredClone(initialAppointments),
    requests: [], reads: [], unhandled: [], nextFailure: null, unauthorized: false, nextId: 100,
    nextMutationGate: null,
    ...options,
  };
  const normalize = (record) => ({ ...record, profissional_id: record.profissional_id ?? 1, hora_inicio: record.hora_inicio.slice(0, 5), hora_fim: record.hora_fim.slice(0, 5) });
  const activeOn = (date) => state.bloqueios.concat(state.bloqueios_recorrentes.filter((item) => Number(item.dia_semana) === dateWeekday(date)).map((item) => ({ ...item, data: date })))
    .filter((item) => item.data === date).map((item) => ({ ...item, inicio: `${date} ${item.hora_inicio}:00`, fim: `${date} ${item.hora_fim}:00` }));
  state.slots = (date) => {
    const sources = state.recorrentes.filter((item) => Number(item.dia_semana) === dateWeekday(date)).concat(state.extras.filter((item) => item.data === date));
    const blocks = activeOn(date);
    const busy = state.appointments.filter((item) => ['agendado', 'confirmado'].includes(item.status) && item.inicio.startsWith(date))
      .map((item) => ({ hora_inicio: item.inicio.slice(11, 16), hora_fim: item.fim.slice(11, 16) }));
    return [...new Map(sources.flatMap(expandPeriod).filter((slot) => !blocks.concat(busy).some((item) => overlap(slot, item)))
      .map((slot) => [slot.horario, { horario: slot.horario, fim: slot.fim }])).values()].sort((a, b) => a.horario.localeCompare(b.horario));
  };
  const addAvailability = (body) => {
    const record = normalize({ id: state.nextId++, ...body, duracao_minutos: Number(body.duracao_minutos ?? minutes(body.hora_fim) - minutes(body.hora_inicio)), intervalo_minutos: Number(body.intervalo_minutos ?? 0) });
    const key = body.tipo === 'recorrente' ? 'recorrentes' : 'extras';
    state[key].push(record);
    return record;
  };
  const addBlock = (body) => {
    const recurring = body.tipo === 'recorrente';
    const record = normalize({ id: state.nextId++, ...body, tipo: recurring ? 'recorrente' : 'data', ...(body.dia_inteiro ? { hora_inicio: '00:00', hora_fim: '23:59' } : {}) });
    state[recurring ? 'bloqueios_recorrentes' : 'bloqueios'].push(record);
    return record;
  };
  const existing = (candidate) => state.recorrentes.concat(state.extras).flatMap(expandPeriod).some((record) => record.tipo === candidate.tipo
    && (candidate.tipo === 'recorrente' ? record.dia_semana === candidate.dia_semana : record.data === candidate.data)
    && record.hora_inicio === candidate.hora_inicio && record.hora_fim === candidate.hora_fim);
  const applySelected = (selected, action, body) => {
    const grouped = new Map();
    for (const selection of selected) grouped.set(selection.id, [...(grouped.get(selection.id) || []), selection.horario]);
    for (const [id, times] of grouped) {
      const record = state.recorrentes.find((item) => item.id === id);
      if (!record) continue;
      const slots = expandPeriod(record);
      if (action === 'remover' || action === 'duracao') {
        state.recorrentes = state.recorrentes.filter((item) => item.id !== id);
        for (const slot of slots) {
          const chosen = times.includes(slot.horario);
          if (chosen && action === 'remover') continue;
          addAvailability({ ...record, id: state.nextId++, hora_inicio: slot.horario,
            hora_fim: chosen ? clock(minutes(slot.horario) + Number(body.duracao_minutos)) : slot.fim,
            duracao_minutos: chosen ? Number(body.duracao_minutos) : record.duracao_minutos, intervalo_minutos: 0 });
        }
      } else for (const slot of slots.filter((item) => times.includes(item.horario))) {
        if (action === 'bloquear') addBlock({ tipo: 'recorrente', dia_semana: record.dia_semana, hora_inicio: slot.horario, hora_fim: slot.fim, motivo: '' });
        if (action === 'duplicar') for (const day of body.dias_destino) {
          const copy = { ...record, dia_semana: day, hora_inicio: slot.horario, hora_fim: slot.fim, intervalo_minutos: 0 };
          if (!existing(copy)) addAvailability({ ...copy, id: state.nextId++ });
        }
      }
    }
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (method === 'GET') {
      state.reads.push(path);
      if (path === '/api/agendamentos') return json(state.appointments);
      if (path === '/api/horarios') return json({ data: url.searchParams.get('data'), horarios: state.slots(url.searchParams.get('data')) });
      if (path === '/api/agenda') {
        if (state.unauthorized) return json({ erro: 'Sessão expirada.' }, 401);
        const date = url.searchParams.get('data');
        return json({ data: date, profissional_id: 1, duracao_padrao: 50, intervalo_padrao: 10,
          recorrentes: state.recorrentes, extras: state.extras.filter((item) => item.data === date),
          bloqueios: activeOn(date), bloqueios_recorrentes: state.bloqueios_recorrentes, horarios: state.slots(date) });
      }
    }
    if (path.startsWith('/api/agenda/') && ['POST', 'PATCH', 'DELETE'].includes(method)) {
      const body = request.postData() ? request.postDataJSON() : null;
      state.requests.push({ method, path, body, authorization: request.headers().authorization });
      if (state.nextMutationGate) { const gate = state.nextMutationGate; state.nextMutationGate = null; await gate; }
      if (state.nextFailure) { const failure = state.nextFailure; state.nextFailure = null; return json({ erro: failure.message }, failure.status); }
      if (method === 'POST' && path === '/api/agenda/disponibilidades/lote') {
        let created = 0, ignored = 0;
        const records = [];
        for (const period of body.periodos) for (const day of body.tipo === 'recorrente' ? body.dias_semana : [null]) {
          const candidate = normalize({ ...period, tipo: body.tipo, ...(day === null ? { data: body.data, dia_semana: dateWeekday(body.data) } : { dia_semana: day }) });
          if (existing(candidate)) { ignored++; continue; }
          records.push(addAvailability(candidate)); created++;
        }
        return json({ mensagem: created ? 'Horários adicionados com sucesso.' : 'Esse horário já existe.', criados: created, ignorados: ignored, disponibilidades: records }, 201);
      }
      if (method === 'POST' && path === '/api/agenda/disponibilidades/copiar') {
        const source = state.recorrentes.filter((item) => Number(item.dia_semana) === body.origem_dia).flatMap(expandPeriod);
        let created = 0, ignored = 0;
        for (const day of body.dias_destino) for (const slot of source) {
          const candidate = { tipo: 'recorrente', dia_semana: day, hora_inicio: slot.horario, hora_fim: slot.fim, duracao_minutos: slot.duracao_minutos, intervalo_minutos: 0 };
          if (existing(candidate)) { ignored++; continue; }
          addAvailability(candidate); created++;
        }
        return json({ mensagem: 'Horários copiados com sucesso.', criados: created, ignorados: ignored });
      }
      if (method === 'POST' && path === '/api/agenda/disponibilidades/acoes') {
        applySelected(body.selecionados, body.acao, body);
        return json({ mensagem: 'Horários atualizados com sucesso.', alterados: body.selecionados.length, consultas_preservadas: state.appointments.length });
      }
      if (method === 'POST' && path === '/api/agenda/bloqueios/lote') {
        const records = (body.tipo === 'recorrente' ? body.dias_semana : [null]).map((day) => addBlock({ ...body, ...(day === null ? {} : { dia_semana: day }) }));
        return json({ mensagem: 'Bloqueios adicionados com sucesso.', criados: records.length, bloqueios: records }, 201);
      }
      const occurrence = path.match(/^\/api\/agenda\/disponibilidades\/(\d+)\/ocorrencia$/);
      if (method === 'POST' && occurrence) {
        const slot = state.recorrentes.filter((item) => item.id === Number(occurrence[1])).flatMap(expandPeriod).find((item) => item.horario === body.horario);
        if (!slot) return json({ erro: 'Horário não encontrado.' }, 404);
        const record = addBlock({ tipo: 'data', data: body.data, hora_inicio: slot.horario, hora_fim: slot.fim, motivo: 'Ocorrência removida' });
        return json({ mensagem: 'Horário removido somente desta data.', bloqueio: record }, 201);
      }
      const individual = path.match(/^\/api\/agenda\/(disponibilidades|bloqueios)(?:\/(\d+))?$/);
      if (individual) {
        const resource = individual[1], id = Number(individual[2]);
        const keys = resource === 'bloqueios' ? ['bloqueios', 'bloqueios_recorrentes'] : ['recorrentes', 'extras'];
        const key = keys.find((key) => state[key].some((item) => item.id === id));
        if (method === 'DELETE') { if (key) state[key] = state[key].filter((item) => item.id !== id); return json({ mensagem: 'Horário excluído com sucesso.' }); }
        if (method === 'PATCH' && key) {
          const record = normalize({ ...state[key].find((item) => item.id === id), ...body });
          state[key] = state[key].map((item) => item.id === id ? record : item);
          return json({ mensagem: 'Horário atualizado com sucesso.', [resource === 'bloqueios' ? 'bloqueio' : 'disponibilidade']: record });
        }
        if (method === 'POST') {
          const record = resource === 'bloqueios' ? addBlock(body) : addAvailability(body);
          return json({ mensagem: 'Horário adicionado com sucesso.', [resource === 'bloqueios' ? 'bloqueio' : 'disponibilidade']: record }, 201);
        }
      }
    }
    state.unhandled.push(`${method} ${path}`);
    return json({ erro: 'Rota não simulada.' }, 404);
  });
  return state;
}

export async function openAgendaDay(page, date = agendaDay) {
  await page.goto('/adm/agenda');
  await page.getByRole('button', { name: 'Horários do dia', exact: true }).click();
  await page.getByLabel('Dia da agenda', { exact: true }).fill(date);
  await expect(page.getByLabel('Dia da agenda', { exact: true })).toHaveValue(date);
  await expect(page.locator('.schedule-timeline')).toBeVisible();
}

export async function openAgendaWeek(page) {
  await page.goto('/adm/agenda');
  await page.getByRole('button', { name: 'Rotina semanal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gerenciar horários', exact: true })).toBeVisible();
}

export async function showWeekday(page, weekday) {
  const mobileDay = page.getByRole('button', { name: weekdays[weekday], exact: true });
  if (await mobileDay.isVisible()) await mobileDay.click();
}

export async function assertNoOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  const overflowing = await page.locator('main button, main input, main select, main h2, dialog, [role="alertdialog"]').evaluateAll((elements) => elements.filter((element) => {
    if (!element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return false;
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > innerWidth + 1;
  }).map((element) => `${element.tagName}: ${element.textContent.slice(0, 70)}`));
  expect(overflowing).toEqual([]);
}
