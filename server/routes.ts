import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatMessageSchema } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "your-api-key-here"
});

const chatRequestSchema = z.object({
  mensaje: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint for cooking assistant
  app.post("/api/chat-cocina", async (req, res) => {
    try {
      const { mensaje, sessionId = "default-session" } = chatRequestSchema.parse(req.body);

      // Store user message
      await storage.createChatMessage({
        content: mensaje,
        sender: "user",
        sessionId,
      });

      const promptSistema = `
Eres un chef experto español muy amigable y entusiasta. Solo hablas de comida, cocina, recetas, ingredientes y menús. No hablas de otros temas. Respondes con amabilidad, en lenguaje natural, como si fueras un chef amigo.

Características de tus respuestas:
- Siempre respondes en español
- Usas emojis relacionados con comida cuando sea apropiado
- Das recetas prácticas y fáciles de seguir
- Incluyes ingredientes específicos y tiempos de cocción
- Eres entusiasta sobre la cocina casera
- Adaptas las recetas según las preferencias del usuario (sin cebolla, más rápido, etc.)
- Cuando mencionas ingredientes, los presentas de forma organizada

Ejemplo de cómo debes responder:
Usuario: me apetece algo con arroz
Tú: ¡Perfecto! Te sugiero un delicioso arroz con verduras salteadas 🍚✨

Ingredientes:
🍚 1 taza de arroz
🧅 1 cebolla pequeña
🥕 1 zanahoria
🥢 Salsa de soja al gusto

Se hace en solo 20 minutos. ¿Quieres que te explique los pasos?

Debes entender cuando el usuario dice "dame otra", "sin cebolla", "más rápida", etc., y adaptar tu respuesta en consecuencia.
      `;

      const respuestaIA = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: mensaje },
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const respuestaChef = respuestaIA.choices[0].message.content || "Lo siento, no pude procesar tu consulta. ¿Puedes intentarlo de nuevo?";

      // Store chef response
      await storage.createChatMessage({
        content: respuestaChef,
        sender: "chef",
        sessionId,
      });

      res.json({ respuesta: respuestaChef });
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ error: "Algo salió mal con la IA. Inténtalo de nuevo." });
    }
  });

  // Get chat history
  app.get("/api/chat-history/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const messages = await storage.getChatMessages(sessionId);
      res.json({ messages });
    } catch (error) {
      console.error("Error fetching chat history:", error);
      res.status(500).json({ error: "Error al obtener el historial de chat" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
