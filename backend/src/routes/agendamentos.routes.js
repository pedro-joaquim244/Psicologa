import express from "express";
import db from "../database.js";

import {
  autenticarToken,
  somentePsicologa,
  somentePaciente,
} from "../middlewares/autenticacao.js";

const router = express.Router();


// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

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
    } = req.body;
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


    const dataJS = new Date(`${data}T12:00:00`);

    if (Number.isNaN(dataJS.getTime())) {
      return res.status(400).json({
        erro: "Data inválida.",
      });
    }


    const diaSemana = dataJS.getDay();


    // ===================================================
    // BUSCAR DISPONIBILIDADE DA PSICÓLOGA
    // ===================================================

    const [disponibilidades] = await conexao.query(
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
      [
        profissional_id,
        diaSemana,
      ]
    );


    const horarioMinutos = horaParaMinutos(horario);

    let disponibilidadeEncontrada = null;


    for (const disponibilidade of disponibilidades) {
      const inicio = horaParaMinutos(
        disponibilidade.hora_inicio
      );

      const fim = horaParaMinutos(
        disponibilidade.hora_fim
      );

      const duracao = Number(
        disponibilidade.duracao_minutos
      );

      const intervalo = Number(
        disponibilidade.intervalo_minutos
      );


      for (
        let atual = inicio;
        atual + duracao <= fim;
        atual += duracao + intervalo
      ) {
        if (atual === horarioMinutos) {
          disponibilidadeEncontrada =
            disponibilidade;

          break;
        }
      }


      if (disponibilidadeEncontrada) {
        break;
      }
    }


    if (!disponibilidadeEncontrada) {
      return res.status(400).json({
        erro: "Este horário não está disponível.",
      });
    }


    // ===================================================
    // CALCULAR HORÁRIO FINAL
    // ===================================================

    const duracao = Number(
      disponibilidadeEncontrada.duracao_minutos
    );

    const horarioFim = minutosParaHora(
      horarioMinutos + duracao
    );


    const inicioCompleto =
      `${data} ${horario}:00`;

    const fimCompleto =
      `${data} ${horarioFim}:00`;


    // ===================================================
    // INICIAR TRANSAÇÃO
    // ===================================================

    await conexao.beginTransaction();


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


    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        erro: "Este horário já foi reservado.",
      });
    }


    console.error(
      "Erro ao realizar agendamento:",
      error
    );


    return res.status(500).json({
      erro: "Erro ao realizar agendamento.",
      detalhe: error.message,
    });

  } finally {
    if (conexao) {
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


      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          erro:
            "Agendamento não encontrado ou não pode ser confirmado.",
        });
      }


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


      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          erro:
            "Agendamento não encontrado ou não pode ser concluído.",
        });
      }


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


      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          erro:
            "Agendamento não encontrado ou já está cancelado.",
        });
      }


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


export default router;
