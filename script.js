const state = {
  messages: [],
  settings: {
    baseUrl: localStorage.getItem('openchat.baseUrl') || '',
    token: localStorage.getItem('openchat.token') || '',
    model: localStorage.getItem('openchat.model') || ''
  }
};

function renderMessage(role, text) {
  const $msg = $('<div class="msg">').addClass(role).text(text);
  $('#chat').append($msg);
  $('#chat').scrollTop($('#chat')[0].scrollHeight);
}

function openSettings() {
  $('#baseUrl').val(state.settings.baseUrl);
  $('#token').val(state.settings.token);
  $('#model').val(state.settings.model);
  $('#settingsDialog')[0].showModal();
}

function saveSettings() {
  state.settings.baseUrl = $('#baseUrl').val().trim().replace(/\/$/, '');
  state.settings.token = $('#token').val().trim();
  state.settings.model = $('#model').val().trim();
  localStorage.setItem('openchat.baseUrl', state.settings.baseUrl);
  localStorage.setItem('openchat.token', state.settings.token);
  localStorage.setItem('openchat.model', state.settings.model);
  $('#settingsDialog')[0].close();
  renderMessage('system', 'Settings saved.');
}

async function sendMessage(prompt) {
  if (!state.settings.baseUrl || !state.settings.token) {
    renderMessage('system', 'Set Gateway URL + token first (Settings).');
    openSettings();
    return;
  }

  renderMessage('user', prompt);
  state.messages.push({ role: 'user', content: prompt });

  const payload = {
    model: state.settings.model || undefined,
    messages: state.messages.map(m => ({ role: m.role, content: m.content })),
    stream: false
  };

  try {
    const res = await fetch(`${state.settings.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.settings.token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t}`);
    }

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '(No response)';
    state.messages.push({ role: 'assistant', content: reply });
    renderMessage('assistant', reply);
  } catch (err) {
    renderMessage('system', `Error: ${err.message}`);
  }
}

$(function () {
  $('#openSettings').on('click', openSettings);
  $('#saveSettings').on('click', saveSettings);
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
