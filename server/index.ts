// Fixa o fuso horário do processo para bater com o fuso usado nas queries de
// data do Postgres (ver server/db.ts). Sem isso, "new Date(ano, mes-1, 1)" usa
// o fuso do container (normalmente UTC) e propostas criadas à noite (horário
// de Brasília) caem no mês errado nos relatórios/dashboard.
process.env.TZ = 'America/Sao_Paulo';

import express, { type Request, type Response, type NextFunction } from 'express';
import { registerRoutes } from '../server/routes.js';
import { serveStatic, log } from './runtime.js';

const app = express();
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const requestedStatus = Number(err.status || err.statusCode || 500);
    const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599 ? requestedStatus : 500;
    if(res.headersSent) return _next(err);
    res.status(status).json({ message: status>=500 ? 'Não foi possível concluir a operação.' : 'Requisição inválida.' });
    // Do not crash the process or log request bodies/tokens on a malformed request.
    log(`Request failed with status ${status}`);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import('./vite.js');
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    // reusePort nao e suportado no Windows (ENOTSUP) e so importa quando ha
    // multiplos processos dividindo a mesma porta (nao e o caso aqui).
    ...(process.platform === "linux" ? { reusePort: true } : {}),
  }, () => {
    log(`serving on port ${port}`);
  });
})();
