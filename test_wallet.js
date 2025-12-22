// test_wallet.js — testa addTransaction e purchase de app.js em ambiente Node (vm)
const fs = require('fs');
const vm = require('vm');

const appCode = fs.readFileSync('app.js', 'utf8');

// minimal window shim
const sandbox = {
  console: console,
  Date: Date,
  Number: Number,
  String: String,
  Math: Math,
  setInterval: setInterval,
  clearInterval: clearInterval,
};

// storage listeners storage
sandbox.window = {};
sandbox.window._storageListeners = [];
sandbox.window.addEventListener = function(name, cb){ if(name === 'storage') sandbox.window._storageListeners.push(cb); };

// BroadcastChannel shim
(function(){
  function BroadcastChannel(name){
    this.name = name;
    this.onmessage = null;
    BroadcastChannel.channels = BroadcastChannel.channels || {};
    BroadcastChannel.channels[name] = BroadcastChannel.channels[name] || [];
    BroadcastChannel.channels[name].push(this);
  }
  BroadcastChannel.prototype.postMessage = function(msg){
    const list = BroadcastChannel.channels[this.name] || [];
    list.forEach(ch => { if(ch !== this && typeof ch.onmessage === 'function') ch.onmessage({ data: msg }); });
  };
  BroadcastChannel.prototype.close = function(){
    const list = BroadcastChannel.channels[this.name] || [];
    const i = list.indexOf(this);
    if(i >= 0) list.splice(i,1);
  };
  sandbox.window.BroadcastChannel = BroadcastChannel;
})();

// localStorage shim
(function(){
  function LocalStorage(){ this.store = {}; }
  LocalStorage.prototype.getItem = function(k){ return this.store.hasOwnProperty(k) ? this.store[k] : null; };
  LocalStorage.prototype.setItem = function(k,v){ this.store[k] = String(v); try{ sandbox.window._storageListeners.forEach(fn=>{ try{ fn({ key: k, newValue: String(v) }); }catch(e){} }); }catch(e){} };
  LocalStorage.prototype.removeItem = function(k){ delete this.store[k]; };
  LocalStorage.prototype.clear = function(){ this.store = {}; };
  sandbox.window.localStorage = new LocalStorage();
})();

// expose global localStorage too (some code may reference global localStorage)
sandbox.localStorage = sandbox.window.localStorage;

const context = vm.createContext(sandbox);

// run app.js in context
vm.runInContext(appCode, context);

// helpers to call into the vm
const getBalance = () => vm.runInContext('getBalance()', context);
const addTransaction = (amt, desc) => vm.runInContext(`addTransaction(${amt}, ${JSON.stringify(desc||'')})`, context);
const purchase = (amt, prod) => vm.runInContext(`purchase(${amt}, ${JSON.stringify(prod||{})})`, context);
const getTransactions = () => vm.runInContext('getTransactions()', context);

// Test sequence
console.log('Saldo inicial:', getBalance());
addTransaction(200, 'Depósito teste');
console.log('Após depósito de 200 -> saldo:', getBalance());
const res1 = purchase(70, { id: 'p_test', name: 'Produto Teste' });
console.log('Resultado purchase(70):', res1);
console.log('Saldo após compra 70 ->', getBalance());
const txs = getTransactions();
console.log('Transações (últimas 3):', txs.slice(0,3));

// Assertions
let ok = true;
if (getBalance() !== 130) { console.error('ERRO: saldo esperado 130'); ok = false; }
if (!(Array.isArray(txs) && txs.length >= 2)) { console.error('ERRO: espera pelo menos 2 transações'); ok = false; }
const last = txs[0];
if (!(last && Number(last.amount) < 0 && last.description && last.description.includes('Compra'))) { console.error('ERRO: última transação deve ser compra negativa'); ok = false; }

if(ok){ console.log('\nTESTES PASSARAM ✅'); process.exit(0); } else { console.error('\nTESTES FALHARAM ❌'); process.exit(2); }
