// Simple wallet API using localStorage
(function(){
  const BALANCE_KEY = 'wallet_balance';
  const TX_KEY = 'wallet_transactions';
  const UPDATE_KEY = 'wallet_last_update';

  function getStoredBalance(){
    const v = localStorage.getItem(BALANCE_KEY);
    return v ? parseFloat(v) : 0;
  }
  function setStoredBalance(v){
    localStorage.setItem(BALANCE_KEY, String(Math.round(Number(v)*100)/100));
    // touch update key to notify other tabs
    localStorage.setItem(UPDATE_KEY, Date.now());
  }

  function getTransactions(){
    try{
      return JSON.parse(localStorage.getItem(TX_KEY) || '[]');
    }catch(e){ return []; }
  }

  function setTransactions(txs){
    localStorage.setItem(TX_KEY, JSON.stringify(txs || []));
    localStorage.setItem(UPDATE_KEY, Date.now());
  }

  function getBalance(){ return getStoredBalance(); }
  function addTransaction(amount, description){
    const txs = getTransactions();
    const tx = { amount: Number(amount), description: description || '', timestamp: Date.now() };
    txs.push(tx);
    setTransactions(txs);
    const newBal = Math.round((getStoredBalance() + Number(amount)) * 100) / 100;
    setStoredBalance(newBal);
    // dispatch in-page event
    try{ window.dispatchEvent(new Event('walletUpdate')); }catch(e){}
  }

  function onWalletUpdate(cb){
    if(typeof cb !== 'function') return;
    window.addEventListener('walletUpdate', cb);
    window.addEventListener('storage', (e)=>{
      if(e.key === UPDATE_KEY) cb();
    });
  }

  // small auth helpers for local fallback (login/register)
  function localRegister(phone, pass){
    const myCode = 'VAST-'+Date.now().toString(36).toUpperCase();
    const user = { user: phone, phone, pass, myCode, createdAt: Date.now() };
    localStorage.setItem('vast_userdata', JSON.stringify(user));
    const token = 'local-'+Date.now();
    localStorage.setItem('auth_token', token);
    localStorage.setItem('vast_logged','1');
    return { token, user };
  }

  function localLogin(phone, pass){
    const d = JSON.parse(localStorage.getItem('vast_userdata')||'{}');
    if(d && d.phone === phone && d.pass === pass){
      const token = 'local-'+Date.now();
      localStorage.setItem('auth_token', token);
      localStorage.setItem('vast_logged','1');
      return { token, user: d };
    }
    return null;
  }

  function localLogout(){
    localStorage.removeItem('auth_token');
    localStorage.removeItem('vast_logged');
  }

  // expose
  window.getBalance = getBalance;
  window.getTransactions = getTransactions;
  window.addTransaction = addTransaction;
  window.onWalletUpdate = onWalletUpdate;
  window.walletApi = {
    getWallet: async ()=>({ balance: getBalance(), transactions: getTransactions() }),
    login: async (phone, pass)=>{
      // try remote API if configured
      if(window.API_BASE && window.API_BASE.indexOf('http')===0){
        try{
          const res = await fetch((window.API_BASE||'')+`/auth/login`,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({phone,pass}) });
          if(res.ok) return await res.json();
        }catch(e){}
      }
      // fallback local
      return localLogin(phone, pass);
    },
    register: async (phone, pass)=>{
      if(window.API_BASE && window.API_BASE.indexOf('http')===0){
        try{
          const res = await fetch((window.API_BASE||'')+`/auth/register`,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({phone,pass}) });
          if(res.ok) return await res.json();
        }catch(e){}
      }
      return localRegister(phone, pass);
    },
    logout: ()=>{ localLogout(); }
  };

})();
// app.js — persistência de carteira e sincronização entre abas
const KEY_TX = 'wallet_transactions_v2';
const CHANNEL_NAME = 'wallet_channel_v2';

function formatCurrency(value){
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value) || 0);
}

function getTransactions(){
  try{ return JSON.parse(localStorage.getItem(KEY_TX) || '[]'); }catch(e){ return []; }
}

function saveTransactions(arr){
  localStorage.setItem(KEY_TX, JSON.stringify(arr));
}

function computeBalance(){
  const txs = getTransactions();
  return txs.reduce((s,t)=> s + Number(t.amount || 0), 0);
}

function getBalance(){ return Number(computeBalance()); }

function _pushTx(tx){
  const txs = getTransactions();
  txs.unshift(tx);
  saveTransactions(txs);
  notifyUpdate();
  return tx;
}

function addTransaction(amount, description){
  amount = Number(amount);
  if (!isFinite(amount) || amount === 0) return null;
  const now = new Date().toISOString();
  const tx = { id: Date.now() + Math.floor(Math.random()*1000), amount: Number(amount.toFixed(2)), date: now, description: description||'Transação' };
  return _pushTx(tx);
}

function purchase(amount, product){
  amount = Number(amount);
  if (!isFinite(amount) || amount <= 0) return { error: 'Valor inválido' };
  const bal = getBalance();
  if (bal < amount) return { error: 'Saldo insuficiente' };
  const desc = product && product.name ? `Compra: ${product.name}` : 'Compra';
  const tx = { id: Date.now() + Math.floor(Math.random()*1000), amount: Number((-amount).toFixed(2)), date: new Date().toISOString(), description: desc, productId: product && product.id };
  _pushTx(tx);
  return { ok: true, tx, balance: getBalance() };
}

function resetWallet(){ localStorage.removeItem(KEY_TX); notifyUpdate(); }

function notifyUpdate(){
  try{
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage({ type: 'wallet:update', balance: getBalance() });
    bc.close();
  }catch(e){ /* ignore */ }
  try{ localStorage.setItem('__wallet_last_update_v2', Date.now()); }catch(e){}
}

// Observer helpers
const _walletObservers = new Set();
function onWalletUpdate(cb){ if (typeof cb === 'function') _walletObservers.add(cb); }
function offWalletUpdate(cb){ _walletObservers.delete(cb); }
function _emitWalletUpdate(){ _walletObservers.forEach(cb=>{ try{ cb(); }catch(e){ console.error(e); } }); }

// Listen for BroadcastChannel
try{
  const bc = new BroadcastChannel(CHANNEL_NAME);
  bc.onmessage = (ev)=>{ if (ev.data && ev.data.type === 'wallet:update') _emitWalletUpdate(); };
}catch(e){ /* ignore */ }

// Listen for storage events (other tabs)
window.addEventListener('storage', (e)=>{ if (e.key === '__wallet_last_update_v2') _emitWalletUpdate(); });

// Export small API to window for pages
window.wallet = {
  getBalance,
  getTransactions,
  addTransaction,
  purchase,
  resetWallet,
  formatCurrency
};

// Also expose helper functions for pages
window.formatCurrency = formatCurrency;
window.getBalance = getBalance;
window.getTransactions = getTransactions;
window.addTransaction = addTransaction;
window.purchase = purchase;
window.onWalletUpdate = onWalletUpdate;

// Small helper to render transactions into a container element
window.renderTransactionsInto = function(container){
  if (!container) return;
  const txs = getTransactions();
  if (txs.length === 0) { container.innerHTML = '<div class="empty">Nenhuma transação</div>'; return; }
  const rows = txs.map(tx => {
    const date = new Date(tx.date).toLocaleString('pt-BR');
    const amount = formatCurrency(tx.amount);
    const sign = tx.amount >= 0 ? 'plus' : 'minus';
    const desc = tx.description ? `<div class="tx-desc">${escapeHtml(tx.description)}</div>` : '';
    return `<div class="tx"><div><div class="tx-amount ${sign}">${amount}</div>${desc}</div><div class="tx-date">${date}</div></div>`;
  });
  container.innerHTML = rows.join('');
};

function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// Authentication helpers
window.getAuthToken = function(){ return localStorage.getItem('auth_token') || null; };
window.logout = function(){ localStorage.removeItem('auth_token'); localStorage.removeItem('vast_logged'); try{ window.location.href = 'login.html'; }catch(e){} };

// small helper to show token in UI (if element with id 'authToken' exists)
window.showAuthTokenIfAny = function(){
  const el = document.getElementById('authToken');
  if(!el) return;
  const t = window.getAuthToken();
  el.textContent = t ? (t.slice(0,8) + '…') : 'nenhum';
};
