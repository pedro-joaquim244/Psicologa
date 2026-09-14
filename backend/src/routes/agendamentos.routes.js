import express from "express";
import db from "../database.js";

import {
  autenticarToken,
  somentePsicologa,
  somentePaciente,
} from "../middlewares/autenticacao.js";

import { clinicNow, generateSlots, validDate, validId, validTime } from '../utils/scheduling.js';
import { loadDayAvailability } from '../services/agenda.js';
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.param('id', (req, res, next, id) => validId(id) ? next() : res.status(400).json({ erro: 'Agendamento inválido.' }));

async function statusConflict(res, id) {
  const [[current]] = await db.query('SELECT id FROM agendamentos WHERE id = ? LIMIT 1', [id]);
  return res.status(current ? 409 : 404).json({ erro: current ? 'O status deste agendamento mudou. Atualize a agenda antes de tentar novamente.' : 'Agendamento não encontrado.' });
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

router.post("/", autenticarToken, somentePaciente, async (req, res) => {
  let conexao;

  try {
    conexao = await db.getConnection();

    const {
      data,
      horario,
      modalidade,
      profissional_id = 1,
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


    if (!validDate(data) || !validTime(horario) || !validId(profissional_id)) {
      return res.status(400).json({ erro: 'Confira a data, o horário e o profissional.' });
    }
    if (data + ' ' + horario + ':00' <= clinicNow()) {
      return res.status(400).json({ erro: 'Esse horário já passou. Escolha outro horário.' });
    }
    await conexao.beginTransaction();
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

    const [bloqueios] = await conexao.query(
      `
      SELECT id
      FROM bloqueios_agenda
      WHERE profissional_id = ?
        AND inicio < ?
        AND fim > ?
      LIMIT 1
      `,
      [
        profissional_id,
        fimCompleto,
        inicioCompleto,
      ]
    );


    if (bloqueios.length > 0) {
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


    console.error(
      "Erro ao realizar agendamento:",
      error.code || error.name
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
      const [agendamentos] = await db.query(
        `
        SELECT
          id,
          profissional_id,
          nome_cliente,
          email_cliente,
          telefone_cliente,
          modalidade,
          inicio,
          fim,
          status,
          google_event_id,
          origem,
          criado_em,
          atualizado_em
        FROM agendamentos
        ORDER BY inicio ASC
        `
      );


      return res.status(200).json(
        agendamentos
      );

    } catch (error) {
      console.error(
        "Erro ao listar agendamentos:",
        error.code || error.name
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


      const [agendamentos] = await db.query(
        `
        SELECT
          id,
          profissional_id,
          nome_cliente,
          email_cliente,
          telefone_cliente,
          modalidade,
          inicio,
          fim,
          status,
          google_event_id,
          origem,
          criado_em,
          atualizado_em
        FROM agendamentos
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );


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
        error.code || error.name
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

  async (req, res) => {
    try {
      const { id } = req.params;


      const [resultado] = await db.query(
        `
        UPDATE agendamentos
        SET status = 'confirmado'
        WHERE id = ?
          AND status = 'agendado'
        `,
        [id]
      );


      if (resultado.affectedRows === 0) return statusConflict(res, id);


      return res.status(200).json({
        mensagem:
          "Agendamento confirmado com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao confirmar agendamento:",
        error.code || error.name
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

  async (req, res) => {
    try {
      const { id } = req.params;


      const [resultado] = await db.query(
        `
        UPDATE agendamentos
        SET status = 'concluido'
        WHERE id = ?
          AND status IN ('agendado', 'confirmado')
        `,
        [id]
      );


      if (resultado.affectedRows === 0) return statusConflict(res, id);


      return res.status(200).json({
        mensagem:
          "Agendamento concluído com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao concluir agendamento:",
        error.code || error.name
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

  async (req, res) => {
    try {
      const { id } = req.params;


      const [resultado] = await db.query(
        `
        UPDATE agendamentos
        SET status = 'cancelado'
        WHERE id = ?
          AND status != 'cancelado'
        `,
        [id]
      );


      if (resultado.affectedRows === 0) return statusConflict(res, id);


      return res.status(200).json({
        mensagem:
          "Agendamento cancelado com sucesso.",
      });

    } catch (error) {
      console.error(
        "Erro ao cancelar agendamento:",
        error.code || error.name
      );


      return res.status(500).json({
        erro: "Erro ao cancelar agendamento.",
      });
    }
  }
);


export default router;
