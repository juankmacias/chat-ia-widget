# Chat IA Widget

Widget de chat estilo WhatsApp con Claude (Anthropic) como motor de IA. Backend en Node.js + Express, persistencia en Neon (Postgres).

## Estructura

```
chat-ia-widget/
├── server.js              # Servidor Express + endpoint /api/chat
├── db.js                  # Pool de Neon + helpers de BD
├── db-init.js             # Script para crear las tablas
├── system-prompt.js       # Aquí defines la personalidad del bot
├── schema.sql             # Esquema SQL
├── package.json
├── .env.example           # Plantilla de variables (copia a .env)
└── public/
    ├── index.html         # Página demo
    ├── widget.css         # Estilos estilo WhatsApp
    └── widget.js          # Lógica del widget
```

## Instalación local

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar plantilla de entorno y editar .env
cp .env.example .env
# Edita .env y rellena ANTHROPIC_API_KEY y DATABASE_URL

# 3. Crear tablas en Neon
npm run db:init

# 4. Editar system-prompt.js con la info del producto
# (descripción, características, precio, FAQ, etc.)

# 5. Arrancar servidor
npm start
# o en desarrollo con auto-reload
npm run dev
```

Abre http://localhost:3000 para ver la página demo con el widget.

## Subir a GitHub

```bash
git init
git add .
git commit -m "Setup inicial del chat IA widget"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

## Crear las tablas en Neon (alternativa manual)

Si prefieres no usar `npm run db:init`, pega el contenido de `schema.sql` en el SQL Editor de Neon y ejecuta.

## Integrar en tu sitio real

```html
<link rel="stylesheet" href="https://tu-servidor.com/widget.css" />
<script>
  window.CHAT_WIDGET_API_URL = "https://tu-servidor.com/api/chat";
  window.CHAT_WIDGET_BOT_NAME = "Asesor del producto";
  window.CHAT_WIDGET_BOT_INITIAL = "A";
  window.CHAT_WIDGET_WELCOME = "¡Hola! ¿En qué te ayudo?";
</script>
<script src="https://tu-servidor.com/widget.js"></script>
```

## Configurar la personalidad del bot

Edita `system-prompt.js` con la información de tu producto. El bot:
- Mantiene el historial de cada visitante en Neon (por `sessionId` en localStorage)
- Responde corto, estilo WhatsApp, con la personalidad que definas
- Si la API falla, muestra un mensaje amigable al usuario
