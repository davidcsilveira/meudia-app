/* ============================================================
   MEUDIA — auth.js
   Sistema de Autenticação, Cadastro e Perfil
   ============================================================ */

'use strict';

// ===== DEVICE FINGERPRINT =====
// Gera um ID único do dispositivo combinando várias informações
// (equivalente ao IMEI/MAC no ambiente web — browsers não expõem esses dados por segurança)
async function getDeviceFingerprint() {
  const nav = window.navigator;
  const parts = [
    nav.userAgent,
    nav.language,
    nav.hardwareConcurrency || '',
    nav.deviceMemory || '',
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    nav.platform || '',
    nav.vendor || ''
  ];

  // Canvas fingerprint
  try {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('MeuDia🔐', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('MeuDia🔐', 4, 17);
    parts.push(c.toDataURL().slice(-50));
  } catch(e) {}

  const raw = parts.join('|');
  // Hash SHA-256 like using SubtleCrypto
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
  } catch(e) {
    // Fallback: simple hash
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(32,'0');
  }
}

// ===== AUTH STORAGE =====
const AUTH_KEY    = 'meudia_auth_users';
const SESSION_KEY = 'meudia_session';
const DEVICE_KEY  = 'meudia_device_id';

function getUsers()   { return JSON.parse(localStorage.getItem(AUTH_KEY) || '[]'); }
function saveUsers(u) { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); }

function getSession()      { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
function setSession(user)  { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function clearSession()    { sessionStorage.removeItem(SESSION_KEY); }

function getSavedDeviceId()     { return localStorage.getItem(DEVICE_KEY); }
function saveDeviceId(id)       { localStorage.setItem(DEVICE_KEY, id); }

// ===== GENERATE PASSWORD =====
function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pwd = '';
  // Garantir pelo menos um de cada tipo
  pwd += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)];
  pwd += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random()*23)];
  pwd += '23456789'[Math.floor(Math.random()*8)];
  pwd += '!@#$'[Math.floor(Math.random()*4)];
  for (let i = pwd.length; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('');
}

// ===== HASH PASSWORD (SHA-256) =====
async function hashPassword(password) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password + 'meudia_salt_2025'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e) {
    // Fallback simple hash
    let hash = 5381;
    for (let i = 0; i < password.length; i++) {
      hash = ((hash << 5) + hash) + password.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

// ===== FORMAT PHONE =====
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2)  return `(${digits}`;
  if (digits.length <= 6)  return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

// ===== SIMULATE EMAIL SEND =====
// Em produção isso seria uma chamada a um backend/API
function simulateSendEmail(to, nome, password) {
  console.log(`[EMAIL SIMULADO] Para: ${to} | Nome: ${nome} | Senha: ${password}`);
  // Armazena email enviado para mostrar na UI
  localStorage.setItem('meudia_last_email', JSON.stringify({ to, nome, password, ts: Date.now() }));
}

// ===== AUTH SCREENS HTML =====
function renderAuthScreen(screen) {
  const container = document.getElementById('auth-container');
  if (!container) return;

  const screens = {
    login: renderLoginScreen,
    register: renderRegisterScreen,
    firstAccess: renderFirstAccessScreen,
    forgotPwd: renderForgotPwdScreen
  };

  container.innerHTML = (screens[screen] || renderLoginScreen)();
  applyPhoneMask();
}

function renderLoginScreen() {
  return `
    <div class="auth-card">
      <div class="auth-logo">MD<span class="auth-dot">.</span></div>
      <h2 class="auth-title">Bem-vindo de volta</h2>
      <p class="auth-sub">Entre na sua conta</p>

      <div class="auth-form">
        <div class="auth-field">
          <label>E-mail</label>
          <input type="email" id="login-email" class="auth-input" placeholder="seu@email.com" autocomplete="email" />
        </div>
        <div class="auth-field">
          <label>Senha</label>
          <div class="pwd-wrap">
            <input type="password" id="login-pwd" class="auth-input" placeholder="Sua senha" autocomplete="current-password" />
            <button class="pwd-eye" onclick="togglePwd('login-pwd')">👁️</button>
          </div>
        </div>

        <div id="login-error" class="auth-error" style="display:none"></div>

        <button class="auth-btn-primary" onclick="doLogin()">Entrar</button>

        <button class="auth-link" onclick="renderAuthScreen('forgotPwd')">Esqueci minha senha</button>
        <div class="auth-divider"><span>ou</span></div>
        <button class="auth-btn-secondary" onclick="renderAuthScreen('register')">Criar nova conta</button>
      </div>

      <div class="auth-device-info" id="auth-device-info">🔒 Dispositivo verificado</div>
    </div>`;
}

function renderRegisterScreen() {
  return `
    <div class="auth-card">
      <button class="auth-back" onclick="renderAuthScreen('login')">← Voltar</button>
      <div class="auth-logo">MD<span class="auth-dot">.</span></div>
      <h2 class="auth-title">Criar Conta</h2>
      <p class="auth-sub">Preencha seus dados para começar</p>

      <div class="auth-form">
        <div class="auth-row">
          <div class="auth-field">
            <label>Nome <span class="req">*</span></label>
            <input type="text" id="reg-nome" class="auth-input" placeholder="Nome" autocomplete="given-name" />
          </div>
          <div class="auth-field">
            <label>Sobrenome <span class="req">*</span></label>
            <input type="text" id="reg-sobrenome" class="auth-input" placeholder="Sobrenome" autocomplete="family-name" />
          </div>
        </div>

        <div class="auth-field">
          <label>E-mail <span class="req">*</span></label>
          <input type="email" id="reg-email" class="auth-input" placeholder="seu@email.com" autocomplete="email" />
        </div>

        <div class="auth-field">
          <label>Celular / WhatsApp <span class="req">*</span></label>
          <input type="tel" id="reg-celular" class="auth-input phone-mask" placeholder="(00) 00000-0000" autocomplete="tel" maxlength="16" />
        </div>

        <div class="auth-field">
          <label>Data de Nascimento</label>
          <input type="date" id="reg-nascimento" class="auth-input" />
        </div>

        <div id="reg-error" class="auth-error" style="display:none"></div>

        <div class="auth-notice">
          📧 Uma senha temporária será enviada para seu e-mail no primeiro acesso.
        </div>

        <button class="auth-btn-primary" onclick="doRegister()">Criar Conta</button>
        <button class="auth-btn-secondary" onclick="renderAuthScreen('login')">Já tenho conta</button>
      </div>
    </div>`;
}

function renderFirstAccessScreen(email, password) {
  return `
    <div class="auth-card">
      <div class="auth-logo success">✅</div>
      <h2 class="auth-title">Conta criada!</h2>
      <p class="auth-sub">Sua senha temporária foi gerada</p>

      <div class="first-access-box">
        <div class="fa-label">E-mail cadastrado</div>
        <div class="fa-value">${email || ''}</div>
        <div class="fa-label" style="margin-top:0.8rem">Senha temporária</div>
        <div class="fa-pwd" id="fa-pwd-display">${password || '••••••••••'}</div>
        <button class="copy-pwd-btn" onclick="copyPassword('${password}')">📋 Copiar senha</button>
        <div class="fa-notice">⚠️ Esta senha foi "enviada" para seu e-mail. Anote-a agora e altere após o login.</div>
      </div>

      <button class="auth-btn-primary" onclick="renderAuthScreen('login')" style="margin-top:1rem">Ir para o Login</button>
    </div>`;
}

function renderForgotPwdScreen() {
  return `
    <div class="auth-card">
      <button class="auth-back" onclick="renderAuthScreen('login')">← Voltar</button>
      <div class="auth-logo">🔑</div>
      <h2 class="auth-title">Recuperar Senha</h2>
      <p class="auth-sub">Digite seu e-mail para receber uma nova senha</p>

      <div class="auth-form">
        <div class="auth-field">
          <label>E-mail cadastrado</label>
          <input type="email" id="forgot-email" class="auth-input" placeholder="seu@email.com" />
        </div>

        <div id="forgot-error" class="auth-error" style="display:none"></div>
        <div id="forgot-success" class="auth-success" style="display:none"></div>

        <button class="auth-btn-primary" onclick="doForgotPassword()">Enviar nova senha</button>
        <button class="auth-btn-secondary" onclick="renderAuthScreen('login')">Voltar ao login</button>
      </div>
    </div>`;
}

// ===== PHONE MASK =====
function applyPhoneMask() {
  document.querySelectorAll('.phone-mask').forEach(el => {
    el.addEventListener('input', function() {
      const cursorPos = this.selectionStart;
      this.value = formatPhone(this.value);
    });
  });
}

// ===== TOGGLE PASSWORD =====
function togglePwd(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
}

// ===== COPY PASSWORD =====
function copyPassword(pwd) {
  navigator.clipboard?.writeText(pwd).then(() => {
    if (typeof showToast === 'function') showToast('📋 Senha copiada!');
    else alert('Senha copiada: ' + pwd);
  }).catch(() => {
    // Fallback
    const el = document.createElement('input');
    el.value = pwd;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    if (typeof showToast === 'function') showToast('📋 Senha copiada!');
  });
}

// ===== VALIDATE EMAIL =====
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ===== VALIDATE PHONE =====
function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

// ===== SHOW AUTH ERROR =====
function showAuthError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { if(el) el.style.display = 'none'; }, 4000);
}

// ===== REGISTER =====
async function doRegister() {
  const nome      = document.getElementById('reg-nome')?.value.trim();
  const sobrenome = document.getElementById('reg-sobrenome')?.value.trim();
  const email     = document.getElementById('reg-email')?.value.trim().toLowerCase();
  const celular   = document.getElementById('reg-celular')?.value.trim();
  const nascimento = document.getElementById('reg-nascimento')?.value;

  // Validations
  if (!nome)      return showAuthError('reg-error', '⚠️ Nome é obrigatório');
  if (!sobrenome) return showAuthError('reg-error', '⚠️ Sobrenome é obrigatório');
  if (!email || !isValidEmail(email)) return showAuthError('reg-error', '⚠️ E-mail inválido');
  if (!celular || !isValidPhone(celular)) return showAuthError('reg-error', '⚠️ Celular inválido — use o formato (00) 00000-0000');

  const users = getUsers();
  if (users.find(u => u.email === email)) {
    return showAuthError('reg-error', '⚠️ Este e-mail já está cadastrado');
  }

  // Generate temp password & device fingerprint
  const tempPwd   = generatePassword();
  const pwdHash   = await hashPassword(tempPwd);
  const deviceId  = await getDeviceFingerprint();

  const newUser = {
    id:          Date.now(),
    nome,
    sobrenome,
    email,
    celular,
    nascimento:  nascimento || null,
    pwdHash,
    firstAccess: true,
    mustChangePwd: true,
    foto:        null,
    devices:     [deviceId],  // list of authorized device fingerprints
    createdAt:   new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  saveDeviceId(deviceId);

  // Simulate email sending
  simulateSendEmail(email, nome, tempPwd);

  // Show first access screen with password
  renderAuthScreen('firstAccess');
  // Inject data into already-rendered screen
  setTimeout(() => {
    const container = document.getElementById('auth-container');
    if (container) {
      container.innerHTML = renderFirstAccessScreen(email, tempPwd);
    }
  }, 10);
}

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('login-email')?.value.trim().toLowerCase();
  const pwd   = document.getElementById('login-pwd')?.value;

  if (!email || !isValidEmail(email)) return showAuthError('login-error', '⚠️ E-mail inválido');
  if (!pwd) return showAuthError('login-error', '⚠️ Digite sua senha');

  const users = getUsers();
  const user  = users.find(u => u.email === email);

  if (!user) return showAuthError('login-error', '❌ E-mail não cadastrado');

  const pwdHash = await hashPassword(pwd);
  if (pwdHash !== user.pwdHash) return showAuthError('login-error', '❌ Senha incorreta');

  // Device check
  const deviceId = await getDeviceFingerprint();
  saveDeviceId(deviceId);

  if (!user.devices) user.devices = [];

  // If device not authorized, add it (first login registers the device)
  if (!user.devices.includes(deviceId)) {
    if (user.devices.length >= 3) {
      return showAuthError('login-error', '🔒 Limite de dispositivos atingido (máx. 3). Remova um dispositivo no perfil.');
    }
    user.devices.push(deviceId);
    saveUsers(users);
  }

  // Mark first access done
  user.firstAccess = false;
  saveUsers(users);

  // Create session
  const session = {
    userId:   user.id,
    email:    user.email,
    nome:     user.nome,
    sobrenome:user.sobrenome,
    foto:     user.foto,
    deviceId,
    loggedAt: Date.now()
  };
  setSession(session);

  // If must change password
  if (user.mustChangePwd) {
    showChangePwdModal(user);
    return;
  }

  launchApp(session);
}

// ===== FORGOT PASSWORD =====
async function doForgotPassword() {
  const email = document.getElementById('forgot-email')?.value.trim().toLowerCase();
  if (!email || !isValidEmail(email)) return showAuthError('forgot-error', '⚠️ E-mail inválido');

  const users = getUsers();
  const user  = users.find(u => u.email === email);

  if (!user) return showAuthError('forgot-error', '❌ E-mail não encontrado');

  const newPwd  = generatePassword();
  const pwdHash = await hashPassword(newPwd);
  user.pwdHash      = pwdHash;
  user.mustChangePwd = true;
  saveUsers(users);

  simulateSendEmail(email, user.nome, newPwd);

  const successEl = document.getElementById('forgot-success');
  if (successEl) {
    successEl.style.display = 'block';
    successEl.innerHTML = `✅ Nova senha gerada!<br><br>
      <strong>Para fins de demonstração:</strong><br>
      <code style="background:#e8f5e9;padding:4px 8px;border-radius:6px;font-size:1rem">${newPwd}</code><br>
      <small style="opacity:0.7">(Em produção isso chegaria no e-mail)</small>`;
  }
}

// ===== CHANGE PASSWORD MODAL =====
function showChangePwdModal(user) {
  const overlay = document.createElement('div');
  overlay.id = 'change-pwd-overlay';
  overlay.className = 'auth-overlay';
  overlay.innerHTML = `
    <div class="auth-card" style="max-width:400px;margin:auto">
      <div class="auth-logo">🔐</div>
      <h2 class="auth-title">Trocar Senha</h2>
      <p class="auth-sub">Você está usando uma senha temporária. Defina uma senha nova para continuar.</p>
      <div class="auth-form">
        <div class="auth-field">
          <label>Nova Senha <span class="req">*</span></label>
          <div class="pwd-wrap">
            <input type="password" id="new-pwd" class="auth-input" placeholder="Mínimo 8 caracteres" />
            <button class="pwd-eye" onclick="togglePwd('new-pwd')">👁️</button>
          </div>
          <div class="pwd-strength" id="pwd-strength"></div>
        </div>
        <div class="auth-field">
          <label>Confirmar Senha <span class="req">*</span></label>
          <div class="pwd-wrap">
            <input type="password" id="confirm-pwd" class="auth-input" placeholder="Repita a senha" />
            <button class="pwd-eye" onclick="togglePwd('confirm-pwd')">👁️</button>
          </div>
        </div>
        <div id="change-pwd-error" class="auth-error" style="display:none"></div>
        <button class="auth-btn-primary" onclick="doChangePwd(${user.id})">Salvar Nova Senha</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Live password strength
  document.getElementById('new-pwd')?.addEventListener('input', function() {
    renderPwdStrength(this.value);
  });
}

function renderPwdStrength(pwd) {
  const el = document.getElementById('pwd-strength');
  if (!el) return;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;

  const levels = [
    { label: 'Muito fraca', color: '#e74c3c' },
    { label: 'Fraca',       color: '#e67e22' },
    { label: 'Média',       color: '#f39c12' },
    { label: 'Forte',       color: '#27ae60' },
    { label: 'Muito forte', color: '#1e8449' }
  ];
  const lv = levels[score] || levels[0];
  el.innerHTML = `
    <div style="display:flex;gap:3px;margin:4px 0 2px">
      ${[0,1,2,3].map(i => `<div style="flex:1;height:4px;border-radius:4px;background:${i<score?lv.color:'#e0e0e0'}"></div>`).join('')}
    </div>
    <span style="font-size:0.7rem;color:${lv.color}">${pwd.length > 0 ? lv.label : ''}</span>`;
}

async function doChangePwd(userId) {
  const newPwd     = document.getElementById('new-pwd')?.value;
  const confirmPwd = document.getElementById('confirm-pwd')?.value;

  if (!newPwd || newPwd.length < 8) return showAuthError('change-pwd-error', '⚠️ Senha deve ter mínimo 8 caracteres');
  if (newPwd !== confirmPwd)         return showAuthError('change-pwd-error', '⚠️ As senhas não coincidem');

  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return;

  user.pwdHash      = await hashPassword(newPwd);
  user.mustChangePwd = false;
  saveUsers(users);

  document.getElementById('change-pwd-overlay')?.remove();

  const session = getSession();
  if (session) launchApp(session);
}

// ===== LAUNCH APP =====
function launchApp(session) {
  const authWrap = document.getElementById('auth-wrapper');
  if (authWrap) authWrap.style.display = 'none';

  const app = document.getElementById('app');
  if (app) app.style.display = 'flex';

  // Update top bar with user name + avatar
  updateTopBarUser(session);

  if (typeof init === 'function') init();
}

function updateTopBarUser(session) {
  const tbRight = document.getElementById('top-bar-right');
  if (!tbRight) return;

  const avatarEl = document.createElement('button');
  avatarEl.className = 'user-avatar-btn';
  avatarEl.onclick   = () => openProfileModal();
  avatarEl.title     = 'Meu Perfil';

  if (session.foto) {
    avatarEl.innerHTML = `<img src="${session.foto}" class="avatar-img" />`;
  } else {
    const initials = ((session.nome?.[0] || '') + (session.sobrenome?.[0] || '')).toUpperCase();
    avatarEl.innerHTML = `<div class="avatar-initials">${initials}</div>`;
  }

  tbRight.insertBefore(avatarEl, tbRight.firstChild);
}

// ===== PROFILE MODAL =====
function openProfileModal() {
  const session = getSession();
  if (!session) return;

  const users = getUsers();
  const user  = users.find(u => u.id === session.userId);
  if (!user) return;

  // Build devices list
  const deviceId   = getSavedDeviceId();
  const deviceList = (user.devices || []).map((d, i) => `
    <div class="device-item ${d === deviceId ? 'current' : ''}">
      <span>📱 Dispositivo ${i+1} ${d === deviceId ? '<span class="current-badge">Atual</span>' : ''}</span>
      ${d !== deviceId ? `<button class="icon-btn-sm" onclick="removeDevice(${user.id},'${d}')">🗑️</button>` : ''}
    </div>`).join('');

  const modal = document.createElement('div');
  modal.id = 'profile-modal-overlay';
  modal.className = 'modal-overlay open';
  modal.onclick = e => { if (e.target === modal) closeProfileModal(); };

  modal.innerHTML = `
    <div class="modal-box profile-modal-box">
      <div class="modal-handle"></div>
      <div class="profile-header">
        <div class="profile-avatar-wrap" onclick="triggerProfilePhoto()">
          ${user.foto
            ? `<img src="${user.foto}" class="profile-avatar-img" id="profile-avatar-img" />`
            : `<div class="profile-avatar-placeholder" id="profile-avatar-img">${((user.nome?.[0]||'')+(user.sobrenome?.[0]||'')).toUpperCase()}</div>`
          }
          <div class="profile-avatar-edit">📷</div>
        </div>
        <input type="file" id="profile-photo-input" accept="image/*" capture="user" style="display:none" onchange="handleProfilePhoto(event,${user.id})" />
        <div class="profile-name">${user.nome} ${user.sobrenome}</div>
        <div class="profile-email">${user.email}</div>
      </div>

      <div class="profile-tabs">
        <button class="profile-tab active" onclick="switchProfileTab(this,'dados')">👤 Dados</button>
        <button class="profile-tab" onclick="switchProfileTab(this,'seguranca')">🔐 Segurança</button>
        <button class="profile-tab" onclick="switchProfileTab(this,'dispositivos')">📱 Dispositivos</button>
      </div>

      <!-- DADOS -->
      <div class="profile-section active" id="profile-dados">
        <div class="auth-field">
          <label>Nome</label>
          <input type="text" id="p-nome" class="auth-input" value="${user.nome}" />
        </div>
        <div class="auth-field">
          <label>Sobrenome</label>
          <input type="text" id="p-sobrenome" class="auth-input" value="${user.sobrenome}" />
        </div>
        <div class="auth-field">
          <label>E-mail</label>
          <input type="email" id="p-email" class="auth-input" value="${user.email}" />
        </div>
        <div class="auth-field">
          <label>Celular / WhatsApp</label>
          <input type="tel" id="p-celular" class="auth-input phone-mask" value="${user.celular}" maxlength="16" />
        </div>
        <div class="auth-field">
          <label>Data de Nascimento</label>
          <input type="date" id="p-nascimento" class="auth-input" value="${user.nascimento || ''}" />
        </div>
        <button class="auth-btn-primary" style="margin-top:0.8rem" onclick="saveProfile(${user.id})">💾 Salvar Alterações</button>
      </div>

      <!-- SEGURANÇA -->
      <div class="profile-section" id="profile-seguranca">
        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.8rem">
          Defina uma nova senha para sua conta.
        </p>
        <div class="auth-field">
          <label>Senha Atual</label>
          <div class="pwd-wrap">
            <input type="password" id="p-pwd-atual" class="auth-input" placeholder="Senha atual" />
            <button class="pwd-eye" onclick="togglePwd('p-pwd-atual')">👁️</button>
          </div>
        </div>
        <div class="auth-field">
          <label>Nova Senha</label>
          <div class="pwd-wrap">
            <input type="password" id="p-pwd-nova" class="auth-input" placeholder="Mínimo 8 caracteres" />
            <button class="pwd-eye" onclick="togglePwd('p-pwd-nova')">👁️</button>
          </div>
          <div class="pwd-strength" id="p-pwd-strength"></div>
        </div>
        <div class="auth-field">
          <label>Confirmar Nova Senha</label>
          <div class="pwd-wrap">
            <input type="password" id="p-pwd-confirm" class="auth-input" placeholder="Repita a senha" />
            <button class="pwd-eye" onclick="togglePwd('p-pwd-confirm')">👁️</button>
          </div>
        </div>
        <div id="p-pwd-error" class="auth-error" style="display:none"></div>
        <div id="p-pwd-success" class="auth-success" style="display:none"></div>
        <button class="auth-btn-primary" style="margin-top:0.8rem" onclick="changeProfilePwd(${user.id})">🔐 Alterar Senha</button>
      </div>

      <!-- DISPOSITIVOS -->
      <div class="profile-section" id="profile-dispositivos">
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem">
          🔒 Dispositivos autorizados a acessar sua conta (máx. 3)
        </p>
        <div id="devices-list">${deviceList || '<p style="color:var(--text-muted);font-size:0.85rem">Nenhum dispositivo</p>'}</div>
        <div style="margin-top:1rem;padding-top:0.75rem;border-top:1px solid var(--bg2)">
          <button class="auth-btn-danger" onclick="doLogout()">🚪 Sair da Conta</button>
        </div>
      </div>

    </div>`;

  document.body.appendChild(modal);
  applyPhoneMask();

  // Live pwd strength in profile
  document.getElementById('p-pwd-nova')?.addEventListener('input', function() {
    renderPwdStrengthEl(this.value, 'p-pwd-strength');
  });
}

function renderPwdStrengthEl(pwd, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd)) score++;
  const colors = ['#e74c3c','#e67e22','#f39c12','#27ae60','#1e8449'];
  const labels = ['Muito fraca','Fraca','Média','Forte','Muito forte'];
  el.innerHTML = `
    <div style="display:flex;gap:3px;margin:4px 0 2px">
      ${[0,1,2,3].map(i=>`<div style="flex:1;height:4px;border-radius:4px;background:${i<score?colors[score-1]:'#e0e0e0'}"></div>`).join('')}
    </div>
    <span style="font-size:0.7rem;color:${colors[score-1]||'#ccc'}">${pwd.length>0?labels[score-1]||labels[0]:''}</span>`;
}

function switchProfileTab(btn, tab) {
  document.querySelectorAll('.profile-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.profile-section').forEach(s => s.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('profile-' + tab)?.classList.add('active');
}

function closeProfileModal() {
  document.getElementById('profile-modal-overlay')?.remove();
}

function triggerProfilePhoto() {
  document.getElementById('profile-photo-input')?.click();
}

function handleProfilePhoto(e, userId) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const foto = ev.target.result;
    const users = getUsers();
    const user  = users.find(u => u.id === userId);
    if (user) {
      user.foto = foto;
      saveUsers(users);
    }
    // Update avatar in modal
    const img = document.getElementById('profile-avatar-img');
    if (img) {
      img.outerHTML = `<img src="${foto}" class="profile-avatar-img" id="profile-avatar-img" />`;
    }
    // Update top bar
    const session = getSession();
    if (session) {
      session.foto = foto;
      setSession(session);
    }
    // Update top bar avatar
    const avatarBtn = document.querySelector('.user-avatar-btn');
    if (avatarBtn) {
      avatarBtn.innerHTML = `<img src="${foto}" class="avatar-img" />`;
    }
    if (typeof showToast === 'function') showToast('📷 Foto atualizada!');
  };
  reader.readAsDataURL(file);
}

async function saveProfile(userId) {
  const nome      = document.getElementById('p-nome')?.value.trim();
  const sobrenome = document.getElementById('p-sobrenome')?.value.trim();
  const email     = document.getElementById('p-email')?.value.trim().toLowerCase();
  const celular   = document.getElementById('p-celular')?.value.trim();
  const nascimento = document.getElementById('p-nascimento')?.value;

  if (!nome || !sobrenome || !email) {
    if (typeof showToast === 'function') showToast('⚠️ Preencha os campos obrigatórios');
    return;
  }

  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return;

  // Check email uniqueness if changed
  if (email !== user.email && users.find(u => u.email === email && u.id !== userId)) {
    if (typeof showToast === 'function') showToast('⚠️ Este e-mail já está em uso');
    return;
  }

  user.nome       = nome;
  user.sobrenome  = sobrenome;
  user.email      = email;
  user.celular    = celular;
  user.nascimento = nascimento || user.nascimento;
  saveUsers(users);

  // Update session
  const session = getSession();
  if (session) {
    session.nome      = nome;
    session.sobrenome = sobrenome;
    session.email     = email;
    setSession(session);
  }

  // Update profile header
  document.querySelector('.profile-name')  && (document.querySelector('.profile-name').textContent = `${nome} ${sobrenome}`);
  document.querySelector('.profile-email') && (document.querySelector('.profile-email').textContent = email);

  // Update top bar avatar initials if no photo
  const avatarBtn = document.querySelector('.user-avatar-btn');
  if (avatarBtn && !user.foto) {
    avatarBtn.querySelector('.avatar-initials') && (avatarBtn.querySelector('.avatar-initials').textContent = (nome[0]+sobrenome[0]).toUpperCase());
  }

  if (typeof showToast === 'function') showToast('✅ Perfil atualizado!');
}

async function changeProfilePwd(userId) {
  const atual   = document.getElementById('p-pwd-atual')?.value;
  const nova    = document.getElementById('p-pwd-nova')?.value;
  const confirm = document.getElementById('p-pwd-confirm')?.value;

  if (!atual) return showAuthError('p-pwd-error', '⚠️ Digite a senha atual');
  if (!nova || nova.length < 8) return showAuthError('p-pwd-error', '⚠️ Nova senha deve ter mínimo 8 caracteres');
  if (nova !== confirm) return showAuthError('p-pwd-error', '⚠️ As senhas não coincidem');

  const users    = getUsers();
  const user     = users.find(u => u.id === userId);
  if (!user) return;

  const atualHash = await hashPassword(atual);
  if (atualHash !== user.pwdHash) return showAuthError('p-pwd-error', '❌ Senha atual incorreta');

  user.pwdHash = await hashPassword(nova);
  saveUsers(users);

  const successEl = document.getElementById('p-pwd-success');
  if (successEl) { successEl.style.display = 'block'; successEl.textContent = '✅ Senha alterada com sucesso!'; }
  ['p-pwd-atual','p-pwd-nova','p-pwd-confirm'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  if (typeof showToast === 'function') showToast('🔐 Senha alterada!');
}

async function removeDevice(userId, deviceId) {
  const users = getUsers();
  const user  = users.find(u => u.id === userId);
  if (!user) return;
  user.devices = (user.devices || []).filter(d => d !== deviceId);
  saveUsers(users);
  if (typeof showToast === 'function') showToast('📱 Dispositivo removido');
  // Refresh list
  const deviceId2 = getSavedDeviceId();
  const list = document.getElementById('devices-list');
  if (list) {
    list.innerHTML = (user.devices || []).map((d, i) => `
      <div class="device-item ${d === deviceId2 ? 'current' : ''}">
        <span>📱 Dispositivo ${i+1} ${d === deviceId2 ? '<span class="current-badge">Atual</span>' : ''}</span>
        ${d !== deviceId2 ? `<button class="icon-btn-sm" onclick="removeDevice(${user.id},'${d}')">🗑️</button>` : ''}
      </div>`).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">Nenhum outro dispositivo</p>';
  }
}

function doLogout() {
  clearSession();
  closeProfileModal();
  const app = document.getElementById('app');
  if (app) { app.style.display = 'none'; }
  const authWrap = document.getElementById('auth-wrapper');
  if (authWrap) { authWrap.style.display = 'flex'; }
  renderAuthScreen('login');
  if (typeof showToast === 'function') setTimeout(() => showToast('👋 Até logo!'), 300);
}

// ===== INIT AUTH FLOW =====
async function initAuth() {
  const splash  = document.getElementById('splash');
  const app     = document.getElementById('app');
  const authWrap= document.getElementById('auth-wrapper');

  // Hide splash
  setTimeout(() => {
    splash?.classList.add('hide');
    setTimeout(() => {
      if (splash) splash.style.display = 'none';

      // Check active session
      const session = getSession();
      if (session) {
        // Verify device still matches
        getDeviceFingerprint().then(currentDevice => {
          const users     = getUsers();
          const user      = users.find(u => u.id === session.userId);
          if (!user) { showAuthWrap(authWrap); return; }

          if (user.devices && !user.devices.includes(currentDevice)) {
            // Device not recognized — logout for security
            clearSession();
            showAuthWrap(authWrap);
            setTimeout(() => {
              document.getElementById('login-error') &&
                showAuthError('login-error', '🔒 Dispositivo não reconhecido. Faça login novamente.');
            }, 200);
            return;
          }

          // All good — go to app
          if (authWrap) authWrap.style.display = 'none';
          if (app) app.style.display = 'flex';
          updateTopBarUser(session);
          if (typeof init === 'function') init();
        });
      } else {
        showAuthWrap(authWrap);
      }
    }, 500);
  }, 1500);
}

function showAuthWrap(authWrap) {
  if (authWrap) { authWrap.style.display = 'flex'; }
  renderAuthScreen('login');
}
