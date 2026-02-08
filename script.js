const state = {
  messages: [],
  settings: {
    baseUrl: localStorage.getItem('openchat.baseUrl') || '',
    token: localStorage.getItem('openchat.token') || '',
    model: localStorage.getItem('openchat.model') || '',
    timeoutSeconds: Number(localStorage.getItem('openchat.timeoutSeconds') || 120),
    streamReplies: localStorage.getItem('openchat.streamReplies') === 'true'
  }
};

function renderMessage(role, text) {
  const $msg = $('<div class="msg">').addClass(role).text(text);
  $('#chat').append($msg);
  $('#chat').scrollTop($('#chat')[0].scrollHeight);
  return $msg;
}

function normalizeBaseUrl(input) {
  let url = (input || '').trim().replace(/\/$/, '');
  url = url.replace(/\/index\.html?$/i, '');
  url = url.replace(/\/v1\/chat\/completions$/i, '');
  return url;
}

function validateSettingsForPage(baseUrl) {
  if (location.protocol === 'https:' && /^http:\/\//i.test(baseUrl)) {
    return 'Mixed-content blocked: this page is HTTPS but your Gateway URL is HTTP. Use a local HTTP page, or expose Gateway via HTTPS.';
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    return 'Gateway Base URL must start with http:// or https://';
  }
  return null;
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
    } else {
      bucket = candidate;
    }
  }
  if (bucket) renderMessage('assistant', bucket);
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

  const validationError = validateSettingsForPage(state.settings.baseUrl);
  if (validationError) {
    renderMessage('system', `Settings error: ${validationError}`);
    return;
  }

  localStorage.setItem('openchat.baseUrl', state.settings.baseUrl);
  localStorage.setItem('openchat.token', state.settings.token);
  localStorage.setItem('openchat.model', state.settings.model);
  localStorage.setItem('openchat.timeoutSeconds', String(state.settings.timeoutSeconds));
  localStorage.setItem('openchat.streamReplies', String(state.settings.streamReplies));
  $('#settingsDialog')[0].close();
  renderMessage('system', 'Settings saved.');
}

async function testConnection() {
  const baseUrl = normalizeBaseUrl($('#baseUrl').val());
  const token = $('#token').val().trim();
  const validationError = validateSettingsForPage(baseUrl);
  if (validationError) return renderMessage('system', `Connection test failed: ${validationError}`);
  if (!baseUrl || !token) return renderMessage('system', 'Connection test failed: fill Gateway URL and token first.');

  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ model: $('#model').val().trim() || undefined, messages: [{ role: 'user', content: 'ping' }], stream: false })
    });
    if (!res.ok) {
      const txt = await res.text();
      return renderMessage('system', `Connection test failed: HTTP ${res.status}. ${txt.slice(0, 180)}`);
    }
    renderMessage('system', 'Connection test passed.');
  } catch (err) {
    renderMessage('system', `Connection test failed: ${err.message}`);
  }
}

async function sendMessage(prompt) {
  if (!state.settings.baseUrl || !state.settings.token) {
    renderMessage('system', 'Set Gateway URL + token first (Settings).');
    openSettings();
    return;
  }

  const validationError = validateSettingsForPage(state.settings.baseUrl);
  if (validationError) return renderMessage('system', `Error: ${validationError}`);

  renderMessage('user', prompt);
  state.messages.push({ role: 'user', content: prompt });
  $('#sendBtn').prop('disabled', true).text('Sending...');

  const payload = {
    model: state.settings.model || undefined,
    messages: state.messages.map(m => ({ role: m.role, content: m.content })),
    stream: !!state.settings.streamReplies
  };

  const timeoutMs = Math.max(10000, (state.settings.timeoutSeconds || 120) * 1000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);

    const res = await fetch(`${state.settings.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.settings.token}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 240)}`);
    }

    if (!state.settings.streamReplies) {
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content || '(No response)';
      state.messages.push({ role: 'assistant', content: reply });
      renderAssistantChunked(reply);
      clearTimeout(timer);
      return;
    }

    const typing = renderMessage('assistant', '…').addClass('typing');
    let accumulated = '';

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
            accumulated += delta;
            typing.removeClass('typing').text(accumulated);
            $('#chat').scrollTop($('#chat')[0].scrollHeight);
          }
        } catch (_) {
          // ignore partial JSON frames
        }
      }
    }

    clearTimeout(timer);
    const finalReply = accumulated || '(No response)';
    typing.removeClass('typing').text(finalReply);
    state.messages.push({ role: 'assistant', content: finalReply });
  } catch (lastErr) {
    if (lastErr?.name === 'AbortError') {
      renderMessage('system', `Error: Request timed out after ${state.settings.timeoutSeconds}s`);
    } else if (/Failed to fetch|NetworkError|network connection was lost/i.test(lastErr?.message || '')) {
      renderMessage('system', 'Error: Network/CORS issue. If page is HTTPS, Gateway URL must also be HTTPS (or run openchat locally over HTTP).');
    } else {
      renderMessage('system', `Error: ${lastErr?.message || 'Unknown error'}`);
    }
  } finally {
    $('#sendBtn').prop('disabled', false).text('Send');
  }
}

$(function () {
  $('#openSettings').on('click', openSettings);
  $('#saveSettings').on('click', saveSettings);
  $('#testConnection').on('click', testConnection);
  $('#closeSettings').on('click', () => $('#settingsDialog')[0].close());

  $('#composer').on('submit', async (e) => {
    e.preventDefault();
    const prompt = $('#prompt').val().trim();
    if (!prompt) return;
    $('#prompt').val('');
    await sendMessage(prompt);
  });

  renderMessage('system', 'Welcome to openchat. Open Settings to connect your OpenClaw gateway.');
});
