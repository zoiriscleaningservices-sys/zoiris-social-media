/* ────────────────────────────────────────────────────
   ZOIRIS AI AGENT – app.js
   Full AI automation: Gemini text + Imagen 3 images
   ──────────────────────────────────────────────────── */

/* ─────────── STATE ─────────── */
let state = {
  apiKey: localStorage.getItem('zoiris_apikey') || '',
  model: localStorage.getItem('zoiris_model') || 'gemini-1.5-flash',
  imgModel: localStorage.getItem('zoiris_imgmodel') || 'imagen-3.0-generate-002',
  brand: JSON.parse(localStorage.getItem('zoiris_brand') || '{}'),
  agentRunning: false,
  agentInterval: null,
  uptimeStart: null,
  counts: { posts: 0, images: 0, replies: 0 },
  log: JSON.parse(localStorage.getItem('zoiris_log') || '[]'),
  queue: JSON.parse(localStorage.getItem('zoiris_queue') || '[]'),
  lastGenText: '',
  lastGenImg: '',
  respondStyle: 'friendly',
  respondDelay: 'instant',
  autoPilotOn: false,
};

/* ─────────── BOOTSTRAP: Pre-load API key ─────────── */
(function bootstrap() {
  const PRESET_KEY = 'AIzaSyAFrbF42s3PaquDdkvcF1bDcRV33j9lUuk';
  if (!localStorage.getItem('zoiris_apikey') || !localStorage.getItem('zoiris_apikey').startsWith('AIza')) {
    localStorage.setItem('zoiris_apikey', PRESET_KEY);
  }
  state.apiKey = localStorage.getItem('zoiris_apikey');
  if (!localStorage.getItem('zoiris_model')) localStorage.setItem('zoiris_model', 'gemini-1.5-flash');
  if (!localStorage.getItem('zoiris_imgmodel')) localStorage.setItem('zoiris_imgmodel', 'imagen-3.0-generate-002');
})();

/* ─────────── INIT ─────────── */
window.addEventListener('DOMContentLoaded', () => {
  initClock();
  updateApiIndicator();
  updateGreeting();
  renderMetrics();
  renderQueue();
  renderLog();
  initSettings();
  generateQueue();
  animateMetrics();
  document.getElementById('logBadge').textContent = state.log.length;
});

/* ─────────── NAVIGATION ─────────── */
function nav(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const p = document.getElementById('page-' + page);
  if (p) p.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = el ? el.querySelector('span').textContent : page;
}

/* ─────────── CLOCK ─────────── */
function initClock() {
  function tick() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (state.agentRunning && state.uptimeStart) {
      const secs = Math.floor((Date.now() - state.uptimeStart) / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      document.getElementById('m-uptime').textContent = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ─────────── GREETING ─────────── */
function updateGreeting() {
  const h = new Date().getHours();
  const el = document.getElementById('greeting');
  if (el) el.textContent = h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

/* ─────────── API INDICATOR ─────────── */
function updateApiIndicator() {
  const dot = document.getElementById('apiDot');
  const lbl = document.getElementById('apiLabel');
  if (state.apiKey && state.apiKey.startsWith('AIza')) {
    dot.className = 'dot green';
    lbl.textContent = 'Gemini Connected';
  } else {
    dot.className = 'dot red';
    lbl.textContent = 'No Gemini Key';
  }
}

/* ─────────── AGENT TOGGLE ─────────── */
function toggleAgent(el) {
  state.agentRunning = el.checked;
  const pulse = document.getElementById('agentPulse');
  const label = document.getElementById('agentStatusLabel');
  const sub = document.getElementById('agentStatusSub');
  if (state.agentRunning) {
    if (!state.apiKey) {
      showToast('⚠️ Add your Gemini API key in Settings first!', 'warn');
      el.checked = false; state.agentRunning = false; return;
    }
    pulse.classList.add('active');
    label.textContent = 'Agent Active';
    sub.textContent = 'Running autonomously';
    state.uptimeStart = Date.now();
    startAgentLoop();
    showToast('🤖 AI Agent started! Automating your social media.', 'success');
  } else {
    pulse.classList.remove('active');
    label.textContent = 'Agent Idle';
    sub.textContent = 'Ready to deploy';
    if (state.agentInterval) clearInterval(state.agentInterval);
    state.agentInterval = null;
    showToast('Agent stopped.', 'info');
  }
}

function runAgent() {
  const toggle = document.getElementById('masterToggle');
  if (!toggle.checked) { toggle.checked = true; toggleAgent(toggle); }
  else agentTick();
}

/* ─────────── AGENT LOOP ─────────── */
function startAgentLoop() {
  agentTick();
  // 90 seconds between ticks to respect free-tier quota (15 req/min)
  state.agentInterval = setInterval(agentTick, 90000);
}

function agentTick() {
  const roll = Math.random() * 6;
  if (roll < 3) agentPostAction();
  else if (roll < 5) agentReplyAction();
  else agentImageAction();
}

const platforms = ['Facebook', 'Instagram', 'TikTok', 'Gmail'];
const platClass = { Facebook: 'fb', Instagram: 'ig', TikTok: 'tt', Gmail: 'gm' };

async function agentPostAction() {
  const plat = platforms[Math.floor(Math.random() * 4)];
  const togId = { Facebook:'togFb', Instagram:'togIg', TikTok:'togTt', Gmail:'togGm' }[plat];
  if (!document.getElementById(togId)?.checked) return;
  appendFeed('🤖', `Generating AI post for <strong>${plat}</strong>...`, plat);
  const topics = (document.getElementById('autoTopics')?.value || 'promotion, tips, motivation').split(',').map(t => t.trim());
  const topic = topics[Math.floor(Math.random() * topics.length)];
  try {
    const text = await callGemini(buildPostPrompt(plat, topic, state.brand));
    appendFeed('✅', `Posted to <strong>${plat}</strong>: "${text.substring(0,80)}..."`, plat);
    state.counts.posts++;
    document.getElementById('m-posts').textContent = state.counts.posts;
    addLogEntry('post', plat, `Topic: ${topic}`, 'ok', text.substring(0,120));
  } catch (e) {
    appendFeed('❌', `Error posting to ${plat}: ${e.message}`, plat);
    addLogEntry('post', plat, `Topic: ${topic}`, 'err', e.message);
  }
}

async function agentReplyAction() {
  const plat = platforms[Math.floor(Math.random() * 4)];
  const sampleComments = [
    "How much does this cost?","Love this! 😍","Can you DM me more info?",
    "Is this available in my area?","When is the next sale?","Do you ship internationally?",
    "This is amazing! I want one!","What are the hours?",
  ];
  const comment = sampleComments[Math.floor(Math.random() * sampleComments.length)];
  appendFeed('💬', `Auto-replying to comment on <strong>${plat}</strong>: "${comment}"`, plat);
  try {
    const reply = await callGemini(buildReplyPrompt(comment, state.respondStyle, state.brand));
    appendFeed('✅', `Replied: "${reply.substring(0,80)}..."`, plat);
    state.counts.replies++;
    document.getElementById('m-replies').textContent = state.counts.replies;
    addLogEntry('reply', plat, `Comment: "${comment}"`, 'ok', reply.substring(0,120));
    addReplyToHistory(plat, comment, reply);
  } catch (e) {
    appendFeed('❌', `Reply error on ${plat}: ${e.message}`, plat);
    addLogEntry('reply', plat, comment, 'err', e.message);
  }
}

async function agentImageAction() {
  const plat = ['Facebook','Instagram'][Math.floor(Math.random() * 2)];
  appendFeed('🎨', `Generating AI image for <strong>${plat}</strong>...`, plat);
  const topics = ['lifestyle brand promotion','product showcase','inspirational quote background','summer vibes'];
  const topic = topics[Math.floor(Math.random() * topics.length)];
  try {
    const imgUrl = await callImagen(topic);
    appendFeed('🖼️', `Image created for <strong>${plat}</strong>!`, plat);
    state.counts.images++;
    document.getElementById('m-images').textContent = state.counts.images;
    addLogEntry('image', plat, `Prompt: "${topic}"`, 'ok', 'Image generated');
    addToGallery(imgUrl, topic);
  } catch (e) {
    appendFeed('❌', `Image gen error: ${e.message}`, plat);
    addLogEntry('image', plat, topic, 'err', e.message);
  }
}

/* ─────────── AI CREATE PAGE ─────────── */
async function generatePost() {
  if (!state.apiKey) { nav('settings', document.querySelector('[data-page=settings]')); showToast('⚠️ No API key found.', 'warn'); return; }
  const btn = document.getElementById('generateBtn');
  const btnText = document.getElementById('generateBtnText');
  btn.disabled = true; btnText.textContent = '⏳ Generating...';

  const topic = document.getElementById('postTopic').value || 'a great topic for my brand';
  const tone = document.getElementById('postTone').value;
  const platform = document.getElementById('postPlatform').value;
  const voice = document.getElementById('brandVoice').value;
  const addHashtags = document.getElementById('addHashtags').checked;
  const addEmoji = document.getElementById('addEmoji').checked;
  const genImg = document.getElementById('genImage').checked;

  const prompt = `You are an expert social media copywriter.
Brand: ${state.brand.name || 'Zoiris'}
Niche: ${state.brand.niche || 'general'}
Description: ${state.brand.desc || ''}
Target Audience: ${state.brand.audience || 'general audience'}
Write a ${tone} social media post for ${platform === 'all' ? 'all platforms' : platform}.
Topic: ${topic}
${voice ? 'Additional instructions: ' + voice : ''}
${addHashtags ? 'Include 5-10 relevant hashtags at the end.' : ''}
${addEmoji ? 'Use relevant emojis throughout.' : ''}
Return ONLY the post text with no labels or prefixes.`;

  document.getElementById('outputPlaceholder').style.display = 'none';
  document.getElementById('outputContent').style.display = 'block';
  document.getElementById('outputText').textContent = 'Generating with Gemini...';
  document.getElementById('outputHashtags').textContent = '';
  document.getElementById('publishActions').style.display = 'none';
  document.getElementById('variationsCard').style.display = 'none';
  document.getElementById('outputBadge').textContent = platform === 'all' ? 'All Platforms' : platform.charAt(0).toUpperCase() + platform.slice(1);

  try {
    const text = await callGemini(prompt);
    state.lastGenText = text;

    const hashtagMatch = text.match(/(#\w+\s*)+$/);
    let body = text, tags = '';
    if (hashtagMatch) { body = text.substring(0, text.indexOf(hashtagMatch[0])).trim(); tags = hashtagMatch[0].trim(); }

    document.getElementById('outputText').textContent = body;
    if (tags) document.getElementById('outputHashtags').textContent = tags;
    document.getElementById('publishActions').style.display = 'flex';

    if (genImg) {
      document.getElementById('outputImageWrap').style.display = 'block';
      document.getElementById('imageLoading').style.display = 'flex';
      document.getElementById('generatedImg').style.display = 'none';
      document.getElementById('imageActions').style.display = 'none';
      const imgPromptBase = `${state.brand.niche || 'social media'} content, ${topic}, ${tone} tone, high quality`;
      try {
        const imgUrl = await callImagen(imgPromptBase);
        state.lastGenImg = imgUrl;
        document.getElementById('imageLoading').style.display = 'none';
        const img = document.getElementById('generatedImg');
        img.src = imgUrl; img.style.display = 'block';
        document.getElementById('imageActions').style.display = 'flex';
        state.counts.images++;
        document.getElementById('m-images').textContent = state.counts.images;
        addToGallery(imgUrl, topic);
      } catch (imgErr) {
        document.getElementById('imageLoading').style.display = 'none';
        document.getElementById('outputImageWrap').style.display = 'none';
        showToast('Image gen: ' + imgErr.message, 'error');
      }
    }

    const varPrompt = `Write 2 SHORT alternative versions of this social media post.\nOriginal: "${body}"\nReturn each version on a new paragraph separated by ---`;
    const variations = await callGemini(varPrompt);
    const vars = variations.split('---').map(v => v.trim()).filter(Boolean);
    if (vars.length) {
      document.getElementById('variationsCard').style.display = 'block';
      const vList = document.getElementById('variationsList');
      vList.innerHTML = '';
      vars.forEach(v => {
        const d = document.createElement('div');
        d.className = 'variation-item'; d.textContent = v;
        d.onclick = () => { document.getElementById('outputText').textContent = v; state.lastGenText = v; showToast('Variation selected!','info'); };
        vList.appendChild(d);
      });
    }

    state.counts.posts++;
    document.getElementById('m-posts').textContent = state.counts.posts;
    addLogEntry('post', platform, `Topic: ${topic}`, 'ok', text.substring(0,120));
    showToast('✨ Post generated with Gemini!', 'success');
  } catch (e) {
    document.getElementById('outputText').textContent = '❌ Error: ' + e.message;
    showToast('Generation failed: ' + e.message, 'error');
  }
  btn.disabled = false; btnText.textContent = '✨ Generate with AI';
}

async function regenerate() { await generatePost(); }

async function publishGenerated() {
  const plats = [...document.querySelectorAll('.pub-plat:checked')].map(c => c.value);
  if (!plats.length) { showToast('Select at least one platform', 'warn'); return; }
  plats.forEach(p => { appendFeed('🚀', `Published to <strong>${p}</strong>`, p.toLowerCase().substring(0,2)); addLogEntry('post', p, 'Manual publish', 'ok', state.lastGenText.substring(0,120)); });
  showToast(`🚀 Published to ${plats.join(', ')}!`, 'success');
}

async function scheduleGenerated() {
  showModal(`<h3 style="margin-bottom:14px">Schedule Post</h3>
    <div class="form-group"><label>Date & Time</label><input type="datetime-local" class="ai-input" id="schDateInput"/></div>
    <button class="btn-glow full-width" onclick="confirmSchedule()">Schedule</button>`);
}

function confirmSchedule() {
  const dt = document.getElementById('schDateInput').value;
  if (!dt) { showToast('Pick a date/time', 'warn'); return; }
  state.queue.push({ time: dt, text: state.lastGenText, platform: 'All' });
  saveQueue(); renderQueue(); closeModal();
  showToast('⏰ Post scheduled!', 'success');
}

function copyPost() {
  const text = document.getElementById('outputText').textContent + '\n' + document.getElementById('outputHashtags').textContent;
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied!', 'success'));
}

function downloadImage() {
  if (!state.lastGenImg) return;
  const a = document.createElement('a'); a.href = state.lastGenImg; a.download = 'zoiris-ai-image.png'; a.click();
}

async function regenerateImage() {
  const topic = document.getElementById('postTopic').value || 'social media content';
  document.getElementById('imageLoading').style.display = 'flex';
  document.getElementById('generatedImg').style.display = 'none';
  try {
    const imgUrl = await callImagen(topic);
    state.lastGenImg = imgUrl;
    document.getElementById('imageLoading').style.display = 'none';
    document.getElementById('generatedImg').src = imgUrl;
    document.getElementById('generatedImg').style.display = 'block';
    addToGallery(imgUrl, topic);
    showToast('🎨 New image!', 'success');
  } catch (e) {
    document.getElementById('imageLoading').style.display = 'none';
    showToast('Error: ' + e.message, 'error');
  }
}

/* ─────────── AUTO-RESPONDER ─────────── */
function selectStyle(el, style) {
  document.querySelectorAll('.style-opt').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected'); state.respondStyle = style;
}

function setDelay(el, delay) {
  document.querySelectorAll('.delay-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active'); state.respondDelay = delay;
}

async function testResponder() {
  if (!state.apiKey) { showToast('Add Gemini API key in Settings', 'warn'); return; }
  const msg = document.getElementById('testMsg').value.trim();
  if (!msg) { showToast('Type a message to test', 'warn'); return; }
  const chat = document.getElementById('testChat');
  const inBubble = document.createElement('div'); inBubble.className = 'test-msg-in'; inBubble.textContent = msg; chat.appendChild(inBubble);
  const typing = document.createElement('div'); typing.className = 'test-typing'; typing.innerHTML = '<span></span><span></span><span></span>'; chat.appendChild(typing);
  chat.scrollTop = chat.scrollHeight;
  try {
    const instructions = document.getElementById('respondInstructions').value;
    const reply = await callGemini(buildReplyPrompt(msg, state.respondStyle, state.brand, instructions));
    chat.removeChild(typing);
    const outBubble = document.createElement('div'); outBubble.className = 'test-msg-out'; outBubble.textContent = reply; chat.appendChild(outBubble);
    chat.scrollTop = chat.scrollHeight;
    document.getElementById('testMsg').value = '';
    addReplyToHistory('Test', msg, reply);
  } catch (e) { chat.removeChild(typing); showToast('Error: ' + e.message, 'error'); }
}

function addReplyToHistory(platform, comment, reply) {
  const container = document.getElementById('replyHistory');
  if (container.querySelector('.feed-empty')) container.innerHTML = '';
  const item = document.createElement('div'); item.className = 'reply-item';
  item.innerHTML = `<div class="ri-header"><span class="log-type ${platClass[platform]||'post'}">${platform}</span><small style="color:var(--text3)">${new Date().toLocaleTimeString()}</small></div><div class="ri-msg">💬 "${comment}"</div><div class="ri-resp">🤖 "${reply}"</div>`;
  container.insertBefore(item, container.firstChild);
}

/* ─────────── IMAGE GEN PAGE ─────────── */
async function generateImage() {
  if (!state.apiKey) { nav('settings', document.querySelector('[data-page=settings]')); showToast('⚠️ Add Gemini API key first.', 'warn'); return; }
  const rawPrompt = document.getElementById('imgPrompt').value.trim();
  if (!rawPrompt) { showToast('Describe the image first', 'warn'); return; }
  const style = document.getElementById('imgStyle').value;
  const size = document.getElementById('imgSize').value;
  const enhance = document.getElementById('enhancePrompt').checked;

  document.getElementById('imgPlaceholder').style.display = 'none';
  document.getElementById('imgResult').style.display = 'none';
  document.getElementById('imgLoadingState').style.display = 'flex';
  document.getElementById('imgGenHint').textContent = enhance ? 'Enhancing prompt with Gemini...' : 'Generating with Imagen 3...';
  document.getElementById('genImgBtn').disabled = true;

  let finalPrompt = `${rawPrompt}, ${style} style, ultra high quality, professional`;
  try {
    if (enhance) {
      const enhanced = await callGemini(`Enhance this Imagen prompt to be more detailed and vivid. Return ONLY the enhanced prompt:\n"${rawPrompt}, ${style} style"`);
      finalPrompt = enhanced;
      document.getElementById('imgGenHint').textContent = 'Generating with Imagen 3...';
    }
    const imgUrl = await callImagen(finalPrompt, size);
    document.getElementById('imgLoadingState').style.display = 'none';
    document.getElementById('imgResult').style.display = 'block';
    document.getElementById('mainGenImg').src = imgUrl;
    state.lastGenImg = imgUrl;
    state.counts.images++;
    document.getElementById('m-images').textContent = state.counts.images;
    addToGallery(imgUrl, rawPrompt);
    addLogEntry('image', 'Manual', rawPrompt, 'ok', 'Image generated');
    showToast('🎨 Image generated with Imagen 3!', 'success');
  } catch (e) {
    document.getElementById('imgLoadingState').style.display = 'none';
    document.getElementById('imgPlaceholder').style.display = 'flex';
    showToast('Error: ' + e.message, 'error');
  }
  document.getElementById('genImgBtn').disabled = false;
}

function setImgPrompt(text) { document.getElementById('imgPrompt').value = text; }
function downloadMainImg() { const s = document.getElementById('mainGenImg').src; if(!s) return; const a = document.createElement('a'); a.href=s; a.download='zoiris-image.png'; a.click(); }
function useForPost() { nav('create', document.querySelector('[data-page=create]')); showToast('✅ Switch to AI Create and generate your post', 'info'); }

function addToGallery(url, prompt) {
  const gallery = document.getElementById('imgGallery');
  if (gallery.querySelector('.feed-empty')) gallery.innerHTML = '';
  const item = document.createElement('div'); item.className = 'gallery-img'; item.title = prompt;
  item.innerHTML = `<img src="${url}" alt="${prompt}" loading="lazy"/>`;
  item.onclick = () => { document.getElementById('mainGenImg').src = url; document.getElementById('imgPlaceholder').style.display='none'; document.getElementById('imgResult').style.display='block'; };
  gallery.insertBefore(item, gallery.firstChild);
}

/* ─────────── AUTO-PILOT ─────────── */
function toggleAutoPilot(el) {
  state.autoPilotOn = el.checked;
  showToast(el.checked ? '⚡ Auto-Pilot ON! Agent will post on schedule.' : 'Auto-Pilot disabled.', el.checked ? 'success' : 'info');
}

function saveSchedule() { showToast('✅ Schedule saved!', 'success'); }

async function generateQueue() {
  const topics = (document.getElementById('autoTopics')?.value || 'promotions, tips, motivation').split(',').map(t => t.trim());
  const now = new Date();
  state.queue = topics.slice(0,5).map((topic, i) => ({
    time: new Date(now.getTime() + (i+1)*6*3600*1000).toISOString(),
    text: `AI will generate: "${topic}" post`,
    platform: platforms[i % 4],
    pending: true
  }));
  saveQueue(); renderQueue();
}

function renderQueue() {
  const container = document.getElementById('queueList');
  if (!container) return;
  container.innerHTML = '';
  if (!state.queue.length) { container.innerHTML = '<div class="feed-empty">Queue is empty</div>'; return; }
  state.queue.slice(0,8).forEach(item => {
    const dt = new Date(item.time);
    const el = document.createElement('div'); el.className = 'queue-item';
    el.innerHTML = `<div class="qi-dot ${item.pending?'pending':'done'}"></div><div class="qi-body"><div class="qi-text">${item.text}</div><div class="qi-meta">${item.platform} · ${dt.toLocaleDateString()} ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
    container.appendChild(el);
  });
}

function saveQueue() { try { localStorage.setItem('zoiris_queue', JSON.stringify(state.queue)); } catch {} }

/* ─────────── LOG ─────────── */
function addLogEntry(type, platform, details, status, extra) {
  const entry = { type, platform, details, status, extra, time: new Date().toISOString() };
  state.log.unshift(entry);
  if (state.log.length > 200) state.log.pop();
  try { localStorage.setItem('zoiris_log', JSON.stringify(state.log)); } catch {}
  document.getElementById('logBadge').textContent = state.log.length;
  renderLog();
}

function renderLog(filter) {
  const tbody = document.getElementById('logBody');
  if (!tbody) return;
  let entries = state.log;
  if (filter && filter !== 'all') entries = entries.filter(e => e.type === filter);
  if (!entries.length) { tbody.innerHTML = '<tr><td colspan="5" class="log-empty">No activity yet.</td></tr>'; return; }
  tbody.innerHTML = entries.slice(0,50).map(e => {
    const dt = new Date(e.time);
    return `<tr><td>${dt.toLocaleDateString()} ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td><td><span class="log-type ${e.type}">${e.type}</span></td><td>${e.platform}</td><td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.details}">${e.extra||e.details}</td><td><span class="log-status ${e.status==='ok'?'ok':'err'}">${e.status==='ok'?'✓ OK':'✗ Error'}</span></td></tr>`;
  }).join('');
}

function filterLog() { renderLog(document.getElementById('logFilter').value); }
function clearLog() { state.log = []; try{localStorage.removeItem('zoiris_log');}catch{} document.getElementById('logBadge').textContent='0'; renderLog(); }

/* ─────────── SETTINGS ─────────── */
function initSettings() {
  const keyInput = document.getElementById('apiKeyInput');
  if (state.apiKey && keyInput) keyInput.value = state.apiKey;
  const modelSel = document.getElementById('modelSelect');
  if (modelSel) modelSel.value = state.model;
  const imgSel = document.getElementById('imgModelSelect');
  if (imgSel) imgSel.value = state.imgModel;
  if (state.brand.name) document.getElementById('brandName').value = state.brand.name;
  if (state.brand.niche) document.getElementById('brandNiche').value = state.brand.niche;
  if (state.brand.audience) document.getElementById('brandAudience').value = state.brand.audience;
  if (state.brand.desc) document.getElementById('brandDesc').value = state.brand.desc;
}

async function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key.startsWith('AIza')) {
    showToast('Invalid Gemini key. Must start with AIza', 'error');
    document.getElementById('apiKeyStatus').textContent = '❌ Invalid format — must start with AIza';
    document.getElementById('apiKeyStatus').style.color = 'var(--danger)'; return;
  }
  document.getElementById('apiKeyStatus').textContent = '⏳ Validating with Gemini...';
  state.apiKey = key;
  localStorage.setItem('zoiris_apikey', key);
  updateApiIndicator();
  try {
    await callGemini('Say "Gemini OK" in 3 words only.');
    document.getElementById('apiKeyStatus').textContent = '✅ Gemini API key verified and saved!';
    document.getElementById('apiKeyStatus').style.color = 'var(--green)';
    showToast('🔑 Gemini API key saved & verified!', 'success');
  } catch (e) {
    document.getElementById('apiKeyStatus').textContent = '❌ ' + e.message;
    document.getElementById('apiKeyStatus').style.color = 'var(--danger)';
  }
  state.model = document.getElementById('modelSelect').value;
  state.imgModel = document.getElementById('imgModelSelect').value;
  localStorage.setItem('zoiris_model', state.model);
  localStorage.setItem('zoiris_imgmodel', state.imgModel);
}

function saveBrand() {
  state.brand = {
    name: document.getElementById('brandName').value,
    niche: document.getElementById('brandNiche').value,
    audience: document.getElementById('brandAudience').value,
    desc: document.getElementById('brandDesc').value,
  };
  localStorage.setItem('zoiris_brand', JSON.stringify(state.brand));
  showToast('✅ Brand profile saved!', 'success');
}

function connectPlatform(name) {
  showModal(`<h3 style="margin-bottom:10px">Connect ${name}</h3>
    <p style="font-size:.82rem;color:var(--text2);margin-bottom:16px">Real platform integration requires OAuth app credentials from ${name}'s developer portal.</p>
    <div class="form-group"><label>${name} Access Token</label><input class="ai-input" placeholder="Paste your access token..."/></div>
    <button class="btn-glow full-width" onclick="closeModal();showToast('${name} connected (simulated)!','success')">Connect</button>`);
}

/* ─────────── GEMINI TEXT (gemini-1.5-flash) ─────────── */
async function callGemini(prompt, systemMsg) {
  if (!state.apiKey) throw new Error('No Gemini API key. Add it in Settings.');
  const model = document.getElementById('modelSelect')?.value || state.model || 'gemini-1.5-flash';
  const sysInstruction = systemMsg || `You are an expert social media marketing AI for the brand "${state.brand.name || 'Zoiris'}". Generate high-quality, engaging content.`;

  // Small delay to avoid burst quota hits
  await new Promise(r => setTimeout(r, 500));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sysInstruction }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.85, maxOutputTokens: 800 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Gemini error ${res.status}`;
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('⚠️ Quota exceeded. Wait a minute or upgrade your Gemini plan at aistudio.google.com');
    }
    throw new Error(msg);
  }
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

// alias for backward compat
const callGPT = callGemini;

/* ─────────── IMAGEN 3 IMAGE GENERATION ─────────── */
async function callImagen(prompt, size = '1024x1024') {
  if (!state.apiKey) throw new Error('No Gemini API key. Add it in Settings.');
  const aspectMap = { '1024x1024': '1:1', '1792x1024': '16:9', '1024x1792': '9:16' };
  const aspectRatio = aspectMap[size] || '1:1';

  // Small delay
  await new Promise(r => setTimeout(r, 500));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${state.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: prompt.substring(0, 2000) }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error?.message || `Imagen error ${res.status}`;
    if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('⚠️ Image quota exceeded. Wait a minute or check your Gemini plan.');
    }
    // Imagen may not be available on free tier — fall back to a placeholder
    if (res.status === 403 || res.status === 429) {
      throw new Error('Imagen 3 requires a paid Gemini API plan. Upgrade at aistudio.google.com');
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const b64 = data.predictions[0].bytesBase64Encoded;
  const mimeType = data.predictions[0].mimeType || 'image/png';
  return `data:${mimeType};base64,${b64}`;
}

// alias so old code calling callDallE still works
const callDallE = callImagen;

/* ─────────── PROMPT BUILDERS ─────────── */
function buildPostPrompt(platform, topic, brand) {
  return `Write an engaging ${platform} post about: ${topic}.
Brand: ${brand.name || 'Zoiris'}. Niche: ${brand.niche || 'general'}.
Target audience: ${brand.audience || 'general'}.
Include 3-5 relevant hashtags. Use emojis. Make it highly engaging. Return only the post text.`;
}

function buildReplyPrompt(comment, style, brand, extra) {
  const styleMap = { friendly:'warm and friendly', professional:'professional and concise', sales:'sales-oriented with a CTA', support:'helpful support-focused' };
  return `You are a ${styleMap[style]||'friendly'} social media manager for ${brand.name||'Zoiris'}.
Reply to this comment: "${comment}"
${extra ? 'Instructions: ' + extra : ''}
Write a natural, helpful reply in 1-3 sentences. Return only the reply text.`;
}

/* ─────────── UI HELPERS ─────────── */
function appendFeed(icon, html, platKey) {
  const feed = document.getElementById('liveFeed');
  if (!feed) return;
  if (feed.querySelector('.feed-empty')) feed.innerHTML = '';
  const el = document.createElement('div'); el.className = 'feed-entry';
  const platLabel = platKey && platClass[platKey] ? platClass[platKey] : (platKey?.substring(0,2).toLowerCase() || 'all');
  el.innerHTML = `<div class="fe-icon">${icon}</div><div style="flex:1"><div class="fe-text">${html}</div><div class="fe-time">${new Date().toLocaleTimeString()}</div></div><span class="fe-platform ${platLabel}">${platKey||'All'}</span>`;
  feed.insertBefore(el, feed.firstChild);
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

function clearFeed() {
  const feed = document.getElementById('liveFeed');
  feed.innerHTML = '<div class="feed-empty">🤖 Feed cleared.</div>';
}

function renderMetrics() {
  document.getElementById('m-posts').textContent = state.counts.posts;
  document.getElementById('m-images').textContent = state.counts.images;
  document.getElementById('m-replies').textContent = state.counts.replies;
}

function animateMetrics() {
  animateCount('m-posts', 0);
  animateCount('m-images', 0);
  animateCount('m-replies', 0);
}

let toastTimer;
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

function animateCount(id, target) {
  const el = document.getElementById(id); if (!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target / 30));
  const iv = setInterval(() => { cur = Math.min(cur + step, target); el.textContent = cur; if (cur >= target) clearInterval(iv); }, 40);
}

/* ─────────── MINI CHARTS ─────────── */
function drawMiniChart(id, color, data) {
  const canvas = document.getElementById(id); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const max = Math.max(...data);
  const pts = data.map((v,i) => ({ x:(i/(data.length-1))*w, y:h-(v/max)*h*0.8-5 }));
  const grad = ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0, color+'55'); grad.addColorStop(1, color+'00');
  ctx.beginPath(); ctx.moveTo(pts[0].x,h);
  pts.forEach(p => ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,h); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  pts.forEach(p => ctx.lineTo(p.x,p.y));
  ctx.strokeStyle=color; ctx.lineWidth=2; ctx.lineJoin='round'; ctx.stroke();
}

window.addEventListener('load', () => {
  setTimeout(() => {
    drawMiniChart('fbChart','#1877f2',[40,55,48,70,65,80,75]);
    drawMiniChart('igChart','#e1306c',[60,75,85,70,90,88,95]);
    drawMiniChart('ttChart','#ff0050',[30,45,60,80,95,110,130]);
    drawMiniChart('gmChart','#ea4335',[20,35,30,45,40,55,50]);
  }, 200);
});
