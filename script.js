const state = {
  chats: JSON.parse(localStorage.getItem('openchat.chats') || '[]'),
  activeChatId: localStorage.getItem('openchat.activeChatId') || null,
  attachments: [],
  settings: {
    baseUrl: localStorage.getItem('openchat.baseUrl') || '',
    token: localStorage.getItem('openchat.token') || '',
    model: localStorage.getItem('openchat.model') || '',
    timeoutSeconds: Number(localStorage.getItem('openchat.timeoutSeconds') || 120),
    streamReplies: localStorage.getItem('openchat.streamReplies') === 'true'
  }
};

function uid() { return Math.random().toString(36).slice(2, 10); }
function nowTitle() { return new Date().toLocaleString(); }

function saveChats() {
  localStorage.setItem('openchat.chats', JSON.stringify(state.chats));
  localStorage.setItem('openchat.activeChatId', state.activeChatId || '');
}

function activeChat() {
  return state.chats.find(c => c.id === state.activeChatId) || null;
}

function ensureInitialChat() {
  if (!state.chats.length) {
    state.chats.push({ id: uid(), title: 'New chat', archived: false, messages: [] });
  }
  if (!state.activeChatId || !activeChat()) {
    const first = state.chats.find(c => !c.archived) || state.chats[0];
    state.activeChatId = first.id;
  }
  saveChats();
}

function renderMessage(role, text) {
  const $msg = $('<div class="msg">').addClass(role).text(text);
  $('#chat').append($msg);
  $('#chat').scrollTop($('#chat')[0].scrollHeight);
  return $msg;
}

function renderAssistantChunked(text, maxChars = 1200) {
  if (!text || text.length <= maxChars) return renderMessage('assistant', text || '');
  const blocks = text.split(/\n\n+/);
  let bucket = '';
  for (const block of blocks) {
    const candidate = bucket ? `${bucket}\n\n${block}` : block;
    if (candidate.length > maxChars && bucket) {
      renderMessage('assistant', bucket);
      bucket = block;
    } else bucket = candidate;
  }
  if (bucket) renderMessage('assistant', bucket);
}

function normalizeBaseUrl(input) {
  let url = (input || '').trim().replace(/\/$/, '');
  url = url.replace(/\/index\.html?$/i, '');
  url = url.replace(/\/v1\/chat\/completions$/i, '');
  return url;
}

function validateSettingsForPage(baseUrl) {
  if (location.protocol === 'https:' && /^http:\/\//i.test(baseUrl)) {
    return 'Mixed-content blocked: this page is HTTPS but Gateway URL is HTTP.';
  }
  if (!/^https?:\/\//i.test(baseUrl)) return 'Gateway Base URL must start with http:// or https://';
  return null;
}

function renderChatList() {
  const $list = $('#chatList').empty();
  state.chats.filter(c => !c.archived).forEach(c => {
    const $item = $('<div class="chat-item">').toggleClass('active', c.id === state.activeChatId);
    const $title = $('<div class="title">').text(c.title || 'Untitled').on('click', () => {
      state.activeChatId = c.id; saveChats(); renderAll();
    });
    const $actions = $('<div class="actions">');
    const $archive = $('<button class="tiny ghost">Archive</button>').on('click', () => {
      c.archived = true;
      if (state.activeChatId === c.id) {
        const next = state.chats.find(x => !x.archived && x.id !== c.id);
        if (next) state.activeChatId = next.id;
      }
      ensureInitialChat(); renderAll();
    });
    const $del = $('<button class="tiny ghost">Delete</button>').on('click', () => {
      state.chats = state.chats.filter(x => x.id !== c.id);
      ensureInitialChat(); renderAll();
    });
    $actions.append($archive, $del);
    $item.append($title, $actions);
    $list.append($item);
  });
}

function renderActiveChat() {
  const chat = activeChat();
  if (!chat) return;
  $('#chatTitle').text(chat.title || 'New chat');
  $('#chatMeta').text(chat.archived ? 'Archived' : 'Active');
  const $chat = $('#chat').empty();
  if (!chat.messages.length) {
    renderMessage('system', 'Welcome to openchat. Open Settings to connect your OpenClaw gateway.');
    return;
  }
  chat.messages.forEach(m => {
    if (m.role === 'assistant') renderAssistantChunked(m.content);
    else renderMessage(m.role, m.content);
  });
}

function renderAttachments() {
  const $box = $('#attachments').empty();
  state.attachments.forEach((f, i) => {
    const size = `${Math.max(1, Math.round(f.size / 1024))}KB`;
    const $chip = $('<div class="file-chip">').append(
      $('<span>').text(f.name),
      $('<span class="muted">').text(size),
      $('<button class="tiny ghost">x</button>').on('click', () => { state.attachments.splice(i, 1); renderAttachments(); })
    );
    $box.append($chip);
  });
}

function renderAll() {
  saveChats();
  renderChatList();
  renderActiveChat();
  renderAttachments();
}

function openSettings() {
  $('#baseUrl').val(state.settings.baseUrl);
  $('#token').val(state.settings.token);
  $('#model').val(state.settings.model);
  $('#timeoutSeconds').val(state.settings.timeoutSeconds);
  $('#streamReplies').prop('checked', !!state.settings.streamReplies);
  $('#settingsDialog')[0].showModal();
}

function saveSettings() {
  state.settings.baseUrl = normalizeBaseUrl($('#baseUrl').val());
  state.settings.token = $('#token').val().trim();
  state.settings.model = $('#model').val().trim();
  state.settings.timeoutSeconds = Number($('#timeoutSeconds').val() || 120);
  state.settings.streamReplies = $('#streamReplies').is(':checked');

  const err = validateSettingsForPage(state.settings.baseUrl);
  if (err) return renderMessage('system', `Settings error: ${err}`);

  Object.entries(state.settings).forEach(([k, v]) => localStorage.setItem(`openchat.${k}`, String(v)));
  $('#settingsDialog')[0].close();
  renderMessage('system', 'Settings saved.');
}

async function testConnection() {
  const baseUrl = normalizeBaseUrl($('#baseUrl').val());
  const token = $('#token').val().trim();
  const err = validateSettingsForPage(baseUrl);
  if (err) return renderMessage('system', `Connection test failed: ${err}`);
  if (!baseUrl || !token) return renderMessage('system', 'Connection test failed: fill Gateway URL + token first.');

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ model: $('#model').val().trim() || undefined, messages: [{ role: 'user', content: 'ping' }], stream: false })
    });
    if (!res.ok) return renderMessage('system', `Connection test failed: HTTP ${res.status}`);
    renderMessage('system', 'Connection test passed.');
  } catch (e) {
    renderMessage('system', `Connection test failed: ${e.message}`);
  }
}

async function sendMessage(prompt) {
  const chat = activeChat();
  if (!chat) return;

  if (!state.settings.baseUrl || !state.settings.token) {
    renderMessage('system', 'Set Gateway URL + token first (Settings).');
    openSettings();
    return;
  }

  const err = validateSettingsForPage(state.settings.baseUrl);
  if (err) return renderMessage('system', `Error: ${err}`);

  if (!chat.messages.length && chat.title === 'New chat') chat.title = prompt.slice(0, 36);

  let content = prompt;
  if (state.attachments.length) {
    const names = state.attachments.map(f => f.name).join(', ');
    content += `\n\n[Attachments selected: ${names}]`;
  }

  chat.messages.push({ role: 'user', content });
  renderAll();
  state.attachments = [];
  $('#sendBtn').prop('disabled', true).text('Sending...');

  const payload = {
    model: state.settings.model || undefined,
    messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
    stream: !!state.settings.streamReplies
  };

  const timeoutMs = Math.max(10000, (state.settings.timeoutSeconds || 120) * 1000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    const res = await fetch(`${state.settings.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${state.settings.token}` },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }

    if (!state.settings.streamReplies) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      chat.messages.push({ role: 'assistant', content: reply });
      renderAll();
      clearTimeout(timer);
      return;
    }

    const $typing = renderMessage('assistant', '…').addClass('typing');
    let acc = '';
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split('\n\n');
      buf = events.pop() || '';
      for (const evt of events) {
        const line = evt.split('\n').find(l => l.startsWith('data: '));
        if (!line) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            acc += delta;
            $typing.removeClass('typing').text(acc);
            $('#chat').scrollTop($('#chat')[0].scrollHeight);
          }
        } catch {}
      }
    }

    clearTimeout(timer);
    const finalReply = acc || '(No response)';
    $typing.remove();
    chat.messages.push({ role: 'assistant', content: finalReply });
    renderAll();
  } catch (e) {
    renderMessage('system', `Error: ${e.name === 'AbortError' ? `Request timed out after ${state.settings.timeoutSeconds}s` : e.message}`);
  } finally {
    $('#sendBtn').prop('disabled', false).text('Send');
  }
}

$(function () {
  ensureInitialChat();
  renderAll();

  $('#openSettings').on('click', openSettings);
  $('#saveSettings').on('click', saveSettings);
  $('#testConnection').on('click', testConnection);
  $('#closeSettings').on('click', () => $('#settingsDialog')[0].close());

  $('#newChatBtn').on('click', () => {
    const c = { id: uid(), title: `Chat ${nowTitle()}`, archived: false, messages: [] };
    state.chats.unshift(c);
    state.activeChatId = c.id;
    renderAll();
  });

  $('#fileInput').on('change', (e) => {
    const files = Array.from(e.target.files || []);
    state.attachments.push(...files);
    renderAttachments();
    e.target.value = '';
  });

  $('#toggleSidebar').on('click', () => $('#sidebar').toggle());

  $('#composer').on('submit', async (e) => {
    e.preventDefault();
    const prompt = $('#prompt').val().trim();
    if (!prompt && !state.attachments.length) return;
    $('#prompt').val('');
    await sendMessage(prompt || 'Sent with attachments');
  });
});
