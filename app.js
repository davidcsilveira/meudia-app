/* ============================================
   MEUDIA PWA — app.js
   ============================================ */

'use strict';

// ===== PWA: Register Service Worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('[PWA] SW registrado:', reg.scope))
      .catch(err => console.warn('[PWA] SW falhou:', err));
  });
}

// ===== DATA =====
let tasks    = JSON.parse(localStorage.getItem('meudia_tasks'))    || [];
let financas = JSON.parse(localStorage.getItem('meudia_financas')) || [];
let compras  = JSON.parse(localStorage.getItem('meudia_compras'))  || [];

let taskChartInst    = null;
let financeChartInst = null;
let currentTaskFilter   = 'all';
let currentComprasFilter = 'all';
let currentFinType       = 'receita';

const save = () => {
  localStorage.setItem('meudia_tasks',    JSON.stringify(tasks));
  localStorage.setItem('meudia_financas', JSON.stringify(financas));
  localStorage.setItem('meudia_compras',  JSON.stringify(compras));
};

// ===== SPLASH =====
window.addEventListener('load', () => {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => {
      splash.style.display = 'none';
      app.style.display = 'flex';
      init();
    }, 500);
  }, 1500);
});

// ===== DATE/TIME =====
function updateDateTime() {
  const now  = new Date();
  const opts = { weekday:'short', day:'2-digit', month:'short' };
  const time = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  const date = now.toLocaleDateString('pt-BR', opts);
  const el = document.getElementById('datetime');
  if (el) el.textContent = `${date} — ${time}`;
}
setInterval(updateDateTime, 1000);

// ===== NAVIGATION =====
function goPage(btn, page) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('page-' + page).classList.add('active');
  if (page === 'atividades') renderTaskChart();
  if (page === 'financeiro') renderFinanceChart();
  // Handle hash for PWA shortcuts
  window.location.hash = page;
}

// Hash navigation (for PWA shortcuts)
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#','');
  const btn  = document.querySelector(`[data-page="${hash}"]`);
  if (btn) goPage(btn, hash);
});

// ===== EXPAND FORM =====
function toggleExpand(id) {
  document.getElementById(id).classList.toggle('open');
}

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== HAPTIC =====
function haptic(type = 'light') {
  if (navigator.vibrate) {
    const p = { light:[10], medium:[30], success:[10,50,30] };
    navigator.vibrate(p[type] || [10]);
  }
}

// ===== NOTIFICATIONS =====
async function requestNotifications() {
  if (!('Notification' in window)) return showToast('Notificações não suportadas');
  if (Notification.permission === 'granted') return showToast('Notificações já ativas ✓');
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('✅ Notificações ativadas!');
    scheduleTaskReminders();
  } else {
    showToast('Notificações negadas');
  }
}

function scheduleTaskReminders() {
  const pendentes = tasks.filter(t => !t.done && t.time);
  if (!pendentes.length) return;
  const next = pendentes[0];
  showToast(`🔔 Lembrando: ${next.name} às ${next.time}`);
}

// ===== PWA INSTALL =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.add('show');
});

document.getElementById('install-btn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    showToast('🎉 App instalado com sucesso!');
    dismissInstall();
  }
  deferredPrompt = null;
});

function dismissInstall() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
}

window.addEventListener('appinstalled', () => {
  showToast('MeuDia instalado! 🚀');
  dismissInstall();
});

// ===================================================
// ===== ATIVIDADES =====
// ===================================================

function addTask() {
  const name = document.getElementById('task-name').value.trim();
  if (!name) { haptic('medium'); shakeEl('task-name'); return; }

  const task = {
    id: Date.now(),
    name,
    category: document.getElementById('task-category').value,
    priority:  document.getElementById('task-priority').value,
    time:      document.getElementById('task-time').value,
    done: false,
    createdAt: new Date().toISOString()
  };
  tasks.unshift(task);
  save();
  document.getElementById('task-name').value = '';
  document.getElementById('task-time').value = '';
  haptic('success');
  showToast('✅ Atividade adicionada!');
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  let filtered = tasks;
  if (currentTaskFilter === 'pendente')  filtered = tasks.filter(t => !t.done);
  if (currentTaskFilter === 'concluida') filtered = tasks.filter(t => t.done);

  list.innerHTML = filtered.length
    ? filtered.map(taskHTML).join('')
    : `<div class="empty-state"><div class="empty-icon">📝</div><p>Nenhuma atividade aqui</p></div>`;

  // Stats
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = total - done;
  const pct     = total ? Math.round(done / total * 100) : 0;

  document.getElementById('ms-total').textContent   = total;
  document.getElementById('ms-done').textContent    = done;
  document.getElementById('ms-pending').textContent = pending;
  document.getElementById('ring-pct').textContent   = pct + '%';

  // Ring animation
  const circle = document.getElementById('ring-circle');
  if (circle) {
    const circumference = 289;
    circle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  }

  // Today label
  const today = document.getElementById('today-label');
  if (today) {
    const d = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
    today.textContent = d.charAt(0).toUpperCase() + d.slice(1);
  }
}

function taskHTML(task) {
  const catLabels = { pessoal:'🏠', trabalho:'💼', saude:'🏃', estudo:'📚', lazer:'🎮' };
  const timeStr   = task.time ? ` · ⏰ ${task.time}` : '';
  return `
    <div class="task-item ${task.done ? 'done' : ''}">
      <input type="checkbox" class="task-check" ${task.done?'checked':''} onchange="toggleTask(${task.id})" />
      <div class="task-info">
        <div class="task-name">${escHtml(task.name)}</div>
        <div class="task-meta">${catLabels[task.category]||''} ${task.category}${timeStr}</div>
      </div>
      <span class="task-badge badge-${task.priority}">${task.priority}</span>
      <div class="item-actions">
        <button class="icon-btn" onclick="editTask(${task.id})">✏️</button>
        <button class="icon-btn" onclick="deleteTask(${task.id})">🗑️</button>
      </div>
    </div>`;
}

function toggleTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  haptic(t.done ? 'success' : 'light');
  if (t.done) showToast('🎉 Tarefa concluída!');
  save(); renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  haptic('medium');
  showToast('🗑️ Removida');
  save(); renderTasks();
}

function filterTasks(btn, filter) {
  currentTaskFilter = filter;
  document.querySelectorAll('#page-atividades .chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTasks();
}

function editTask(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  document.getElementById('modal-title').textContent = '✏️ Editar Atividade';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-body-grid">
      <input type="text" id="e-name" class="modal-input" value="${escHtml(t.name)}" placeholder="Nome..." />
      <select id="e-cat" class="modal-input">
        ${['pessoal','trabalho','saude','estudo','lazer'].map(c => `<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select id="e-pri" class="modal-input">
        ${['baixa','media','alta'].map(p => `<option value="${p}" ${t.priority===p?'selected':''}>${p}</option>`).join('')}
      </select>
      <input type="time" id="e-time" class="modal-input" value="${t.time||''}" />
    </div>`;
  document.getElementById('modal-save').onclick = () => {
    t.name     = document.getElementById('e-name').value.trim() || t.name;
    t.category = document.getElementById('e-cat').value;
    t.priority = document.getElementById('e-pri').value;
    t.time     = document.getElementById('e-time').value;
    save(); renderTasks(); closeModal(); showToast('✅ Salvo!');
  };
  openModal();
}

function renderTaskChart() {
  const ctx = document.getElementById('taskChart');
  if (!ctx) return;
  const cats   = ['pessoal','trabalho','saude','estudo','lazer'];
  const labels = ['Pessoal','Trabalho','Saúde','Estudo','Lazer'];
  const colors = ['#ff6b2b','#3498db','#2ecc71','#9b59b6','#f39c12'];
  const total  = cats.map(c => tasks.filter(t => t.category===c).length);
  const done   = cats.map(c => tasks.filter(t => t.category===c && t.done).length);
  if (taskChartInst) taskChartInst.destroy();
  taskChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'Total', data:total, backgroundColor:colors.map(c=>c+'33'), borderColor:colors, borderWidth:2, borderRadius:6 },
        { label:'Feitas', data:done, backgroundColor:colors, borderColor:colors.map(()=>'#2a1a0e'), borderWidth:2, borderRadius:6 }
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ labels:{ font:{ family:'DM Sans', size:11 } } } },
      scales:{
        y:{ beginAtZero:true, ticks:{stepSize:1}, grid:{color:'#e8dfd0'} },
        x:{ grid:{display:false} }
      }
    }
  });
}

// ===================================================
// ===== FINANCEIRO =====
// ===================================================

function setFinType(type) {
  currentFinType = type;
  document.getElementById('btn-receita').classList.toggle('active', type==='receita');
  document.getElementById('btn-despesa').classList.toggle('active', type==='despesa');
}

function addFinanca() {
  const desc  = document.getElementById('fin-desc').value.trim();
  const valor = parseFloat(document.getElementById('fin-valor').value);
  if (!desc)              { shakeEl('fin-desc');  haptic('medium'); return; }
  if (!valor || valor<=0) { shakeEl('fin-valor'); haptic('medium'); return; }

  const fin = {
    id: Date.now(),
    desc,
    valor,
    tipo:      currentFinType,
    categoria: document.getElementById('fin-categoria').value,
    data:      document.getElementById('fin-data').value || new Date().toISOString().slice(0,10)
  };
  financas.unshift(fin);
  save();
  document.getElementById('fin-desc').value  = '';
  document.getElementById('fin-valor').value = '';
  haptic('success');
  showToast(`${fin.tipo==='receita'?'💚 Receita':'❤️ Despesa'} adicionada!`);
  renderFinancas();
}

function renderFinancas() {
  const list = document.getElementById('finance-list');
  list.innerHTML = financas.length
    ? financas.map(finHTML).join('')
    : `<div class="empty-state"><div class="empty-icon">💰</div><p>Nenhuma transação ainda</p></div>`;

  const receita = financas.filter(f=>f.tipo==='receita').reduce((s,f)=>s+f.valor,0);
  const despesa = financas.filter(f=>f.tipo==='despesa').reduce((s,f)=>s+f.valor,0);
  const saldo   = receita - despesa;

  document.getElementById('saldo-value').textContent = 'R$ ' + saldo.toLocaleString('pt-BR',{minimumFractionDigits:2});
  document.getElementById('s-receita').textContent   = receita.toLocaleString('pt-BR',{minimumFractionDigits:2});
  document.getElementById('s-despesa').textContent   = despesa.toLocaleString('pt-BR',{minimumFractionDigits:2});

  const card = document.getElementById('saldo-card');
  card.className = 'saldo-card ' + (saldo>=0 ? 'positive' : 'negative');
}

function finHTML(f) {
  const catLabel = { alimentacao:'🍕',transporte:'🚗',moradia:'🏠',saude:'💊',lazer:'🎭',salario:'💼',outros:'📦' };
  const dataFmt  = f.data ? new Date(f.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) : '';
  return `
    <div class="finance-item">
      <div class="fin-indicator ${f.tipo}"></div>
      <div class="fin-info">
        <div class="fin-desc">${escHtml(f.desc)}</div>
        <div class="fin-meta">${catLabel[f.categoria]||''} ${f.categoria} · ${dataFmt}</div>
      </div>
      <div class="fin-valor ${f.tipo}">${f.tipo==='receita'?'+':'-'} R$${f.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
      <div class="item-actions">
        <button class="icon-btn" onclick="editFinanca(${f.id})">✏️</button>
        <button class="icon-btn" onclick="deleteFinanca(${f.id})">🗑️</button>
      </div>
    </div>`;
}

function deleteFinanca(id) {
  financas = financas.filter(f=>f.id!==id);
  haptic('medium'); showToast('🗑️ Removida'); save(); renderFinancas();
}

function editFinanca(id) {
  const f = financas.find(f=>f.id===id);
  if (!f) return;
  document.getElementById('modal-title').textContent = '✏️ Editar Transação';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-body-grid">
      <input type="text" id="ef-desc" class="modal-input" value="${escHtml(f.desc)}" />
      <input type="number" id="ef-val" class="modal-input" value="${f.valor}" step="0.01" />
      <select id="ef-tipo" class="modal-input">
        <option value="receita" ${f.tipo==='receita'?'selected':''}>💚 Receita</option>
        <option value="despesa" ${f.tipo==='despesa'?'selected':''}>❤️ Despesa</option>
      </select>
      <select id="ef-cat" class="modal-input">
        ${['alimentacao','transporte','moradia','saude','lazer','salario','outros'].map(c=>
          `<option value="${c}" ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <input type="date" id="ef-data" class="modal-input" value="${f.data}" />
    </div>`;
  document.getElementById('modal-save').onclick = () => {
    f.desc      = document.getElementById('ef-desc').value.trim() || f.desc;
    f.valor     = parseFloat(document.getElementById('ef-val').value) || f.valor;
    f.tipo      = document.getElementById('ef-tipo').value;
    f.categoria = document.getElementById('ef-cat').value;
    f.data      = document.getElementById('ef-data').value;
    save(); renderFinancas(); closeModal(); showToast('✅ Salvo!');
  };
  openModal();
}

function renderFinanceChart() {
  const ctx = document.getElementById('financeChart');
  if (!ctx) return;
  const cats   = ['alimentacao','transporte','moradia','saude','lazer','outros'];
  const labels = ['Alimentação','Transporte','Moradia','Saúde','Lazer','Outros'];
  const colors = ['#ff6b2b','#3498db','#9b59b6','#2ecc71','#f39c12','#e74c3c'];
  const vals   = cats.map(c => financas.filter(f=>f.tipo==='despesa'&&f.categoria===c).reduce((s,f)=>s+f.valor,0));
  if (vals.every(v=>v===0)) return;
  if (financeChartInst) financeChartInst.destroy();
  financeChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets:[{
        data:vals,
        backgroundColor:colors.map(c=>c+'cc'),
        borderColor:'#2a1a0e',
        borderWidth:2,
        hoverOffset:6
      }]
    },
    options: {
      responsive:true,
      plugins:{
        legend:{ position:'bottom', labels:{ font:{family:'DM Sans',size:11}, padding:10 } },
        tooltip:{ callbacks:{ label: ctx=>`R$ ${ctx.parsed.toLocaleString('pt-BR',{minimumFractionDigits:2})}` } }
      }
    }
  });
}

// ===================================================
// ===== COMPRAS =====
// ===================================================

function addCompra() {
  const nome = document.getElementById('comp-nome').value.trim();
  if (!nome) { shakeEl('comp-nome'); haptic('medium'); return; }

  const item = {
    id: Date.now(),
    nome,
    qtd:       parseFloat(document.getElementById('comp-qtd').value)  || 1,
    unidade:   document.getElementById('comp-unidade').value,
    categoria: document.getElementById('comp-categoria').value,
    preco:     parseFloat(document.getElementById('comp-preco').value) || 0,
    comprado:  false
  };
  compras.push(item);
  save();
  document.getElementById('comp-nome').value  = '';
  document.getElementById('comp-preco').value = '';
  document.getElementById('comp-qtd').value   = '1';
  haptic('success');
  showToast('🛒 Item adicionado!');
  renderCompras();
}

function renderCompras() {
  const list = document.getElementById('compras-list');
  let filtered = currentComprasFilter==='all' ? compras : compras.filter(c=>c.categoria===currentComprasFilter);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Adicione itens à lista</p></div>`;
  } else {
    const catLabel = { hortifruti:'🥦 Hortifruti',carnes:'🥩 Carnes',laticinios:'🧀 Laticínios',padaria:'🍞 Padaria',bebidas:'🥤 Bebidas',limpeza:'🧹 Limpeza',higiene:'🧴 Higiene',mercearia:'🛒 Mercearia' };
    const groups = {};
    filtered.forEach(item => { if (!groups[item.categoria]) groups[item.categoria]=[]; groups[item.categoria].push(item); });
    list.innerHTML = Object.entries(groups).map(([cat,items]) => `
      <div>
        <div class="compras-section-title">${catLabel[cat]||cat}</div>
        ${items.map(compraHTML).join('')}
      </div>`).join('');
  }

  const total    = compras.length;
  const marcados = compras.filter(c=>c.comprado).length;
  const totalR   = compras.reduce((s,c)=>s+(c.preco*c.qtd),0);
  document.getElementById('cb-total').textContent    = total;
  document.getElementById('cb-marcados').textContent = marcados;
  document.getElementById('cb-valor').textContent    = 'R$'+totalR.toFixed(0);
}

function compraHTML(item) {
  const prStr = item.preco ? `R$${(item.preco*item.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}` : '';
  return `
    <div class="compra-item ${item.comprado?'no-carrinho':''}">
      <input type="checkbox" class="compra-check" ${item.comprado?'checked':''} onchange="toggleCompra(${item.id})" />
      <div class="compra-info">
        <div class="compra-nome">${escHtml(item.nome)}</div>
        <div class="compra-meta">${item.qtd} ${item.unidade}</div>
      </div>
      ${prStr?`<div class="compra-preco">${prStr}</div>`:''}
      <div class="item-actions">
        <button class="icon-btn" onclick="editCompra(${item.id})">✏️</button>
        <button class="icon-btn" onclick="deleteCompra(${item.id})">🗑️</button>
      </div>
    </div>`;
}

function toggleCompra(id) {
  const c = compras.find(c=>c.id===id);
  if (!c) return;
  c.comprado = !c.comprado;
  haptic(c.comprado ? 'success' : 'light');
  if (c.comprado) showToast(`✅ ${c.nome} no carrinho!`);
  save(); renderCompras();
}

function deleteCompra(id) {
  compras = compras.filter(c=>c.id!==id);
  haptic('medium'); showToast('🗑️ Removido'); save(); renderCompras();
}

function editCompra(id) {
  const c = compras.find(c=>c.id===id);
  if (!c) return;
  document.getElementById('modal-title').textContent = '✏️ Editar Item';
  document.getElementById('modal-body').innerHTML = `
    <div class="modal-body-grid">
      <input type="text" id="ec-nome" class="modal-input" value="${escHtml(c.nome)}" />
      <input type="number" id="ec-qtd" class="modal-input" value="${c.qtd}" min="0.1" step="0.1" />
      <select id="ec-un" class="modal-input">
        ${['un','kg','g','L','ml','cx','pct'].map(u=>`<option value="${u}" ${c.unidade===u?'selected':''}>${u}</option>`).join('')}
      </select>
      <input type="number" id="ec-preco" class="modal-input" value="${c.preco||''}" placeholder="Preço (R$)" step="0.01" />
    </div>`;
  document.getElementById('modal-save').onclick = () => {
    c.nome   = document.getElementById('ec-nome').value.trim() || c.nome;
    c.qtd    = parseFloat(document.getElementById('ec-qtd').value) || c.qtd;
    c.unidade= document.getElementById('ec-un').value;
    c.preco  = parseFloat(document.getElementById('ec-preco').value) || 0;
    save(); renderCompras(); closeModal(); showToast('✅ Salvo!');
  };
  openModal();
}

function filterCompras(btn, filter) {
  currentComprasFilter = filter;
  document.querySelectorAll('#page-compras .chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCompras();
}

function clearCompradas() {
  compras = compras.filter(c => !c.comprado);
  haptic('medium'); showToast('🗑️ Comprados removidos'); save(); renderCompras();
}

function clearAllCompras() {
  if (!confirm('Limpar toda a lista?')) return;
  compras = [];
  haptic('medium'); save(); renderCompras();
}

// ===== MODAL =====
function openModal() { document.getElementById('modal').classList.add('open'); }
function closeModal(e) {
  if (!e || e.target.id === 'modal') document.getElementById('modal').classList.remove('open');
}

// Swipe down to close modal
let modalStartY = 0;
document.querySelector('.modal-box')?.addEventListener('touchstart', e => { modalStartY = e.touches[0].clientY; });
document.querySelector('.modal-box')?.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - modalStartY > 80) closeModal();
});

// ===== UTILS =====
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shakeEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#e74c3c';
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 600);
}

// Add shake keyframe dynamically
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-6px)}
  40%{transform:translateX(6px)}
  60%{transform:translateX(-4px)}
  80%{transform:translateX(4px)}
}`;
document.head.appendChild(shakeStyle);

// ===== INIT =====
function init() {
  updateDateTime();

  // Set today in finance date
  const fd = document.getElementById('fin-data');
  if (fd) fd.value = new Date().toISOString().slice(0,10);

  // Handle hash on load
  const hash = window.location.hash.replace('#','');
  if (hash) {
    const btn = document.querySelector(`[data-page="${hash}"]`);
    if (btn) goPage(btn, hash);
  }

  renderTasks();
  renderFinancas();
  renderCompras();
}
