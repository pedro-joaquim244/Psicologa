import express from "express";
import db from "../database.js";

import {
  autenticarToken,
  somentePsicologa,
  somentePaciente,
} from "../middlewares/autenticacao.js";
import { bookingLimiter, writeLimiter } from '../middlewares/limitAuth.js';

import { clinicNow, generateSlots, validDate, validId, validTime } from '../utils/scheduling.js';
import { loadDayAvailability, loadDayBlocks, overlaps } from '../services/agenda.js';
import { appointmentNotifications, dispatchAppointmentNotification } from '../services/appointmentNotifications.js';
import { resolvePublicProfessionalId } from '../services/publicProfessional.js';
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ erro: 'Agendamento inválido.' }));

async function statusConflict(res, id, profissionalId = null) {
  // A professional must not learn that another professional has an appointment
  // at a guessed ID. Administrators retain the more specific conflict response.
  const query = profissionalId == null
    ? 'SELECT id FROM agendamentos WHERE id = ? LIMIT 1'
    : 'SELECT id FROM agendamentos WHERE id = ? AND profissional_id = ? LIMIT 1';
  const params = profissionalId == null ? [id] : [id, profissionalId];
  const [[current]] = await db.query(query, params);
  return res.status(current ? 409 : 404).json({ erro: current ? 'O status deste agendamento mudou. Atualize a agenda antes de tentar novamente.' : 'Agendamento não encontrado.' });
}

async function enqueueNotification(appointmentId, type) {
  try {
    const [rows] = await db.query(
      `SELECT a.id, a.nome_cliente, a.email_cliente, a.modalidade, a.inicio, a.fim,
              COALESCE(p.nome, 'Mauricéia Soares') AS profissional_nome
       FROM agendamentos a LEFT JOIN profissionais p ON p.id = a.profissional_id
       WHERE a.id = ? LIMIT 1`,
      [appointmentId],
    );
    if (!rows[0]) return;
    const notification = await appointmentNotifications.queue(rows[0], type);
    dispatchAppointmentNotification(notification);
  } catch (error) {
    // A atualização da consulta já foi consolidada. Não expor destinatários ou dados pessoais em logs.
    if (error?.code !== 'ER_NO_SUCH_TABLE') console.error('Não foi possível registrar uma notificação de agendamento.');
  }
}


// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

// =====================================================
// CRIAR AGENDAMENTO
//
// POST /api/agendamentos
//
// Reserva vinculada à conta autenticada do paciente.
// =====================================================

router.post("/", autenticarToken, somentePaciente, bookingLimiter, async (req, res) => {
  let conexao;

  try {
    conexao = await db.getConnection();

    const {
      data,
      horario,
      modalidade,
      profissional_id: requestedProfessionalId,
    } = req.body || {};
    const { nome, email, telefone } = req.paciente;


    // ===================================================
    // VALIDAÇÕES
    // ===================================================

    if (
      !nome ||
      !telefone ||
      !data ||
      !horario ||
      !modalidade
    ) {
      return res.status(400).json({
        erro: "Preencha todos os campos obrigatórios.",
      });
    }


    if (!["online", "presencial"].includes(modalidade)) {
      return res.status(400).json({
        erro: "Modalidade inválida.",
      });
    }


    if (!validDate(data) || !validTime(horario) || (requestedProfessionalId != null && !validId(requestedProfessionalId))) {
      return res.status(400).json({ erro: 'Confira a data, o horário e o profissional.' });
    }
    if (data + ' ' + horario + ':00' <= clinicNow()) {
      return res.status(400).json({ erro: 'Esse horário já passou. Escolha outro horário.' });
    }
    await conexao.beginTransaction();
    const profissional_id = await resolvePublicProfessionalId(conexao, requestedProfessionalId);
    // Lock persistente no banco: cobre instâncias diferentes da API e intervalos
    // sobrepostos, mesmo quando seus horários de início são diferentes.
    const [[profissional]] = await conexao.query('SELECT id FROM profissionais WHERE id = ? AND ativo = 1 FOR UPDATE', [profissional_id]);
    if (!profissional) {
      await conexao.rollback();
      return res.status(400).json({ erro: 'Profissional indisponível.' });
    }

    // ===================================================
    // BUSCAR DISPONIBILIDADE DA PSICÓLOGA
    // ===================================================

    const disponibilidades = await loadDayAvailability(conexao, data, profissional_id);


    const slot = generateSlots(disponibilidades).find((item) => item.horario === horario);
    if (!slot) {
      await conexao.rollback();
      return res.status(400).json({ erro: 'Este horário não está disponível.' });
    }
    const horarioFim = slot.fim;
    const inicioCompleto = data + ' ' + horario + ':00';
    const fimCompleto = data + ' ' + horarioFim + ':00';

    // ===================================================
    // VERIFICAR BLOQUEIOS
    // ===================================================

    const bloqueios = await loadDayBlocks(conexao, data, profissional_id);


    if (bloqueios.some((block) => overlaps(inicioCompleto, fimCompleto, block.inicio, block.fim))) {
      await conexao.rollback();

      return res.status(409).json({
        erro: "Este horário está bloqueado.",
      });
    }


    // ===================================================
    // VERIFICAR SE JÁ EXISTE AGENDAMENTO
    // ===================================================

    const [ocupados] = await conexao.query(
      `
      SELECT id
      FROM agendamentos
      WHERE profissional_id = ?
        AND inicio < ?
        AND fim > ?
        AND status IN ('agendado', 'confirmado')
      LIMIT 1
      `,
      [
        profissional_id,
        fimCompleto,
        inicioCompleto,
      ]
    );


    if (ocupados.length > 0) {
      await conexao.rollback();

      return res.status(409).json({
        erro: "Este horário já foi reservado.",
      });
    }


    // ===================================================
    // CRIAR AGENDAMENTO
    // ===================================================

    const [resultado] = await conexao.query(
      `
      INSERT INTO agendamentos
      (
        paciente_id,
        profissional_id,
        nome_cliente,
        email_cliente,
        telefone_cliente,
        modalidade,
        inicio,
        fim,
        status,
        origem
      )
      VALUES
      (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        'agendado',
        'site'
      )
      `,
      [
        req.paciente.id,
        profissional_id,
        nome,
        email || null,
        telefone,
        modalidade,
        inicioCompleto,
        fimCompleto,
      ]
    );


    await conexao.commit();

    await enqueueNotification(resultado.insertId, 'solicitacao');


    return res.status(201).json({
      mensagem: "Agendamento realizado com sucesso!",

      agendamento: {
        id: resultado.insertId,
        nome,
        email: email || null,
        telefone,
        data,
        horario,
        horarioFim,
        modalidade,
        status: "agendado",
      },
    });

  } catch (error) {
    if (conexao) {
      try {
        await conexao.rollback();
      } catch {
        // Ignora erro de rollback
      }
    }


    if (["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) {
      return res.status(409).json({
        erro: "Este horário já foi reservado.",
      });
    }

    if (error.status) {
      return res.status(error.status).json({ erro: error.message });
    }


    console.error(
      "Erro ao realizar agendamento:",
      error
    );


    return res.status(500).json({
      erro: "Erro ao realizar agendamento.",
    });

  } finally {
    if (conexao) {
      try { await conexao.rollback(); } catch { /* Conexão encerrada. */ }
      conexao.release();
    }
  }
});


// =====================================================
// LISTAR TODOS OS AGENDAMENTOS
//
// GET /api/agendamentos
//
// SOMENTE PSICÓLOGA / ADMIN
// =====================================================

router.get(
  "/",
  autenticarToken,
  somentePsicologa,

  async (req, res) => {
    try {
      const profId = req.profissional_id || (req.query.profissional_id ? Number(req.query.profissional_id) : null);
      const query = profId
        ? `SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE profissional_id = ? ORDER BY inicio ASC`
        : `SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos ORDER BY inicio ASC`;
      const params = profId ? [profId] : [];
      const [agendamentos] = await db.query(query, params);


      return res.status(200).json(
        agendamentos
      );

    } catch (error) {
      console.error(
        "Erro ao listar agendamentos:",
        error
      );


      return res.status(500).json({
        erro: "Erro ao listar agendamentos.",
      });
    }
  }
);


// =====================================================
// BUSCAR UM AGENDAMENTO
//
// GET /api/agendamentos/1
//
// SOMENTE PSICÓLOGA / ADMIN
// =====================================================

router.get(
  "/:id",
  autenticarToken,
  somentePsicologa,

  async (req, res) => {
    try {
      const { id } = req.params;


      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? `SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE id = ? LIMIT 1`
        : `SELECT id, profissional_id, nome_cliente, email_cliente, telefone_cliente, modalidade, inicio, fim, status, google_event_id, origem, criado_em, atualizado_em FROM agendamentos WHERE id = ? AND profissional_id = ? LIMIT 1`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [agendamentos] = await db.query(query, params);


      if (agendamentos.length === 0) {
        return res.status(404).json({
          erro: "Agendamento não encontrado.",
        });
      }


      return res.status(200).json(
        agendamentos[0]
      );

    } catch (error) {
      console.error(
        "Erro ao buscar agendamento:",
        error
      );


      return res.status(500).json({
        erro: "Erro ao buscar agendamento.",
      });
    }
  }
);


// =====================================================
// CONFIRMAR AGENDAMENTO
//
// PATCH /api/agendamentos/1/confirmar
//
// SOMENTE PSICÓLOGA / ADMIN
// =====================================================

router.patch(
  "/:id/confirmar",
  autenticarToken,
  somentePsicologa,
  writeLimiter,

  async (req, res) => {
    try {
      const { id } = req.params;


      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? `UPDATE agendamentos SET status = 'confirmado' WHERE id = ? AND status = 'agendado'`
        : `UPDATE agendamentos SET status = 'confirmado' WHERE id = ? AND status = 'agendado' AND profissional_id = ?`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);


      if (resultado.affectedRows === 0) return statusConflict(res, id, isSuperAdmin ? null : req.profissional_id);

      await enqueueNotification(id, 'confirmacao');


      return res.status(200).json({
        mensagem:
          "Agendamento confirmado com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao confirmar agendamento:",
        error
      );


      return res.status(500).json({
        erro: "Erro ao confirmar agendamento.",
      });
    }
  }
);


// =====================================================
// CONCLUIR AGENDAMENTO
//
// PATCH /api/agendamentos/1/concluir
//
// SOMENTE PSICÓLOGA / ADMIN
// =====================================================

router.patch(
  "/:id/concluir",
  autenticarToken,
  somentePsicologa,
  writeLimiter,

  async (req, res) => {
    try {
      const { id } = req.params;


      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? `UPDATE agendamentos SET status = 'concluido' WHERE id = ? AND status IN ('agendado', 'confirmado')`
        : `UPDATE agendamentos SET status = 'concluido' WHERE id = ? AND status IN ('agendado', 'confirmado') AND profissional_id = ?`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);


      if (resultado.affectedRows === 0) return statusConflict(res, id, isSuperAdmin ? null : req.profissional_id);

      await enqueueNotification(id, 'conclusao');


      return res.status(200).json({
        mensagem:
          "Agendamento concluído com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao concluir agendamento:",
        error
      );


      return res.status(500).json({
        erro: "Erro ao concluir agendamento.",
      });
    }
  }
);


// =====================================================
// CANCELAR AGENDAMENTO
//
// PATCH /api/agendamentos/1/cancelar
//
// SOMENTE PSICÓLOGA / ADMIN
// =====================================================

router.patch(
  "/:id/cancelar",
  autenticarToken,
  somentePsicologa,
  writeLimiter,

  async (req, res) => {
    try {
      const { id } = req.params;


      const isSuperAdmin = req.usuario.tipo === "admin";
      const query = isSuperAdmin
        ? `UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status != 'cancelado'`
        : `UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status != 'cancelado' AND profissional_id = ?`;
      const params = isSuperAdmin ? [id] : [id, req.profissional_id];
      const [resultado] = await db.query(query, params);


      if (resultado.affectedRows === 0) return statusConflict(res, id, isSuperAdmin ? null : req.profissional_id);

      await enqueueNotification(id, 'cancelamento');


      return res.status(200).json({
        mensagem:
          "Agendamento cancelado com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao cancelar agendamento:",
        error
      );


      return res.status(500).json({
        erro: "Erro ao cancelar agendamento.",
      });
    }
  }
);

// Recusa mantém o modelo de status atual: a solicitação deixa de ocupar o
// horário como cancelada, mas recebe um evento de e-mail distinto e auditável.
router.patch('/:id/recusar', autenticarToken, somentePsicologa, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin = req.usuario.tipo === 'admin';
    const [result] = await db.query(
      isSuperAdmin
        ? "UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status = 'agendado'"
        : "UPDATE agendamentos SET status = 'cancelado' WHERE id = ? AND status = 'agendado' AND profissional_id = ?",
      isSuperAdmin ? [id] : [id, req.profissional_id],
    );
    if (!result.affectedRows) return statusConflict(res, id, isSuperAdmin ? null : req.profissional_id);
    await enqueueNotification(id, 'recusa');
    return res.status(200).json({ mensagem: 'Solicitação recusada com sucesso.' });
  } catch (error) {
    console.error('Erro ao recusar agendamento:', error?.code || error?.name || 'unknown error');
    return res.status(500).json({ erro: 'Erro ao recusar agendamento.' });
  }
});

router.patch('/:id/reagendar', autenticarToken, somentePsicologa, writeLimiter, async (req, res) => {
  let connection;
  try {
    const { id } = req.params;
    const { data, horario, modalidade } = req.body || {};
    if (!validDate(data) || !validTime(horario) || (modalidade !== undefined && !['online', 'presencial'].includes(modalidade))) {
      return res.status(400).json({ erro: 'Confira a nova data, horário e modalidade.' });
    }
    if (`${data} ${horario}:00` <= clinicNow()) return res.status(400).json({ erro: 'Escolha um horário futuro para reagendar.' });
    connection = await db.getConnection();
    await connection.beginTransaction();
    const isSuperAdmin = req.usuario.tipo === 'admin';
    const [rows] = await connection.query(
      `SELECT id, profissional_id, modalidade, status FROM agendamentos
       WHERE id = ? ${isSuperAdmin ? '' : 'AND profissional_id = ?'} FOR UPDATE`,
      isSuperAdmin ? [id] : [id, req.profissional_id],
    );
    const appointment = rows[0];
    if (!appointment || !['agendado', 'confirmado'].includes(appointment.status)) {
      await connection.rollback();
      return statusConflict(res, id, isSuperAdmin ? null : req.profissional_id);
    }
    const availability = await loadDayAvailability(connection, data, appointment.profissional_id);
    const slot = generateSlots(availability).find((item) => item.horario === horario);
    if (!slot) { await connection.rollback(); return res.status(400).json({ erro: 'Este horário não está disponível.' }); }
    const start = `${data} ${horario}:00`, end = `${data} ${slot.fim}:00`;
    const blocks = await loadDayBlocks(connection, data, appointment.profissional_id);
    if (blocks.some((block) => overlaps(start, end, block.inicio, block.fim))) { await connection.rollback(); return res.status(409).json({ erro: 'Este horário está bloqueado.' }); }
    const [conflicts] = await connection.query(
      `SELECT id FROM agendamentos WHERE profissional_id = ? AND id != ?
       AND inicio < ? AND fim > ? AND status IN ('agendado', 'confirmado') LIMIT 1`,
      [appointment.profissional_id, id, end, start],
    );
    if (conflicts.length) { await connection.rollback(); return res.status(409).json({ erro: 'Este horário já foi reservado.' }); }
    await connection.query('UPDATE agendamentos SET inicio = ?, fim = ?, modalidade = ? WHERE id = ?', [start, end, modalidade || appointment.modalidade, id]);
    await connection.commit();
    await enqueueNotification(id, 'reagendamento');
    return res.status(200).json({ mensagem: 'Consulta reagendada com sucesso.', agendamento: { id: Number(id), inicio: start, fim: end, modalidade: modalidade || appointment.modalidade, status: appointment.status } });
  } catch (error) {
    if (connection) { try { await connection.rollback(); } catch { /* transação já finalizada */ } }
    if (["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) {
      return res.status(409).json({ erro: 'Este horário já foi reservado.' });
    }
    console.error('Erro ao reagendar consulta:', error?.code || error?.name || 'unknown error');
    return res.status(500).json({ erro: 'Erro ao reagendar consulta.' });
  } finally {
    connection?.release();
  }
});


export default router;
