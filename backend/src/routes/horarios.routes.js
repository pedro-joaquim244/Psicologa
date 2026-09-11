import express from "express";
import db from "../database.js";

const router = express.Router();

function horaParaMinutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutosParaHora(minutos) {
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;

  return `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

// =====================================================
// LISTAR HORÁRIOS DISPONÍVEIS
//
// GET /api/horarios?data=2026-09-18
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, profissional_id = 1 } = req.query;

    if (!data) {
      return res.status(400).json({
        erro: "Informe uma data.",
      });
    }

    const dataJS = new Date(`${data}T12:00:00`);

    if (Number.isNaN(dataJS.getTime())) {
      return res.status(400).json({
        erro: "Data inválida.",
      });
    }

    const diaSemana = dataJS.getDay();

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
        AND DATE(inicio) = ?
        AND status IN ('agendado', 'confirmado')
      `,
      [profissional_id, data]
    );

    // Busca horários bloqueados pela psicóloga
    const [bloqueios] = await db.query(
      `
      SELECT
        inicio,
        fim
      FROM bloqueios_agenda
      WHERE profissional_id = ?
        AND inicio < CONCAT(?, ' 23:59:59')
        AND fim > CONCAT(?, ' 00:00:00')
      `,
      [profissional_id, data, data]
    );

    const horarios = [];

    for (const disponibilidade of disponibilidades) {
      const inicio = horaParaMinutos(disponibilidade.hora_inicio);
      const fim = horaParaMinutos(disponibilidade.hora_fim);

      const duracao = Number(disponibilidade.duracao_minutos);
      const intervalo = Number(disponibilidade.intervalo_minutos);

      for (
        let atual = inicio;
        atual + duracao <= fim;
        atual += duracao + intervalo
      ) {
        const horaInicio = minutosParaHora(atual);
        const horaFim = minutosParaHora(atual + duracao);

        const inicioCompleto = `${data} ${horaInicio}:00`;
        const fimCompleto = `${data} ${horaFim}:00`;

        const ocupado = agendamentos.some((agendamento) => {
          return (
            inicioCompleto < agendamento.fim &&
            fimCompleto > agendamento.inicio
          );
        });

        const bloqueado = bloqueios.some((bloqueio) => {
          return inicioCompleto < bloqueio.fim && fimCompleto > bloqueio.inicio;
        });

        if (!ocupado && !bloqueado) {
          horarios.push({
            horario: horaInicio,
            fim: horaFim,
          });
        }
      }
    }

    return res.json({
      data,
      horarios,
    });
  } catch (error) {
    console.error("Erro ao buscar horários:", error);

    return res.status(500).json({
      erro: "Erro ao buscar horários disponíveis.",
      detalhe: error.message,
    });
  }
});

export default router;