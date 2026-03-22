/* ============================================
   MEUDIA PWA — app.js  (all modules)
   ============================================ */
'use strict';

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ===== DATA =====
let tasks    = JSON.parse(localStorage.getItem('meudia_tasks'))    || [];
let financas = JSON.parse(localStorage.getItem('meudia_financas')) || [];
let compras  = JSON.parse(localStorage.getItem('meudia_compras'))  || [];
let series   = JSON.parse(localStorage.getItem('meudia_series'))   || [];
let medidas  = JSON.parse(localStorage.getItem('meudia_medidas'))  || [];
let refeicoes= JSON.parse(localStorage.getItem('meudia_refeicoes'))|| [];
let objetivo = localStorage.getItem('meudia_objetivo') || null;
let weekCheck= JSON.parse(localStorage.getItem('meudia_weekcheck'))|| {};

let taskChartInst=null, financeChartInst=null, pesoChartInst=null, kcalChartInst=null;
let currentTaskFilter='all', currentComprasFilter='all', currentFinType='receita';
let pendingMediaData={};

const save = () => {
  localStorage.setItem('meudia_tasks',    JSON.stringify(tasks));
  localStorage.setItem('meudia_financas', JSON.stringify(financas));
  localStorage.setItem('meudia_compras',  JSON.stringify(compras));
};
const saveAcad = () => {
  localStorage.setItem('meudia_series',    JSON.stringify(series));
  localStorage.setItem('meudia_medidas',   JSON.stringify(medidas));
  localStorage.setItem('meudia_refeicoes', JSON.stringify(refeicoes));
  localStorage.setItem('meudia_objetivo',  objetivo || '');
  localStorage.setItem('meudia_weekcheck', JSON.stringify(weekCheck));
};

// ===== BOOT — auth.js calls init() after login =====
window.addEventListener('load', () => {
  if (typeof initAuth === 'function') {
    initAuth();
  } else {
    // fallback (no auth)
    const splash = document.getElementById('splash');
    setTimeout(() => {
      splash && splash.classList.add('hide');
      setTimeout(() => {
        if (splash) splash.style.display = 'none';
        document.getElementById('app').style.display = 'flex';
        init();
      }, 500);
    }, 1400);
  }
});

// ===== DATETIME =====
function updateDateTime() {
  const now  = new Date();
  const el   = document.getElementById('datetime');
  if (!el) return;
  el.textContent = now.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'})
    + ' — ' + now.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateDateTime, 1000);

// ===== NAVIGATION =====
function goPage(btn, page) {
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const pg = document.getElementById('page-' + page);
  if (pg) pg.classList.add('active');
  if (page === 'atividades') renderTaskChart();
  if (page === 'financeiro') renderFinanceChart();
  if (page === 'academia')   { renderWeekDays(); renderSeries(); renderObjetivo(); }
}

// ===== INSTALL BANNER =====
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  document.getElementById('install-banner')?.classList.add('show');
});
document.getElementById('install-btn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  dismissInstall();
});
function dismissInstall() {
  document.getElementById('install-banner')?.classList.remove('show');
}

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ===== HAPTIC =====
function haptic(type='light') {
  if (!navigator.vibrate) return;
  ({light:[10], medium:[30], success:[10,50,30]})[type]
    && navigator.vibrate(({light:[10], medium:[30], success:[10,50,30]})[type]);
}

// ===== NOTIFICATIONS =====
async function requestNotifications() {
  if (!('Notification' in window)) return showToast('Não suportado');
  if (Notification.permission === 'granted') return showToast('Notificações já ativas ✓');
  const p = await Notification.requestPermission();
  showToast(p === 'granted' ? '✅ Notificações ativadas!' : 'Permissão negada');
}

// ===== EXPAND FORM =====
function toggleExpand(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
}

// ===== CARD ACAD TOGGLE =====
function toggleCardAcad(header) {
  const body = header.nextElementSibling;
  if (!body) return;
  const open = body.style.display === 'block';
  body.style.display = open ? 'none' : 'block';
  const ch = header.querySelector('.chevron');
  if (ch) ch.style.transform = open ? '' : 'rotate(180deg)';
}

// ===== SHAKE =====
function shakeEl(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = '#e74c3c';
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => { el.style.borderColor=''; el.style.animation=''; }, 600);
}
const _shakeStyle = document.createElement('style');
_shakeStyle.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
document.head.appendChild(_shakeStyle);

// ===== ESCAPE HTML =====
function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== MODAL =====
function openModal()  { document.getElementById('modal')?.classList.add('open'); }
function closeModal(e){ if(!e||e.target.id==='modal') document.getElementById('modal')?.classList.remove('open'); }

// ===== LIGHTBOX =====
function openLightbox(type, src) {
  const lb = document.getElementById('lightbox');
  const ct = document.getElementById('lightbox-content');
  if (!lb || !ct || !src) return;
  ct.innerHTML = type === 'img'
    ? `<img src="${src}" style="max-width:100%;max-height:80vh;border-radius:12px"/>`
    : `<video src="${src}" controls style="max-width:100%;max-height:80vh;border-radius:12px"></video>`;
  lb.classList.add('open');
}
function closeLightbox() {
  document.getElementById('lightbox')?.classList.remove('open');
}

// =====================================================
// ATIVIDADES
// =====================================================
function addTask() {
  const name = document.getElementById('task-name')?.value.trim();
  if (!name) { shakeEl('task-name'); haptic('medium'); return; }
  tasks.unshift({
    id: Date.now(), name,
    category: document.getElementById('task-category')?.value || 'pessoal',
    priority:  document.getElementById('task-priority')?.value  || 'baixa',
    time:      document.getElementById('task-time')?.value      || '',
    done: false, createdAt: new Date().toISOString()
  });
  save();
  document.getElementById('task-name').value = '';
  document.getElementById('task-time').value = '';
  haptic('success'); showToast('✅ Atividade adicionada!');
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById('task-list');
  if (!list) return;
  let filtered = tasks;
  if (currentTaskFilter === 'pendente')  filtered = tasks.filter(t => !t.done);
  if (currentTaskFilter === 'concluida') filtered = tasks.filter(t =>  t.done);
  list.innerHTML = filtered.length
    ? filtered.map(taskHTML).join('')
    : `<div class="empty-state"><div class="empty-icon">📝</div><p>Nenhuma atividade</p></div>`;

  const total=tasks.length, done=tasks.filter(t=>t.done).length, pct=total?Math.round(done/total*100):0;
  document.getElementById('ms-total').textContent   = total;
  document.getElementById('ms-done').textContent    = done;
  document.getElementById('ms-pending').textContent = total-done;
  document.getElementById('ring-pct').textContent   = pct+'%';
  const rc = document.getElementById('ring-circle');
  if (rc) rc.style.strokeDashoffset = 289 - (pct/100)*289;

  const tl = document.getElementById('today-label');
  if (tl) {
    const d = new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    tl.textContent = d.charAt(0).toUpperCase()+d.slice(1);
  }
}

function taskHTML(t) {
  const cats = {pessoal:'🏠',trabalho:'💼',saude:'🏃',estudo:'📚',lazer:'🎮'};
  return `<div class="task-item ${t.done?'done':''}">
    <input type="checkbox" class="task-check" ${t.done?'checked':''} onchange="toggleTask(${t.id})"/>
    <div class="task-info">
      <div class="task-name">${escHtml(t.name)}</div>
      <div class="task-meta">${cats[t.category]||''} ${t.category}${t.time?' · ⏰ '+t.time:''}</div>
    </div>
    <span class="task-badge badge-${t.priority}">${t.priority}</span>
    <div class="item-actions">
      <button class="icon-btn" onclick="editTask(${t.id})">✏️</button>
      <button class="icon-btn" onclick="deleteTask(${t.id})">🗑️</button>
    </div>
  </div>`;
}

function toggleTask(id) {
  const t=tasks.find(t=>t.id===id); if(!t) return;
  t.done=!t.done; haptic(t.done?'success':'light');
  if(t.done) showToast('🎉 Concluída!');
  save(); renderTasks();
}
function deleteTask(id) { tasks=tasks.filter(t=>t.id!==id); haptic('medium'); showToast('🗑️ Removida'); save(); renderTasks(); }
function filterTasks(btn,filter) {
  currentTaskFilter=filter;
  document.querySelectorAll('#page-atividades .chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderTasks();
}
function editTask(id) {
  const t=tasks.find(t=>t.id===id); if(!t) return;
  document.getElementById('modal-title').textContent='✏️ Editar Atividade';
  document.getElementById('modal-body').innerHTML=`<div class="modal-body-grid">
    <input type="text" id="e-name" class="modal-input" value="${escHtml(t.name)}"/>
    <select id="e-cat" class="modal-input">
      ${['pessoal','trabalho','saude','estudo','lazer'].map(c=>`<option value="${c}" ${t.category===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <select id="e-pri" class="modal-input">
      ${['baixa','media','alta'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${p}</option>`).join('')}
    </select>
    <input type="time" id="e-time" class="modal-input" value="${t.time||''}"/>
  </div>`;
  document.getElementById('modal-save').onclick=()=>{
    t.name=document.getElementById('e-name').value.trim()||t.name;
    t.category=document.getElementById('e-cat').value;
    t.priority=document.getElementById('e-pri').value;
    t.time=document.getElementById('e-time').value;
    save(); renderTasks(); closeModal(); showToast('✅ Salvo!');
  };
  openModal();
}
function renderTaskChart() {
  const ctx=document.getElementById('taskChart'); if(!ctx) return;
  const cats=['pessoal','trabalho','saude','estudo','lazer'];
  const labels=['Pessoal','Trabalho','Saúde','Estudo','Lazer'];
  const colors=['#ff6b2b','#3498db','#2ecc71','#9b59b6','#f39c12'];
  if(taskChartInst) taskChartInst.destroy();
  taskChartInst=new Chart(ctx,{type:'bar',data:{labels,datasets:[
    {label:'Total',data:cats.map(c=>tasks.filter(t=>t.category===c).length),backgroundColor:colors.map(c=>c+'33'),borderColor:colors,borderWidth:2,borderRadius:6},
    {label:'Feitas',data:cats.map(c=>tasks.filter(t=>t.category===c&&t.done).length),backgroundColor:colors,borderColor:colors.map(()=>'#2a1a0e'),borderWidth:2,borderRadius:6}
  ]},options:{responsive:true,plugins:{legend:{labels:{font:{family:'DM Sans',size:11}}}},scales:{y:{beginAtZero:true,ticks:{stepSize:1},grid:{color:'#e8dfd0'}},x:{grid:{display:false}}}}});
}

// =====================================================
// FINANCEIRO
// =====================================================
function setFinType(type) {
  currentFinType=type;
  document.getElementById('btn-receita').classList.toggle('active',type==='receita');
  document.getElementById('btn-despesa').classList.toggle('active',type==='despesa');
}
function addFinanca() {
  const desc=document.getElementById('fin-desc')?.value.trim();
  const valor=parseFloat(document.getElementById('fin-valor')?.value);
  if(!desc){shakeEl('fin-desc');haptic('medium');return;}
  if(!valor||valor<=0){shakeEl('fin-valor');haptic('medium');return;}
  financas.unshift({id:Date.now(),desc,valor,tipo:currentFinType,
    categoria:document.getElementById('fin-categoria')?.value||'outros',
    data:document.getElementById('fin-data')?.value||new Date().toISOString().slice(0,10)});
  save();
  document.getElementById('fin-desc').value='';
  document.getElementById('fin-valor').value='';
  haptic('success'); showToast(currentFinType==='receita'?'💚 Receita adicionada!':'❤️ Despesa adicionada!');
  renderFinancas();
}
function renderFinancas() {
  const list=document.getElementById('finance-list'); if(!list) return;
  list.innerHTML=financas.length?financas.map(finHTML).join('')
    :`<div class="empty-state"><div class="empty-icon">💰</div><p>Nenhuma transação ainda</p></div>`;
  const rec=financas.filter(f=>f.tipo==='receita').reduce((s,f)=>s+f.valor,0);
  const des=financas.filter(f=>f.tipo==='despesa').reduce((s,f)=>s+f.valor,0);
  const sal=rec-des;
  document.getElementById('saldo-value').textContent='R$ '+sal.toLocaleString('pt-BR',{minimumFractionDigits:2});
  document.getElementById('s-receita').textContent=rec.toLocaleString('pt-BR',{minimumFractionDigits:2});
  document.getElementById('s-despesa').textContent=des.toLocaleString('pt-BR',{minimumFractionDigits:2});
  const card=document.getElementById('saldo-card');
  if(card) card.className='saldo-card '+(sal>=0?'positive':'negative');
}
function finHTML(f) {
  const cats={alimentacao:'🍕',transporte:'🚗',moradia:'🏠',saude:'💊',lazer:'🎭',salario:'💼',outros:'📦'};
  const dt=f.data?new Date(f.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'';
  return `<div class="finance-item">
    <div class="fin-indicator ${f.tipo}"></div>
    <div class="fin-info">
      <div class="fin-desc">${escHtml(f.desc)}</div>
      <div class="fin-meta">${cats[f.categoria]||''} ${f.categoria} · ${dt}</div>
    </div>
    <div class="fin-valor ${f.tipo}">${f.tipo==='receita'?'+':'-'} R$${f.valor.toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
    <div class="item-actions">
      <button class="icon-btn" onclick="editFinanca(${f.id})">✏️</button>
      <button class="icon-btn" onclick="deleteFinanca(${f.id})">🗑️</button>
    </div>
  </div>`;
}
function deleteFinanca(id){financas=financas.filter(f=>f.id!==id);haptic('medium');showToast('🗑️ Removida');save();renderFinancas();}
function editFinanca(id) {
  const f=financas.find(f=>f.id===id); if(!f) return;
  document.getElementById('modal-title').textContent='✏️ Editar Transação';
  document.getElementById('modal-body').innerHTML=`<div class="modal-body-grid">
    <input type="text" id="ef-desc" class="modal-input" value="${escHtml(f.desc)}"/>
    <input type="number" id="ef-val" class="modal-input" value="${f.valor}" step="0.01"/>
    <select id="ef-tipo" class="modal-input">
      <option value="receita" ${f.tipo==='receita'?'selected':''}>💚 Receita</option>
      <option value="despesa" ${f.tipo==='despesa'?'selected':''}>❤️ Despesa</option>
    </select>
    <select id="ef-cat" class="modal-input">
      ${['alimentacao','transporte','moradia','saude','lazer','salario','outros'].map(c=>`<option value="${c}" ${f.categoria===c?'selected':''}>${c}</option>`).join('')}
    </select>
    <input type="date" id="ef-data" class="modal-input" value="${f.data||''}"/>
  </div>`;
  document.getElementById('modal-save').onclick=()=>{
    f.desc=document.getElementById('ef-desc').value.trim()||f.desc;
    f.valor=parseFloat(document.getElementById('ef-val').value)||f.valor;
    f.tipo=document.getElementById('ef-tipo').value;
    f.categoria=document.getElementById('ef-cat').value;
    f.data=document.getElementById('ef-data').value;
    save(); renderFinancas(); closeModal(); showToast('✅ Salvo!');
  };
  openModal();
}
function renderFinanceChart() {
  const ctx=document.getElementById('financeChart'); if(!ctx) return;
  const cats=['alimentacao','transporte','moradia','saude','lazer','outros'];
  const labels=['Alimentação','Transporte','Moradia','Saúde','Lazer','Outros'];
  const colors=['#ff6b2b','#3498db','#9b59b6','#2ecc71','#f39c12','#e74c3c'];
  const vals=cats.map(c=>financas.filter(f=>f.tipo==='despesa'&&f.categoria===c).reduce((s,f)=>s+f.valor,0));
  if(vals.every(v=>v===0)) return;
  if(financeChartInst) financeChartInst.destroy();
  financeChartInst=new Chart(ctx,{type:'doughnut',data:{labels,datasets:[{data:vals,backgroundColor:colors.map(c=>c+'cc'),borderColor:'#2a1a0e',borderWidth:2,hoverOffset:6}]},
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'DM Sans',size:11},padding:10}},
    tooltip:{callbacks:{label:ctx=>`R$ ${ctx.parsed.toLocaleString('pt-BR',{minimumFractionDigits:2})}`}}}}});
}

// =====================================================
// COMPRAS
// =====================================================
function addCompra() {
  const nome=document.getElementById('comp-nome')?.value.trim();
  if(!nome){shakeEl('comp-nome');haptic('medium');return;}
  compras.push({id:Date.now(),nome,
    qtd:parseFloat(document.getElementById('comp-qtd')?.value)||1,
    unidade:document.getElementById('comp-unidade')?.value||'un',
    categoria:document.getElementById('comp-categoria')?.value||'mercearia',
    preco:parseFloat(document.getElementById('comp-preco')?.value)||0,
    comprado:false});
  save();
  document.getElementById('comp-nome').value='';
  document.getElementById('comp-preco').value='';
  document.getElementById('comp-qtd').value='1';
  haptic('success'); showToast('🛒 Item adicionado!');
  renderCompras();
}
function renderCompras() {
  const list=document.getElementById('compras-list'); if(!list) return;
  const filtered=currentComprasFilter==='all'?compras:compras.filter(c=>c.categoria===currentComprasFilter);
  if(!filtered.length){
    list.innerHTML=`<div class="empty-state"><div class="empty-icon">🛒</div><p>Lista vazia</p></div>`;
  } else {
    const cl={hortifruti:'🥦 Hortifruti',carnes:'🥩 Carnes',laticinios:'🧀 Laticínios',padaria:'🍞 Padaria',
      bebidas:'🥤 Bebidas',limpeza:'🧹 Limpeza',higiene:'🧴 Higiene',mercearia:'🛒 Mercearia'};
    const groups={};
    filtered.forEach(item=>{if(!groups[item.categoria])groups[item.categoria]=[];groups[item.categoria].push(item);});
    list.innerHTML=Object.entries(groups).map(([cat,items])=>`
      <div><div class="compras-section-title">${cl[cat]||cat}</div>${items.map(compraHTML).join('')}</div>`).join('');
  }
  const total=compras.length, marc=compras.filter(c=>c.comprado).length;
  const tot=compras.reduce((s,c)=>s+(c.preco*c.qtd),0);
  document.getElementById('cb-total').textContent=total;
  document.getElementById('cb-marcados').textContent=marc;
  document.getElementById('cb-valor').textContent='R$'+tot.toFixed(0);
}
function compraHTML(item) {
  const p=item.preco?`R$${(item.preco*item.qtd).toLocaleString('pt-BR',{minimumFractionDigits:2})}`:'';
  return `<div class="compra-item ${item.comprado?'no-carrinho':''}">
    <input type="checkbox" class="compra-check" ${item.comprado?'checked':''} onchange="toggleCompra(${item.id})"/>
    <div class="compra-info">
      <div class="compra-nome">${escHtml(item.nome)}</div>
      <div class="compra-meta">${item.qtd} ${item.unidade}</div>
    </div>
    ${p?`<div class="compra-preco">${p}</div>`:''}
    <div class="item-actions">
      <button class="icon-btn" onclick="editCompra(${item.id})">✏️</button>
      <button class="icon-btn" onclick="deleteCompra(${item.id})">🗑️</button>
    </div>
  </div>`;
}
function toggleCompra(id){const c=compras.find(c=>c.id===id);if(!c)return;c.comprado=!c.comprado;haptic(c.comprado?'success':'light');if(c.comprado)showToast(`✅ ${c.nome} no carrinho!`);save();renderCompras();}
function deleteCompra(id){compras=compras.filter(c=>c.id!==id);haptic('medium');showToast('🗑️ Removido');save();renderCompras();}
function editCompra(id){
  const c=compras.find(c=>c.id===id); if(!c) return;
  document.getElementById('modal-title').textContent='✏️ Editar Item';
  document.getElementById('modal-body').innerHTML=`<div class="modal-body-grid">
    <input type="text" id="ec-nome" class="modal-input" value="${escHtml(c.nome)}"/>
    <input type="number" id="ec-qtd" class="modal-input" value="${c.qtd}" min="0.1" step="0.1"/>
    <select id="ec-un" class="modal-input">
      ${['un','kg','g','L','ml','cx','pct'].map(u=>`<option value="${u}" ${c.unidade===u?'selected':''}>${u}</option>`).join('')}
    </select>
    <input type="number" id="ec-preco" class="modal-input" value="${c.preco||''}" placeholder="Preço (R$)" step="0.01"/>
  </div>`;
  document.getElementById('modal-save').onclick=()=>{
    c.nome=document.getElementById('ec-nome').value.trim()||c.nome;
    c.qtd=parseFloat(document.getElementById('ec-qtd').value)||c.qtd;
    c.unidade=document.getElementById('ec-un').value;
    c.preco=parseFloat(document.getElementById('ec-preco').value)||0;
    save();renderCompras();closeModal();showToast('✅ Salvo!');
  };
  openModal();
}
function filterCompras(btn,filter){
  currentComprasFilter=filter;
  document.querySelectorAll('#page-compras .chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderCompras();
}
function clearCompradas(){compras=compras.filter(c=>!c.comprado);haptic('medium');showToast('🗑️ Comprados removidos');save();renderCompras();}
function clearAllCompras(){if(!confirm('Limpar toda a lista?'))return;compras=[];haptic('medium');save();renderCompras();}

// =====================================================
// ACADEMIA
// =====================================================
function switchAcadTab(btn,tab) {
  document.querySelectorAll('.sub-tab').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.acad-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('acad-'+tab)?.classList.add('active');
  if(tab==='corpo') renderMedidas();
  if(tab==='nutri') renderNutri();
}

// Week
const DIAS=['dom','seg','ter','qua','qui','sex','sab'];
const DIAS_LBL=['D','S','T','Q','Q','S','S'];
function getWeekKey(){const d=new Date(),s=new Date(d);s.setDate(d.getDate()-d.getDay());return s.toISOString().slice(0,10);}
function renderWeekDays(){
  const el=document.getElementById('week-days'); if(!el) return;
  const wk=getWeekKey(); if(!weekCheck[wk]) weekCheck[wk]={};
  const today=new Date().getDay();
  el.innerHTML=DIAS.map((d,i)=>{
    const st=weekCheck[wk][d]||'none';
    return `<div class="week-day">
      <span class="week-day-label">${DIAS_LBL[i]}</span>
      <div class="week-day-box ${st!=='none'?st:''} ${i===today?'hoje':''}" onclick="cycleWeekDay('${d}')">
        ${st==='treino'?'🏋️':st==='completo'?'✅':''}
      </div>
    </div>`;
  }).join('');
}
function cycleWeekDay(dia){
  const wk=getWeekKey(); if(!weekCheck[wk]) weekCheck[wk]={};
  const cur=weekCheck[wk][dia]||'none';
  weekCheck[wk][dia]=cur==='none'?'treino':cur==='treino'?'completo':'none';
  saveAcad(); haptic('light'); renderWeekDays();
  if(weekCheck[wk][dia]==='completo') showToast('🎉 Treino concluído!');
}

// Series
function addSerie(){
  const nome=document.getElementById('serie-nome')?.value.trim();
  if(!nome){shakeEl('serie-nome');return;}
  const sel=document.getElementById('serie-dias');
  const dias=sel?Array.from(sel.selectedOptions).map(o=>o.value):[];
  series.push({id:Date.now(),nome,tipo:document.getElementById('serie-tipo')?.value||'A',dias,exercicios:[]});
  saveAcad(); document.getElementById('serie-nome').value='';
  haptic('success'); showToast('💪 Série criada!'); renderSeries();
}
function renderSeries(){
  const el=document.getElementById('series-list'); if(!el) return;
  el.innerHTML=series.length?series.map(serieHTML).join('')
    :`<div class="empty-state"><div class="empty-icon">🏋️</div><p>Nenhuma série criada</p></div>`;
}
function serieHTML(s){
  return `<div class="serie-item" id="serie-${s.id}">
    <div class="serie-header" onclick="toggleSerie(${s.id})">
      <span class="serie-badge">${s.tipo}</span>
      <div class="serie-info">
        <div class="serie-nome">${escHtml(s.nome)}</div>
        <div class="serie-meta">📅 ${s.dias.join(', ')||'sem dia'} · 🏋️ ${s.exercicios.length} exercício(s)</div>
      </div>
      <div class="item-actions" onclick="event.stopPropagation()">
        <button class="icon-btn" onclick="deleteSerie(${s.id})">🗑️</button>
      </div>
      <span class="serie-arrow">▾</span>
    </div>
    <div class="serie-body">
      ${s.exercicios.map(ex=>exerciseHTML(s.id,ex)).join('')}
      ${addExerciseFormHTML(s.id)}
    </div>
  </div>`;
}
function toggleSerie(id){document.getElementById('serie-'+id)?.classList.toggle('open');}
function deleteSerie(id){series=series.filter(s=>s.id!==id);saveAcad();haptic('medium');showToast('🗑️ Série removida');renderSeries();}

// Exercises
function addExerciseFormHTML(sid){
  return `<div class="add-exercise-form">
    <div class="form-col">
      <input type="text" id="ex-nome-${sid}" class="quick-input" placeholder="Nome do exercício..."/>
      <div class="form-row">
        <input type="number" id="ex-series-${sid}" class="input-sm" placeholder="Séries" value="3" min="1" style="max-width:80px"/>
        <input type="number" id="ex-reps-${sid}"   class="input-sm" placeholder="Reps"   value="12" min="1" style="max-width:80px"/>
        <input type="text"   id="ex-carga-${sid}"  class="input-sm" placeholder="Carga kg"/>
      </div>
      <input type="text" id="ex-obs-${sid}" class="input-sm" placeholder="Observações..."/>
      <div class="media-preview-wrap" id="media-prev-${sid}"></div>
      <div class="form-row">
        <button class="upload-btn" onclick="triggerUpload(${sid},'foto')">📷 Foto</button>
        <button class="upload-btn" onclick="triggerUpload(${sid},'video')">🎥 Vídeo</button>
      </div>
      <button class="btn-full" onclick="addExercicio(${sid})">➕ Adicionar Exercício</button>
    </div>
  </div>`;
}

let pendingMediaSerieId=null, pendingMediaType=null;
function triggerUpload(sid,type){
  pendingMediaSerieId=sid; pendingMediaType=type;
  document.getElementById(type==='foto'?'file-foto':'file-video')?.click();
}
document.getElementById('file-foto')?.addEventListener('change',e=>handleFileUpload(e,'foto'));
document.getElementById('file-video')?.addEventListener('change',e=>handleFileUpload(e,'video'));
function handleFileUpload(e,type){
  const file=e.target.files[0]; if(!file||!pendingMediaSerieId) return;
  const sid=pendingMediaSerieId;
  const reader=new FileReader();
  reader.onload=ev=>{
    if(!pendingMediaData[sid]) pendingMediaData[sid]={};
    pendingMediaData[sid][type]=ev.target.result;
    updateMediaPreview(sid); showToast(type==='foto'?'📷 Foto pronta!':'🎥 Vídeo pronto!');
  };
  reader.readAsDataURL(file); e.target.value='';
}
function updateMediaPreview(sid){
  const wrap=document.getElementById('media-prev-'+sid); if(!wrap) return;
  const data=pendingMediaData[sid]||{};
  wrap.innerHTML='';
  if(data.foto) wrap.innerHTML+=`<img class="media-thumb" src="${data.foto}" onclick="openLightbox('img','${data.foto}')"/>`;
  if(data.video) wrap.innerHTML+=`<div class="media-thumb-video" onclick="openLightbox('video','${data.video}')">▶️</div>`;
}
function addExercicio(sid){
  const nome=document.getElementById(`ex-nome-${sid}`)?.value.trim();
  if(!nome){shakeEl(`ex-nome-${sid}`);return;}
  const serie=series.find(s=>s.id===sid); if(!serie) return;
  serie.exercicios.push({id:Date.now(),nome,
    series:parseInt(document.getElementById(`ex-series-${sid}`)?.value)||3,
    reps:parseInt(document.getElementById(`ex-reps-${sid}`)?.value)||12,
    carga:document.getElementById(`ex-carga-${sid}`)?.value||'',
    obs:document.getElementById(`ex-obs-${sid}`)?.value||'',
    foto:pendingMediaData[sid]?.foto||null,
    video:pendingMediaData[sid]?.video||null,
    setsDone:[]});
  delete pendingMediaData[sid];
  saveAcad(); haptic('success'); showToast('✅ Exercício adicionado!');
  renderSeries();
  setTimeout(()=>document.getElementById('serie-'+sid)?.classList.add('open'),50);
}
function exerciseHTML(sid,ex){
  const sets=Array.from({length:ex.series},(_,i)=>i);
  return `<div class="exercise-item">
    <div class="exercise-media" onclick="${ex.foto?`openLightbox('img','${ex.foto}')`:ex.video?`openLightbox('video','${ex.video}')`:''}" >
      ${ex.foto?`<img src="${ex.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:6px"/>`:ex.video?'▶️':'🏋️'}
    </div>
    <div class="exercise-info">
      <div class="exercise-nome">${escHtml(ex.nome)}</div>
      <div class="exercise-detail">${ex.series}x${ex.reps}${ex.carga?' · '+ex.carga+'kg':''}${ex.obs?' · '+escHtml(ex.obs):''}</div>
      <div class="exercise-sets">
        ${sets.map(i=>{const done=(ex.setsDone||[]).includes(i);
          return `<button class="set-pill ${done?'done':''}" onclick="toggleSet(${sid},${ex.id},${i})">${done?'✓':''}S${i+1}</button>`;
        }).join('')}
      </div>
    </div>
    <button class="icon-btn" onclick="deleteExercicio(${sid},${ex.id})">🗑️</button>
  </div>`;
}
function toggleSet(sid,exId,i){
  const s=series.find(s=>s.id===sid),ex=s?.exercicios.find(e=>e.id===exId); if(!ex) return;
  if(!ex.setsDone) ex.setsDone=[];
  const idx=ex.setsDone.indexOf(i);
  idx>=0?ex.setsDone.splice(idx,1):ex.setsDone.push(i);
  saveAcad(); haptic('light'); renderSeries();
  setTimeout(()=>document.getElementById('serie-'+sid)?.classList.add('open'),50);
}
function deleteExercicio(sid,exId){
  const s=series.find(s=>s.id===sid); if(!s) return;
  s.exercicios=s.exercicios.filter(e=>e.id!==exId);
  saveAcad(); haptic('medium'); showToast('🗑️ Removido'); renderSeries();
  setTimeout(()=>document.getElementById('serie-'+sid)?.classList.add('open'),50);
}

// Objetivo
function setObjetivo(btn,obj){
  objetivo=obj; saveAcad();
  document.querySelectorAll('.obj-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  haptic('success'); showToast('🎯 Objetivo definido!'); renderNutri();
}
function renderObjetivo(){
  if(objetivo) document.querySelector(`[data-obj="${objetivo}"]`)?.classList.add('active');
}

// Medidas
function addMedida(){
  const peso=parseFloat(document.getElementById('med-peso')?.value);
  if(!peso){shakeEl('med-peso');return;}
  medidas.unshift({id:Date.now(),peso,
    gordura:parseFloat(document.getElementById('med-gordura')?.value)||null,
    cintura:parseFloat(document.getElementById('med-cintura')?.value)||null,
    braco:parseFloat(document.getElementById('med-braco')?.value)||null,
    peito:parseFloat(document.getElementById('med-peito')?.value)||null,
    perna:parseFloat(document.getElementById('med-perna')?.value)||null,
    fase:document.getElementById('med-fase')?.value||'inicial',
    data:document.getElementById('med-data')?.value||new Date().toISOString().slice(0,10)});
  saveAcad(); haptic('success'); showToast('📏 Medida registrada!');
  ['med-peso','med-gordura','med-cintura','med-braco','med-peito','med-perna'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  renderMedidas();
}
function renderMedidas(){
  const el=document.getElementById('medidas-list'); if(!el) return;
  if(!medidas.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">⚖️</div><p>Nenhuma medida registrada</p></div>`;return;}
  const fn={inicial:'📍 Inicial',progresso:'📈 Progresso',final:'🏆 Final'};
  el.innerHTML=medidas.map(m=>{
    const dt=m.data?new Date(m.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'2-digit'}):'';
    return `<div class="medida-item">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem">
        <span class="medida-fase-badge fase-${m.fase}">${fn[m.fase]||m.fase}</span>
        <div style="display:flex;gap:0.4rem;align-items:center">
          <span style="font-size:0.7rem;color:var(--text-muted)">${dt}</span>
          <button class="icon-btn" onclick="deleteMedida(${m.id})">🗑️</button>
        </div>
      </div>
      <div class="medida-grid">
        <div class="medida-cell"><span class="val">${m.peso}kg</span><span class="lbl">Peso</span></div>
        ${m.gordura?`<div class="medida-cell"><span class="val">${m.gordura}%</span><span class="lbl">Gordura</span></div>`:''}
        ${m.cintura?`<div class="medida-cell"><span class="val">${m.cintura}cm</span><span class="lbl">Cintura</span></div>`:''}
        ${m.braco?`<div class="medida-cell"><span class="val">${m.braco}cm</span><span class="lbl">Braço</span></div>`:''}
        ${m.peito?`<div class="medida-cell"><span class="val">${m.peito}cm</span><span class="lbl">Peito</span></div>`:''}
        ${m.perna?`<div class="medida-cell"><span class="val">${m.perna}cm</span><span class="lbl">Perna</span></div>`:''}
      </div>
    </div>`;
  }).join('');
  renderPesoChart();
}
function deleteMedida(id){medidas=medidas.filter(m=>m.id!==id);saveAcad();haptic('medium');showToast('🗑️ Removida');renderMedidas();}
function renderPesoChart(){
  const ctx=document.getElementById('pesoChart'); if(!ctx||medidas.length<2) return;
  const sorted=[...medidas].sort((a,b)=>a.data.localeCompare(b.data));
  if(pesoChartInst) pesoChartInst.destroy();
  pesoChartInst=new Chart(ctx,{type:'line',data:{
    labels:sorted.map(m=>new Date(m.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})),
    datasets:[{label:'Peso (kg)',data:sorted.map(m=>m.peso),borderColor:'#ff6b2b',backgroundColor:'rgba(255,107,43,0.1)',
      borderWidth:2.5,pointBackgroundColor:'#ff6b2b',pointBorderColor:'#2a1a0e',pointBorderWidth:2,pointRadius:5,tension:0.3,fill:true}]
  },options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:'#e8dfd0'}},x:{grid:{display:false}}}}});
}

// Nutrição
const PLANOS={
  emagrecer:{titulo:'🔥 Plano para Emagrecer',kcal:'1400–1800 kcal/dia · Déficit calórico',
    refeicoes:[{hora:'07:00',nome:'Café da manhã',kcal:300,alimentos:'Omelete de claras + pão integral + café s/ açúcar'},
      {hora:'10:00',nome:'Lanche manhã',kcal:150,alimentos:'Fruta + chá verde'},
      {hora:'12:30',nome:'Almoço',kcal:500,alimentos:'Frango grelhado + arroz integral + salada'},
      {hora:'16:00',nome:'Lanche tarde',kcal:200,alimentos:'Iogurte grego + granola light'},
      {hora:'19:30',nome:'Jantar',kcal:400,alimentos:'Peixe grelhado + batata-doce + salada'},
      {hora:'22:00',nome:'Ceia',kcal:100,alimentos:'Caseína ou iogurte + castanhas'}],
    dicas:['Beba 2–3L de água/dia','Reduza carboidratos simples','Priorize proteínas magras','Evite frituras']},
  massa:{titulo:'💪 Plano para Ganhar Massa',kcal:'2800–3500 kcal/dia · Superávit calórico',
    refeicoes:[{hora:'07:00',nome:'Café da manhã',kcal:600,alimentos:'Ovos (4) + aveia + mel + pão integral + suco'},
      {hora:'10:00',nome:'Lanche manhã',kcal:400,alimentos:'Banana + pasta de amendoim + whey + leite'},
      {hora:'12:30',nome:'Almoço',kcal:800,alimentos:'Frango/carne + arroz + feijão + legumes'},
      {hora:'15:30',nome:'Pré-treino',kcal:350,alimentos:'Batata-doce + frango ou banana + whey'},
      {hora:'19:00',nome:'Pós-treino',kcal:400,alimentos:'Whey protein + banana + arroz branco'},
      {hora:'20:30',nome:'Jantar',kcal:700,alimentos:'Carne vermelha magra + macarrão integral + legumes'},
      {hora:'23:00',nome:'Ceia',kcal:300,alimentos:'Caseína + amendoim ou queijo cottage'}],
    dicas:['Coma de 3 em 3 horas','Proteínas 2g/kg peso','Carboidratos complexos pós-treino','Durma 7–9h']},
  definir:{titulo:'✂️ Plano para Definição',kcal:'2000–2400 kcal/dia · Recomposição corporal',
    refeicoes:[{hora:'07:00',nome:'Café da manhã',kcal:400,alimentos:'Ovos + aveia + fruta vermelha + café'},
      {hora:'10:00',nome:'Lanche manhã',kcal:200,alimentos:'Iogurte grego + frutas vermelhas'},
      {hora:'12:30',nome:'Almoço',kcal:600,alimentos:'Frango/peixe + arroz integral + salada + azeite'},
      {hora:'15:30',nome:'Pré-treino',kcal:250,alimentos:'Banana + whey ou claras de ovo'},
      {hora:'19:00',nome:'Pós-treino',kcal:300,alimentos:'Whey protein + arroz branco'},
      {hora:'20:30',nome:'Jantar',kcal:500,alimentos:'Salmão/frango + vegetais + batata-doce'},
      {hora:'23:00',nome:'Ceia',kcal:150,alimentos:'Caseína ou queijo cottage'}],
    dicas:['Ciclagem de carboidratos nos dias de treino','Proteína alta ~2,2g/kg','Aeróbico em jejum pode ajudar','Hidratação é fundamental']},
  manter:{titulo:'⚖️ Plano para Manutenção',kcal:'2200–2600 kcal/dia · Balanço energético',
    refeicoes:[{hora:'07:00',nome:'Café da manhã',kcal:450,alimentos:'Pão integral + ovos + fruta + café'},
      {hora:'10:00',nome:'Lanche manhã',kcal:200,alimentos:'Castanhas + fruta'},
      {hora:'12:30',nome:'Almoço',kcal:700,alimentos:'Proteína + arroz + feijão + salada'},
      {hora:'16:00',nome:'Lanche tarde',kcal:250,alimentos:'Iogurte + granola'},
      {hora:'20:00',nome:'Jantar',kcal:600,alimentos:'Proteína + legumes + carboidrato moderado'},
      {hora:'22:30',nome:'Ceia',kcal:200,alimentos:'Iogurte ou caseína'}],
    dicas:['Mantenha consistência nas refeições','Varie as fontes de proteína','Equilibre macro e micronutrientes','Ouça seu corpo']}
};
function renderNutri(){
  const el=document.getElementById('plano-nutri'),lbl=document.getElementById('nutri-obj-label');
  if(!el) return;
  if(!objetivo||!PLANOS[objetivo]){
    el.innerHTML=`<div class="empty-state"><div class="empty-icon">🎯</div><p>Defina seu objetivo na aba <strong>Corpo</strong></p></div>`;
    if(lbl) lbl.textContent='Defina seu objetivo na aba Corpo';
    renderRefeicoes(); return;
  }
  const p=PLANOS[objetivo];
  if(lbl) lbl.textContent=p.kcal;
  el.innerHTML=`<div class="plano-card">
    <div class="plano-header">${p.titulo}</div>
    ${p.refeicoes.map(r=>`<div class="plano-refeicao">
      <span class="plano-ref-hora">${r.hora}</span>
      <div class="plano-ref-info"><div class="plano-ref-nome">${r.nome}</div><div class="plano-ref-alimentos">${r.alimentos}</div></div>
      <span class="plano-ref-kcal">${r.kcal}kcal</span>
    </div>`).join('')}
  </div>
  <div class="card-acad"><div class="card-acad-header">💡 Dicas</div>
    <div style="margin-top:0.6rem">${p.dicas.map(d=>`<div style="display:flex;gap:0.5rem;padding:0.3rem 0;font-size:0.85rem"><span>✅</span><span>${d}</span></div>`).join('')}</div>
  </div>`;
  renderRefeicoes();
}
function addRefeicao(){
  const desc=document.getElementById('ref-desc')?.value.trim();
  if(!desc){shakeEl('ref-desc');return;}
  refeicoes.unshift({id:Date.now(),desc,
    tipo:document.getElementById('ref-tipo')?.value||'almoco',
    kcal:parseInt(document.getElementById('ref-kcal')?.value)||0,
    data:new Date().toISOString().slice(0,10)});
  saveAcad();
  document.getElementById('ref-desc').value='';
  document.getElementById('ref-kcal').value='';
  haptic('success'); showToast('🍽️ Refeição registrada!'); renderRefeicoes();
}
const TIPO_ICONS={cafe:'☀️',lanche1:'🍎',almoco:'🍽️',lanche2:'🍌',jantar:'🌙',ceia:'🌛',pretrein:'⚡',postrein:'💪'};
const TIPO_NAMES={cafe:'Café',lanche1:'Lanche manhã',almoco:'Almoço',lanche2:'Lanche tarde',jantar:'Jantar',ceia:'Ceia',pretrein:'Pré-treino',postrein:'Pós-treino'};
function renderRefeicoes(){
  const el=document.getElementById('refeicoes-list'); if(!el) return;
  const hoje=new Date().toISOString().slice(0,10);
  const hj=refeicoes.filter(r=>r.data===hoje);
  if(!hj.length){el.innerHTML=`<div class="empty-state"><div class="empty-icon">🍽️</div><p>Nenhuma refeição hoje</p></div>`;return;}
  const tot=hj.reduce((s,r)=>s+(r.kcal||0),0);
  el.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:0.82rem;color:var(--text-muted);padding:0.3rem 0 0.6rem">
    <span>${hj.length} refeições hoje</span><span style="font-family:var(--font-head);font-weight:800;color:var(--accent)">${tot} kcal</span>
  </div>`+hj.map(r=>`<div class="refeicao-item">
    <div class="ref-tipo-badge">${TIPO_ICONS[r.tipo]||'🍽️'}</div>
    <div class="ref-info"><div class="ref-desc">${escHtml(r.desc)}</div><div class="ref-meta">${TIPO_NAMES[r.tipo]||r.tipo}</div></div>
    ${r.kcal?`<div class="ref-kcal">${r.kcal}kcal</div>`:''}
    <button class="icon-btn" onclick="deleteRefeicao(${r.id})">🗑️</button>
  </div>`).join('');
  renderKcalChart();
}
function deleteRefeicao(id){refeicoes=refeicoes.filter(r=>r.id!==id);saveAcad();haptic('medium');showToast('🗑️ Removida');renderRefeicoes();}
function renderKcalChart(){
  const ctx=document.getElementById('kcalChart'); if(!ctx) return;
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10);});
  const vals=days.map(d=>refeicoes.filter(r=>r.data===d).reduce((s,r)=>s+(r.kcal||0),0));
  if(kcalChartInst) kcalChartInst.destroy();
  kcalChartInst=new Chart(ctx,{type:'bar',data:{
    labels:days.map(d=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'short'})),
    datasets:[{label:'Kcal',data:vals,backgroundColor:'#ff6b2b99',borderColor:'#ff6b2b',borderWidth:2,borderRadius:6}]
  },options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#e8dfd0'}},x:{grid:{display:false}}}}});
}

// =====================================================
// INIT
// =====================================================
function init() {
  updateDateTime();
  const fd=document.getElementById('fin-data'); if(fd) fd.value=new Date().toISOString().slice(0,10);
  const md=document.getElementById('med-data'); if(md) md.value=new Date().toISOString().slice(0,10);
  renderTasks();
  renderFinancas();
  renderCompras();
  renderWeekDays();
  renderSeries();
  renderObjetivo();
  renderNutri();
  renderMedidas();
  renderRefeicoes();
}
