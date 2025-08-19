// server/index.ts
import express from "express";
import { createServer } from "http";
import { setupVite, serveStatic, log } from "./vite";
import { setupRoutes } from "./routes";
import { setupDb } from "./db";
// import { setupStorage } from "./storage"; // Exemplo, se você tiver uma função de configuração de armazenamento

const app = express();
const server = createServer(app);
const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

// Use middlewares que você precisa em ambas as etapas
app.use(express.json());
// ... outros middlewares globais

// Configuração do servidor Vite ou de arquivos estáticos
async function main() {
  try {
    if (isProduction) {
      log("Running in production mode...", "server");
      // Certifique-se de que a build do cliente foi feita
      serveStatic(app);
    } else {
      log("Running in development mode...", "server");
      // Configura o servidor Vite para o desenvolvimento
      await setupVite(app, server);
    }

    // Rotas da sua API
    setupRoutes(app);

    // Conecta-se ao banco de dados, se necessário
    // await setupDb();

    // Inicia o servidor
    server.listen(port, () => {
      log(`Server listening on http://localhost:${port}`, "server");
    });
  } catch (error) {
    log(`Failed to start server: ${error}`, "error");
    process.exit(1);
  }
}

main();