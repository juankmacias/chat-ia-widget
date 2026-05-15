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
      '<svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';

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

  const MEDIA_REGEX = /\[\[(audio|image|video):([a-z0-9-]+)\]\]/g;

  function addMediaMessage(body, role, type, slug) {
    const msg = el('div', 'chat-widget__msg chat-widget__msg--' + role + ' chat-widget__msg--media');
    const url = '/media/' + type + '/' + slug;
    let media;
    if (type === 'audio') {
      media = el('audio', 'chat-widget__audio');
      media.controls = true;
      media.preload = 'metadata';
      media.src = url;
    } else if (type === 'image') {
      media = el('img', 'chat-widget__image');
      media.src = url;
      media.loading = 'lazy';
      media.alt = slug;
    } else if (type === 'video') {
      media = el('video', 'chat-widget__video');
      media.controls = true;
      media.preload = 'metadata';
      media.src = url;
    }
    msg.appendChild(media);
    const time = el('div', 'chat-widget__time', timeNow());
    msg.appendChild(time);
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
  }

  const SPLIT_REGEX = /\[\[split\]\]/gi;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function addBotResponse(body, text) {
    const mediaItems = [];
    let match;
    MEDIA_REGEX.lastIndex = 0;
    while ((match = MEDIA_REGEX.exec(text)) !== null) {
      mediaItems.push({ type: match[1], slug: match[2] });
    }
    const cleanText = text.replace(MEDIA_REGEX, '').trim();
    const parts = cleanText
      .split(SPLIT_REGEX)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    for (let i = 0; i < parts.length; i++) {
      if (i > 0) {
        const typing = showTyping(body);
        const delay = 600 + Math.min(parts[i].length * 18, 1400);
        await sleep(delay);
        typing.remove();
      }
      addMessage(body, 'bot', parts[i]);
    }

    for (const item of mediaItems) {
      addMediaMessage(body, 'bot', item.type, item.slug);
    }
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
        await addBotResponse(ui.body, reply);
      } catch (err) {
        typing.remove();
        addMessage(ui.body, 'bot', 'Ups, algo falló 😅. Pero no te preocupes, escríbeme directamente al WhatsApp 322 3671553 y te atiendo de una.');
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
