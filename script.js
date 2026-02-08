const state = {
  chats: JSON.parse(localStorage.getItem('openchat.chats') || '[]'),
  activeChatId: localStorage.getItem('openchat.activeChatId') || null,
  attachments: [],
  showArchived: localStorage.getItem('openchat.showArchived') === 'true',
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
  localStorage.setItem('openchat.showArchived', String(state.showArchived));
}

function activeChat() { return state.chats.find(c => c.id === state.activeChatId) || null; }

function ensureInitialChat() {
  if (!state.chats.length) state.chats.push({ id: uid(), title: 'New chat', archived: false, messages: [] });
  if (!state.activeChatId || !activeChat()) {
    const first = state.chats.find(c => !c.archived) || state.chats[0];
    state.activeChatId = first?.id || null;
  }
  saveChats();
}

function renderMessage(role, text, opts = {}) {
  const $wrap = $('<div class="msg-wrap">').addClass(role === 'user' ? 'user-wrap' : '');
  const $msg = $('<div class="msg">').addClass(role).text(text || '');
  $wrap.append($msg);

  if (!opts.skipActions && (role === 'user' || role === 'assistant')) {
    const $actions = $('<div class="msg-actions">');
    $actions.append($('<button type="button">Copy</button>').on('click', async () => {
      try { await navigator.clipboard.writeText(text || ''); renderSystemToast('Copied.'); }
      catch { renderSystemToast('Copy failed.'); }
    }));

    if (role === 'user') {
      $actions.append($('<button type="button">Edit</button>').on('click', () => {
        $('#prompt').val(text || '').focus();
      }));
      $actions.append($('<button type="button">Retry</button>').on('click', async () => {
        await sendMessage(text || '');
      }));
    }

    if (role === 'assistant') {
      $actions.append($('<button type="button">Retry</button>').on('click', async () => {
        const chat = activeChat();
        const prevUser = [...(chat?.messages || [])].reverse().find(m => m.role === 'user');
        if (prevUser) await sendMessage(prevUser.content, { reusePrompt: true });
      }));
    }

    $wrap.append($actions);
  }

  $('#chat').append($wrap);
  $('#chat').scrollTop($('#chat')[0].scrollHeight);
  return $msg;
}

function renderSystemToast(text) {
  renderMessage('system', text, { skipActions: true });
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
  if (location.protocol === 'https:' && /^http:\/\//i.test(baseUrl)) return 'Mixed-content blocked: this page is HTTPS but Gateway URL is HTTP.';
  if (!/^https?:\/\//i.test(baseUrl)) return 'Gateway Base URL must start with http:// or https://';
  return null;
}

function renderChatList() {
  const $list = $('#chatList').empty();
  const chats = state.showArchived ? state.chats.filter(c => c.archived) : state.chats.filter(c => !c.archived);

  if (!chats.length) {
    $list.append($('<div class="muted">').text(state.showArchived ? 'No archived chats.' : 'No active chats.'));
  }

  chats.forEach(c => {
    const $item = $('<div class="chat-item">').toggleClass('active', c.id === state.activeChatId);
    const label = c.archived ? `${c.title || 'Untitled'} (archived)` : (c.title || 'Untitled');
    const $title = $('<div class="title">').text(label).on('click', () => { state.activeChatId = c.id; saveChats(); renderAll(); });

    const $actions = $('<div class="actions">');
    if (c.archived) {
      $actions.append($('<button class="tiny ghost">Restore</button>').on('click', () => { c.archived = false; state.showArchived = false; renderAll(); }));
    } else {
      $actions.append($('<button class="tiny ghost">Archive</button>').on('click', () => {
        c.archived = true;
        if (state.activeChatId === c.id) {
          const next = state.chats.find(x => !x.archived && x.id !== c.id);
          if (next) state.activeChatId = next.id;
        }
        ensureInitialChat(); renderAll();
      }));
    }
    $actions.append($('<button class="tiny ghost">Delete</button>').on('click', () => {
      state.chats = state.chats.filter(x => x.id !== c.id);
      ensureInitialChat(); renderAll();
    }));

    $item.append($title, $actions);
    $list.append($item);
  });

  $('#toggleArchivedBtn').text(state.showArchived ? 'Show active' : 'Show archived');
}

function renderActiveChat() {
  const chat = activeChat();
  if (!chat) return;
  $('#chatTitle').text(chat.title || 'New chat');
  $('#chatMeta').text(chat.archived ? 'Archived' : 'Active');
  $('#chat').empty();

  if (!chat.messages.length) {
    renderMessage('system', 'Welcome to openchat. Open Settings to connect your OpenClaw gateway.', { skipActions: true });
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
      $('<button class="tiny ghost" type="button">x</button>').on('click', () => { state.attachments.splice(i, 1); renderAttachments(); })
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
  if (err) return renderSystemToast(`Settings error: ${err}`);

  Object.entries(state.settings).forEach(([k, v]) => localStorage.setItem(`openchat.${k}`, String(v)));
  $('#settingsDialog')[0].close();
  renderSystemToast('Settings saved.');
}

async function testConnection() {
  const baseUrl = normalizeBaseUrl($('#baseUrl').val());
  const token = $('#token').val().trim();
  const err = validateSettingsForPage(baseUrl);
  if (err) return renderSystemToast(`Connection test failed: ${err}`);
  if (!baseUrl || !token) return renderSystemToast('Connection test failed: fill Gateway URL + token first.');

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ model: $('#model').val().trim() || undefined, messages: [{ role: 'user', content: 'ping' }], stream: false })
    });
    if (!res.ok) return renderSystemToast(`Connection test failed: HTTP ${res.status}`);
    renderSystemToast('Connection test passed.');
  } catch (e) {
    renderSystemToast(`Connection test failed: ${e.message}`);
  }
}

async function sendMessage(prompt, opts = {}) {
  const chat = activeChat();
  if (!chat) return;

  if (!state.settings.baseUrl || !state.settings.token) {
    renderSystemToast('Set Gateway URL + token first (Settings).');
    openSettings();
    return;
  }

  const err = validateSettingsForPage(state.settings.baseUrl);
  if (err) return renderSystemToast(`Error: ${err}`);

  if (!chat.messages.length && chat.title === 'New chat') chat.title = prompt.slice(0, 36);

  let content = prompt;
  if (state.attachments.length) {
    const names = state.attachments.map(f => f.name).join(', ');
    content += `\n\n[Attachments selected: ${names}]`;
  }

  if (!opts.reusePrompt) chat.messages.push({ role: 'user', content });
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

    const $typing = renderMessage('assistant', '…', { skipActions: true }).addClass('typing');
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
    renderSystemToast(`Error: ${e.name === 'AbortError' ? `Request timed out after ${state.settings.timeoutSeconds}s` : e.message}`);
  } finally {
    $('#sendBtn').prop('disabled', false).text('Send');
  }
}

function setupDragDrop() {
  const $target = $('#attachments');
  $(document).on('dragover', (e) => { e.preventDefault(); $target.addClass('dragover'); });
  $(document).on('dragleave', (e) => { e.preventDefault(); if (e.target === document || e.target === document.body) $target.removeClass('dragover'); });
  $(document).on('drop', (e) => {
    e.preventDefault();
    $target.removeClass('dragover');
    const files = Array.from(e.originalEvent.dataTransfer?.files || []);
    if (!files.length) return;
    state.attachments.push(...files);
    renderAttachments();
  });
}

$(function () {
  ensureInitialChat();
  renderAll();
  setupDragDrop();

  $('#openSettings').on('click', openSettings);
  $('#saveSettings').on('click', saveSettings);
  $('#testConnection').on('click', testConnection);
  $('#closeSettings').on('click', () => $('#settingsDialog')[0].close());

  $('#newChatBtn').on('click', () => {
    const c = { id: uid(), title: `Chat ${nowTitle()}`, archived: false, messages: [] };
    state.chats.unshift(c);
    state.activeChatId = c.id;
    state.showArchived = false;
    renderAll();
  });

  $('#toggleArchivedBtn').on('click', () => {
    state.showArchived = !state.showArchived;
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
