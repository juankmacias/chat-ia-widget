(function () {
  'use strict';

  const CONFIG = {
    apiUrl: window.CHAT_WIDGET_API_URL || '/api/chat',
    botName: window.CHAT_WIDGET_BOT_NAME || 'Asistente',
    botInitial: window.CHAT_WIDGET_BOT_INITIAL || 'A',
    welcomeMessage:
      window.CHAT_WIDGET_WELCOME || '¡Hola! 👋 ¿En qué puedo ayudarte hoy?',
  };

  function getSessionId() {
    let id = localStorage.getItem('chat_widget_session');
    if (!id) {
      id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('chat_widget_session', id);
    }
    return id;
  }

  function timeNow() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0');
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  }

  function buildWidget() {
    const root = el('div', 'chat-widget');

    // Botón flotante
    const btn = el('button', 'chat-widget__button');
    btn.setAttribute('aria-label', 'Abrir chat');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>';

    // Ventana
    const win = el('div', 'chat-widget__window');

    // Header
    const header = el('div', 'chat-widget__header');
    const avatar = el('div', 'chat-widget__avatar', CONFIG.botInitial);
    const info = el('div', 'chat-widget__header-info');
    info.appendChild(el('div', 'chat-widget__name', CONFIG.botName));
    info.appendChild(el('div', 'chat-widget__status', 'en línea'));
    const closeBtn = el('button', 'chat-widget__close', '×');
    closeBtn.setAttribute('aria-label', 'Cerrar chat');
    header.appendChild(avatar);
    header.appendChild(info);
    header.appendChild(closeBtn);

    // Body
    const body = el('div', 'chat-widget__body');

    // Footer
    const footer = el('div', 'chat-widget__footer');
    const input = el('textarea', 'chat-widget__input');
    input.placeholder = 'Escribe un mensaje...';
    input.rows = 1;
    const sendBtn = el('button', 'chat-widget__send');
    sendBtn.setAttribute('aria-label', 'Enviar');
    sendBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    footer.appendChild(input);
    footer.appendChild(sendBtn);

    win.appendChild(header);
    win.appendChild(body);
    win.appendChild(footer);
    root.appendChild(win);
    root.appendChild(btn);
    document.body.appendChild(root);

    return { root, btn, win, body, input, sendBtn, closeBtn };
  }

  function addMessage(body, role, text) {
    const msg = el('div', 'chat-widget__msg chat-widget__msg--' + role);
    msg.textContent = text;
    const time = el('div', 'chat-widget__time', timeNow());
    msg.appendChild(time);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function showTyping(body) {
    const typing = el('div', 'chat-widget__typing');
    typing.appendChild(el('span'));
    typing.appendChild(el('span'));
    typing.appendChild(el('span'));
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;
    return typing;
  }

  async function sendToBackend(message, sessionId) {
    const res = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error en el servidor');
    }
    const data = await res.json();
    return data.reply;
  }

  function init() {
    const ui = buildWidget();
    const sessionId = getSessionId();
    let isOpen = false;
    let isSending = false;

    // Mensaje de bienvenida
    addMessage(ui.body, 'bot', CONFIG.welcomeMessage);

    function toggleWindow(open) {
      isOpen = open;
      ui.win.classList.toggle('chat-widget__window--open', open);
      if (open) setTimeout(() => ui.input.focus(), 100);
    }

    ui.btn.addEventListener('click', () => toggleWindow(!isOpen));
    ui.closeBtn.addEventListener('click', () => toggleWindow(false));

    // Autoexpandir textarea
    ui.input.addEventListener('input', () => {
      ui.input.style.height = 'auto';
      ui.input.style.height = Math.min(ui.input.scrollHeight, 100) + 'px';
    });

    async function send() {
      const text = ui.input.value.trim();
      if (!text || isSending) return;

      isSending = true;
      ui.sendBtn.disabled = true;
      ui.input.value = '';
      ui.input.style.height = 'auto';

      addMessage(ui.body, 'user', text);
      const typing = showTyping(ui.body);

      try {
        const reply = await sendToBackend(text, sessionId);
        typing.remove();
        addMessage(ui.body, 'bot', reply);
      } catch (err) {
        typing.remove();
        addMessage(ui.body, 'bot', 'Disculpa, hubo un error. Intenta de nuevo en un momento.');
        console.error('[chat-widget]', err);
      } finally {
        isSending = false;
        ui.sendBtn.disabled = false;
        ui.input.focus();
      }
    }

    ui.sendBtn.addEventListener('click', send);
    ui.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
