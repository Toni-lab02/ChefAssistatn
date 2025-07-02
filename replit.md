# Chef Assistant Chat Application

## Overview
A full-stack chat application that provides cooking assistance using OpenAI's GPT models. The application features a modern web interface built with React and a Node.js/Express backend with real-time chat functionality.

## Project Architecture
- **Frontend**: React with Vite, TypeScript, TailwindCSS, and shadcn/ui components
- **Backend**: Express.js server with OpenAI integration
- **Storage**: In-memory storage for chat messages and user data
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for API state management
- **Styling**: TailwindCSS with custom dark mode support

## Key Features
- Real-time chat interface with cooking assistant
- Session-based chat history
- Responsive design with dark mode support
- OpenAI GPT integration for cooking advice
- Client/server separation for security

## Recent Changes
- **July 1, 2025**: Successfully migrated from Replit Agent to Replit environment
  - Configured OpenAI API key for chat functionality
  - Fixed endpoint mismatch: changed server route from `/api/chat` to `/api/chat-cocina`
  - Updated CORS configuration for production deployment flexibility
  - Removed hardcoded API_BASE_URL to support relative URLs in production
  - Added @types/cors dependency for TypeScript compatibility
  - Resolved "Error: no se pudo enviar el mensaje" issue for Render deployment
- **July 2, 2025**: Added conversational context and independent deployment
  - Implemented session-based conversation memory (last 14 messages)
  - Upgraded to gpt-4o model for better responses
  - Added IP-based session fallback for automatic session management
  - Created independent deployment configuration for Render
  - Enhanced environment detection for development vs production
  - Added render.yaml and deployment documentation
  - Integrated Lovable iframe communication for structured recipe data
  - Enhanced AI prompt for better structured recipe responses
  - Added automatic recipe parsing and postMessage to parent window

## User Preferences
- Language: Spanish (as evidenced by code comments)
- Prefers clear CORS configuration with security considerations
- Values proper error handling and logging

## Technical Stack
- Node.js 20 with TypeScript
- Express.js with CORS enabled
- React 18 with hooks and modern patterns
- Drizzle ORM with Zod validation
- TailwindCSS for styling
- OpenAI API for chat responses

## Environment Requirements
- OPENAI_API_KEY: Required for chat functionality
- NODE_ENV: Set to development for local development
- PORT: Defaults to 5000 if not specified

## API Endpoints
- `POST /api/chat-cocina`: Send chat messages to cooking assistant
- `GET /api/chat-history/:sessionId`: Retrieve chat history for a session

## Development Workflow
- Uses `npm run dev` to start both frontend and backend
- Vite dev server handles frontend with hot reload
- Express server handles API requests
- Automatic restart on file changes