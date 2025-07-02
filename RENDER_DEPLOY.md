# Despliegue en Render

## Configuración para Render

Este proyecto está configurado para desplegarse automáticamente en Render como una aplicación Node.js full-stack.

### Variables de Entorno Requeridas

En tu dashboard de Render, configura las siguientes variables de entorno:

1. **OPENAI_API_KEY**: Tu clave de API de OpenAI (obligatorio)
2. **NODE_ENV**: `production` (se establece automáticamente)

### Configuración de Build

Render ejecutará automáticamente:
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`

### Archivos de Configuración

- `render.yaml`: Configuración específica para Render
- Los archivos estáticos se generan en `dist/public/`
- El servidor sirve tanto el API como el frontend compilado

### Verificación

Una vez desplegado, tu aplicación debería:
1. Servir el frontend React en la ruta raíz (`/`)
2. Manejar las rutas del API (`/api/chat-cocina`, `/api/chat-history/:sessionId`)
3. Funcionar independientemente sin necesidad de que Replit esté ejecutándose

### Solución de Problemas

Si encuentras errores:
1. Verifica que `OPENAI_API_KEY` esté configurada correctamente
2. Revisa los logs de build para errores de compilación
3. Asegúrate de que todas las dependencias estén listadas en `package.json`