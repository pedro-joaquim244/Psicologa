import express from "express";
import cors from "cors";
import "dotenv/config";

import db from "./database.js";

import horariosRoutes from "./routes/horarios.routes.js";
import agendamentosRoutes from "./routes/agendamentos.routes.js";
import authRoutes from "./routes/auth.routes.js";
import pacientesRoutes from './routes/pacientes.routes.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json());


// =====================================================
// TESTE DA API
// =====================================================

app.get("/", (req, res) => {
  res.json({
    mensagem: "API da agenda funcionando!",
  });
});


// =====================================================
// TESTE DO BANCO
// =====================================================

app.get("/api/teste-banco", async (req, res) => {
  try {
    const [resultado] = await db.query(
      "SELECT NOW() AS agora"
    );

    res.json({
      mensagem: "Banco conectado com sucesso!",
      resultado,
    });

  } catch (error) {
    console.error(
      "Erro ao conectar no banco:",
      error
    );

    res.status(500).json({
      erro: "Não foi possível conectar no banco.",
      detalhe: error.message,
    });
  }
});


// =====================================================
// ROTAS
// =====================================================

app.use("/api/auth", authRoutes);
app.use('/api/pacientes', pacientesRoutes);

app.use("/api/horarios", horariosRoutes);

app.use("/api/agendamentos", agendamentosRoutes);


// =====================================================
// SERVIDOR
// =====================================================

const PORT = process.env.PORT || 3333;

app.listen(PORT, () => {
  console.log(
    `API rodando em http://localhost:${PORT}`
  );
});
