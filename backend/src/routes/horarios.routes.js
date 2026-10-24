import express from "express";
import db from "../database.js";

import { clinicNow, validDate, validId } from '../utils/scheduling.js';
import { loadDaySchedule } from '../services/agenda.js';
import { resolvePublicProfessionalId } from '../services/publicProfessional.js';
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// =====================================================
// LISTAR HORÁRIOS DISPONÍVEIS
//
// GET /api/horarios?data=2026-09-18
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, profissional_id: requestedProfessionalId } = req.query;

    if (!validDate(data) || (requestedProfessionalId != null && !validId(requestedProfessionalId))) {
      return res.status(400).json({ erro: 'Informe uma data e um profissional válidos.' });
    }
    const now = clinicNow();
    if (data < now.slice(0, 10)) return res.json({ data, horarios: [] });
    const profissional_id = await resolvePublicProfessionalId(db, requestedProfessionalId);
    const { horarios } = await loadDaySchedule(db, data, profissional_id);

    return res.json({
      data,
      horarios,
    });
  } catch (error) {
    console.error("Erro ao buscar horários:", error);

    return res.status(error.status || 500).json({
      erro: error.status ? error.message : "Erro ao buscar horários disponíveis.",
    });
  }
});

export default router;
