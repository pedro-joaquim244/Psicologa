import { copyFile } from "node:fs/promises";

// GitHub Pages usa 404.html como fallback para URLs acessadas diretamente.
await copyFile("dist/index.html", "dist/404.html");
