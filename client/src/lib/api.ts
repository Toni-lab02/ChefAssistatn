import { apiRequest } from "./queryClient";

export interface ChatMessage {
  id: number;
  content: string;
  sender: "user" | "chef";
  timestamp: string;
}

export interface ChatResponse {
  respuesta: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
}

export async function sendChatMessage(mensaje: string, sessionId: string = "default-session"): Promise<ChatResponse> {
  const response = await apiRequest("POST", "/api/chat-cocina", { mensaje, sessionId });
  return response.json();
}

export async function getChatHistory(sessionId: string = "default-session"): Promise<ChatHistoryResponse> {
  const response = await apiRequest("GET", `/api/chat-history/${sessionId}`);
  return response.json();
}
