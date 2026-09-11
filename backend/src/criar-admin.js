import bcrypt from "bcryptjs";
import db from "./database.js";

async function criarAdmin() {
  try {
    const nome = "Dra. Helena Martins";
    const email = "psicologa@email.com";
    const senhaNormal = "123456";

    const senhaCriptografada = await bcrypt.hash(senhaNormal, 12);

    const [existente] = await db.query(
      `
      SELECT id
      FROM usuarios_admin
      WHERE email = ?
      `,
      [email]
    );

    if (existente.length > 0) {
      console.log("Esse usuário já existe.");
      process.exit();
    }

    await db.query(
      `
      INSERT INTO usuarios_admin
      (
        nome,
        email,
        senha,
        tipo,
        ativo
      )
      VALUES (?, ?, ?, 'psicologa', 1)
      `,
      [
        nome,
        email,
        senhaCriptografada
      ]
    );

    console.log("Usuário criado com sucesso!");
    console.log("E-mail:", email);
    console.log("Senha:", senhaNormal);

    process.exit();

  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    process.exit(1);
  }
}

criarAdmin();