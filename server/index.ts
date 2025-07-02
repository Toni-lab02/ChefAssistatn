import express, { type Request, Response, NextFunction } from "express";
import cors from "cors"; // ✅ Importamos CORS
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// ✅ Configuración CORS más flexible para producción
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        "https://chefassistatn.onrender.com",
        /\.onrender\.com$/,
        /\.replit\.app$/,
        /\.replit\.dev$/
      ]
    : true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

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
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Detecta el entorno correctamente - Render establece NODE_ENV=production automáticamente
  const isDevelopment = process.env.NODE_ENV === "development" || (!process.env.NODE_ENV && process.env.REPL_ID);
  
  if (isDevelopment) {
    // Desarrollo: usa Vite dev server
    console.log("🔧 Modo desarrollo - usando Vite dev server");
    await setupVite(app, server);
  } else {
    // Producción: sirve archivos estáticos compilados
    console.log("🚀 Modo producción - sirviendo archivos estáticos");
    serveStatic(app);
  }

  const port = process.env.PORT || 5000;
  server.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });
})();
