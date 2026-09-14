import express from "express";
import db from "../database.js";

import { clinicNow, validDate, validId } from '../utils/scheduling.js';
import { loadDaySchedule } from '../services/agenda.js';
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
    const { horarios } = await loadDaySchedule(db, data, profissional_id);

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
