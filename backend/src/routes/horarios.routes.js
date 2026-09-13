import express from "express";
import db from "../database.js";

import { clinicNow, generateSlots, validDate, validId } from '../utils/scheduling.js';
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// =====================================================
// LISTAR HORÁRIOS DISPONÍVEIS
//
// GET /api/horarios?data=2026-09-18
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, profissional_id = 1 } = req.query;

    if (!validDate(data) || !validId(profissional_id)) {
      return res.status(400).json({ erro: 'Informe uma data e um profissional válidos.' });
    }
    const now = clinicNow();
    if (data < now.slice(0, 10)) return res.json({ data, horarios: [] });
    const diaSemana = new Date(data + 'T12:00:00Z').getUTCDay();

    // Busca os horários de trabalho da psicóloga
    const [disponibilidades] = await db.query(
      `
      SELECT
        hora_inicio,
        hora_fim,
        duracao_minutos,
        intervalo_minutos
      FROM disponibilidades
      WHERE profissional_id = ?
        AND EXISTS (SELECT 1 FROM profissionais WHERE id = profissional_id AND ativo = 1)
        AND dia_semana = ?
        AND ativo = 1
      ORDER BY hora_inicio
      `,
      [profissional_id, diaSemana]
    );

    if (disponibilidades.length === 0) {
      return res.json({
        data,
        horarios: [],
      });
    }

    // Busca consultas já marcadas
    const [agendamentos] = await db.query(
      `
      SELECT
        inicio,
        fim
      FROM agendamentos
      WHERE profissional_id = ?
        AND inicio < DATE_ADD(?, INTERVAL 1 DAY)
        AND fim > CONCAT(?, ' 00:00:00')
        AND status IN ('agendado', 'confirmado')
      `,
      [profissional_id, data, data]
    );

    // Busca horários bloqueados pela psicóloga
    const [bloqueios] = await db.query(
      `
      SELECT
        inicio,
        fim
      FROM bloqueios_agenda
      WHERE profissional_id = ?
        AND inicio < DATE_ADD(?, INTERVAL 1 DAY)
        AND fim > CONCAT(?, ' 00:00:00')
      `,
      [profissional_id, data, data]
    );

    const horarios = generateSlots(disponibilidades).filter((slot) => {
      const inicio = data + ' ' + slot.horario + ':00';
      const fim = data + ' ' + slot.fim + ':00';
      return inicio > now && ![...agendamentos, ...bloqueios].some((item) => inicio < item.fim && fim > item.inicio);
    });

    return res.json({
      data,
      horarios,
    });
  } catch (error) {
    console.error("Erro ao buscar horários:", error.code || error.name);

    return res.status(500).json({
      erro: "Erro ao buscar horários disponíveis.",
    });
  }
});

export default router;