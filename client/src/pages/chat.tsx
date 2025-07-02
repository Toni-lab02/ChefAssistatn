import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sendChatMessage, getChatHistory, type ChatMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChefHat, Send, Paperclip } from "lucide-react";

// Function to send recipe data to Lovable iframe parent
function enviarRecetaALovable(titulo: string, ingredientes: string[], pasos: string[]) {
  const mensaje = {
    type: "NUEVA_RECETA",
    data: {
      titulo,
      ingredientes, // array de strings
      pasos         // array de strings
    }
  };

  window.parent.postMessage(mensaje, "*"); // puedes reemplazar '*' por el dominio exacto si lo sabes
}

// Function to capitalize first letter
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Function to extract title from recipe text
function extraerTitulo(texto: string): string {
  // Look for phrases that suggest a recipe recommendation
  const match = texto.match(/(?:te propongo|te sugiero|te recomiendo)\s+una?\s+(.*?)\s*(?:[,\.!]|$)/i);
  if (match && match[1]) {
    return capitalizar(match[1].trim());
  }

  // Alternative patterns for recipe suggestions
  const alternativeMatch = texto.match(/(?:receta de|plato de|deliciosa?)\s+(.*?)\s*(?:[,\.!]|$)/i);
  if (alternativeMatch && alternativeMatch[1]) {
    return capitalizar(alternativeMatch[1].trim());
  }

  // Fallback: look for the first line that might contain a recipe name
  const lines = texto.split("\n").filter(line => line.trim());
  if (lines.length > 0) {
    let titulo = lines[0].replace(/^(receta|plato)[:\-]?\s*/i, "").trim();
    titulo = titulo.replace(/[🍝🥗🍲🧁✨🍽️😋¡!]/g, "").trim();
    
    if (titulo) {
      return capitalizar(titulo);
    }
  }

  return "Receta del Chef";
}

// Function to extract ingredients from recipe text
function extraerIngredientes(texto: string): string[] {
  const match = texto.match(/Ingredientes:\s*([\s\S]*?)\n(?:Pasos|Instrucciones):/i);
  if (!match) return [];
  
  return match[1]
    .split("\n")
    .map(line => line.replace(/^[🍚🧅🥕🥢🍖🧄🌿•-]\s*/, "").trim())
    .filter(line => line && !line.toLowerCase().includes("ingredientes"));
}

// Function to extract steps from recipe text
function extraerPasos(texto: string): string[] {
  const match = texto.match(/(Pasos|Instrucciones):\s*([\s\S]*)/i);
  if (!match) return [];
  
  return match[2]
    .split(/\n\d+\.\s*/)
    .map(paso => paso.trim())
    .filter(paso => paso && paso.length > 5);
}

// Main function to detect and send recipe to Lovable
function detectarYEnviarReceta(respuestaTexto: string): boolean {
  try {
    const contieneIngredientes = respuestaTexto.includes("Ingredientes:");
    const contienePasos = respuestaTexto.includes("Pasos:") || respuestaTexto.includes("Instrucciones:");

    console.log("Checking recipe:", { contieneIngredientes, contienePasos });

    if (contieneIngredientes && contienePasos) {
      const titulo = extraerTitulo(respuestaTexto);
      const ingredientes = extraerIngredientes(respuestaTexto);
      const pasos = extraerPasos(respuestaTexto);

      console.log("Extracted recipe data:", { titulo, ingredientes, pasos });

      if (ingredientes.length > 0) {
        const mensaje = {
          type: "NUEVA_RECETA",
          data: {
            titulo,
            ingredientes,
            pasos
          }
        };

        console.log("Sending postMessage to parent:", mensaje);
        window.parent.postMessage(mensaje, "*");
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("Error detecting recipe:", error);
    return false;
  }
}

export default function Chat() {
  const [message, setMessage] = useState("");
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch chat history
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["/api/chat-history", sessionId],
    queryFn: () => getChatHistory(sessionId),
  });

  const messages = chatHistory?.messages || [];

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (mensaje: string) => sendChatMessage(mensaje, sessionId),
    onSuccess: () => {
      // Invalidate and refetch chat history
      queryClient.invalidateQueries({ queryKey: ["/api/chat-history", sessionId] });
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || sendMessageMutation.isPending) return;
    
    sendMessageMutation.mutate(trimmedMessage);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setMessage(suggestion);
    if (textareaRef.current) {
      textareaRef.current.focus();
      adjustTextareaHeight();
    }
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 128) + "px";
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sendMessageMutation.isPending]);

  // Monitor messages for recipes and send to Lovable
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Check if the last message is from the chef and contains recipe information
      if (lastMessage.sender === "chef") {
        console.log("New chef message received, checking for recipe...");
        const recipeDetected = detectarYEnviarReceta(lastMessage.content);
        
        if (recipeDetected) {
          console.log("✅ Recipe successfully sent to Lovable!");
        } else {
          console.log("ℹ️ No structured recipe detected in this message");
        }
      }
    }
  }, [messages]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const suggestions = [
    "🍝 Pasta rápida",
    "🥗 Ensalada fresca",
    "🍲 Guiso casero",
    "🧁 Postre fácil",
  ];

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto bg-white shadow-xl">
      {/* Header */}
      <header className="bg-gradient-to-r from-[var(--chef-orange)] to-[var(--chef-amber)] text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Chef Cocina AI</h1>
              <p className="text-sm text-white text-opacity-90">Tu asistente de cocina personal</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-[var(--chef-green)] rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">En línea</span>
          </div>
        </div>
      </header>

      {/* Welcome Section */}
      {messages.length === 0 && (
        <div className="px-4 py-6 bg-gradient-to-b from-orange-50 to-white border-b border-gray-100">
          <div className="text-center mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-[var(--chef-orange)] bg-opacity-10 rounded-full flex items-center justify-center">
              <ChefHat className="w-10 h-10 text-[var(--chef-orange)]" />
            </div>
            <h2 className="text-2xl font-bold text-[var(--chef-slate)] mb-2">¡Hola! Soy tu Chef Personal</h2>
            <p className="text-gray-600 text-lg">Pregúntame sobre recetas, ingredientes o cualquier cosa relacionada con cocina</p>
          </div>
          
          <div className="flex flex-wrap gap-2 justify-center">
            {suggestions.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="bg-white hover:bg-[var(--chef-orange)] hover:text-white text-[var(--chef-slate)] px-4 py-2 rounded-full border border-gray-200 transition-all duration-200 transform hover:scale-105 shadow-sm"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide min-h-96">
        {isLoadingHistory ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--chef-orange)]"></div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex message-bubble ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.sender === "user" ? (
                <div className="max-w-xs lg:max-w-md bg-gray-100 text-[var(--chef-slate)] rounded-2xl rounded-br-md px-4 py-3 shadow-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-[var(--chef-orange)] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <ChefHat className="w-5 h-5 text-white" />
                  </div>
                  <div className="max-w-xs lg:max-w-md bg-[var(--chef-orange)] text-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div className="text-xs text-white text-opacity-80 mt-2">
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {sendMessageMutation.isPending && (
          <div className="flex justify-start message-bubble">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-[var(--chef-orange)] rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <div className="bg-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full typing-indicator"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full typing-indicator" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full typing-indicator" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          <div className="flex-1">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Pregúntame sobre recetas, ingredientes o cocina..."
                className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-[var(--chef-orange)] focus:border-transparent max-h-32 min-h-12"
                rows={1}
                disabled={sendMessageMutation.isPending}
              />
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[var(--chef-orange)] transition-colors duration-200 p-2 h-auto"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <Button
            type="submit"
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="bg-[var(--chef-orange)] hover:bg-orange-600 text-white rounded-full p-3 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-[var(--chef-orange)] focus:ring-offset-2 shadow-lg disabled:opacity-50 disabled:transform-none"
          >
            <Send className="w-5 h-5" />
          </Button>
        </form>
        
        <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
          <span>Potenciado por IA • Chef Cocina</span>
          <span>{message.length}/1000</span>
        </div>
      </div>
    </div>
  );
}
