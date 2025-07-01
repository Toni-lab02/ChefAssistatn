import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatMessageSchema } from "@shared/schema";
import OpenAI from "openai";
import { z } from "zod";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
});

const chatRequestSchema = z.object({
  mensaje: z.string().min(1),
  sessionId: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat endpoint for cooking assistant
  app.post("/api/chat-cocina", async (req, res) => {
    // Parse request and determine session ID outside try block for error handling
    const { mensaje, sessionId } = chatRequestSchema.parse(req.body);
    const userIP = req.ip || req.connection.remoteAddress || "unknown";
    const finalSessionId = sessionId || `ip-${userIP}`;
    
    try {

      // Store user message
      await storage.createChatMessage({
        content: mensaje,
        sender: "user",
        sessionId: finalSessionId,
      });

      // Check if we have a valid API key
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "MiniChef") {
        const respuestaChef = `¡Hola! Soy tu Chef Personal AI 👨‍🍳

Para poder ayudarte con recetas y consejos de cocina, necesito que configures una clave de API de OpenAI válida.

Mientras tanto, te puedo decir que soy un chef experto que puede ayudarte con:
🍝 Recetas paso a paso
🥗 Sugerencias de ingredientes
🍲 Técnicas de cocina
🧁 Ideas para postres

¡Una vez que tengas la API configurada, podremos cocinar juntos!`;

        // Store chef response
        await storage.createChatMessage({
          content: respuestaChef,
          sender: "chef",
          sessionId: finalSessionId,
        });

        res.json({ respuesta: respuestaChef });
        return;
      }

      // Get conversation history for context (limit to last 10-15 messages)
      const conversationHistory = await storage.getChatMessages(finalSessionId);
      const recentHistory = conversationHistory.slice(-14); // Keep last 14 messages + current = 15 max

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
- Recuerdas el contexto de la conversación anterior para dar respuestas más precisas

Ejemplo de cómo debes responder:
Usuario: me apetece algo con arroz
Tú: ¡Perfecto! Te sugiero un delicioso arroz con verduras salteadas 🍚✨

Ingredientes:
🍚 1 taza de arroz
🧅 1 cebolla pequeña
🥕 1 zanahoria
🥢 Salsa de soja al gusto

Se hace en solo 20 minutos. ¿Quieres que te explique los pasos?

Cuando el usuario haga referencias como "dame otra", "sin cebolla", "más rápida", "los pasos detallados", etc., usa el contexto de la conversación para entender a qué se refiere exactamente.
      `;

      // Build conversation messages for OpenAI
      const messages: Array<{role: "system" | "user" | "assistant", content: string}> = [
        { role: "system", content: promptSistema }
      ];

      // Add conversation history
      recentHistory.forEach(msg => {
        const role = msg.sender === "user" ? "user" : "assistant";
        messages.push({
          role: role as "user" | "assistant",
          content: msg.content
        });
      });

      // Add current user message
      messages.push({
        role: "user" as const,
        content: mensaje
      });

      const respuestaIA = await openai.chat.completions.create({
        model: "gpt-4o", // Use gpt-4o as it's the newest model
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
      });

      const respuestaChef = respuestaIA.choices[0].message.content || "Lo siento, no pude procesar tu consulta. ¿Puedes intentarlo de nuevo?";

      // Store chef response
      await storage.createChatMessage({
        content: respuestaChef,
        sender: "chef",
        sessionId: finalSessionId,
      });

      res.json({ respuesta: respuestaChef });
    } catch (error: any) {
      console.error("Error in chat endpoint:", error);
      
      if (error.code === 'insufficient_quota') {
        const respuestaChef = `¡Hola! Soy tu Chef Personal AI 👨‍🍳

Tu clave de OpenAI es válida, pero necesitas añadir créditos a tu cuenta de OpenAI para usar la API.

Ve a https://platform.openai.com/settings/organization/billing para añadir créditos.

Una vez que tengas créditos disponibles, podremos cocinar juntos con recetas personalizadas.`;

        // Store chef response about quota
        await storage.createChatMessage({
          content: respuestaChef,
          sender: "chef",
          sessionId: finalSessionId,
        });

        res.json({ respuesta: respuestaChef });
        return;
      }
      
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
