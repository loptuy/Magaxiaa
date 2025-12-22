# Carteira — Testes e Instruções

Arquivos principais nesta pasta:
- `app.js` — lógica de carteira (persistência e sincronização)
- `deposito.html` — formulário de depósito
- `carteira.html` — visualização de saldo e transações
- `produtos.html` — comprar produtos (integra com `wallet.purchase()`)
- `test_wallet.js` — script Node que simula `localStorage` e testa `app.js`

Como testar localmente (modo rápido)
1. Abra `deposito.html` e `carteira.html` em abas do mesmo navegador (arraste os arquivos ou use `Ctrl+O`).
2. Faça um depósito em `deposito.html` (ex.: R$200).
3. Abra `produtos.html` e clique em "Investir" em um produto; se houver saldo suficiente, a compra será efetuada e registrada em `meusAtivos`.
4. Volte para `carteira.html` — o saldo e o histórico serão atualizados automaticamente.

Testes automatizados (Node.js)
- Recomendado para validar a lógica sem abrir o navegador.
- Pré-requisito: ter `node` instalado.

No PowerShell (na pasta `carteira`) execute:

```powershell
cd "c:\Users\Kalebi\Desktop\KALEBI SDC\ja corrigido\carteira"
node test_wallet.js
```

O script `test_wallet.js` cria um ambiente simulado, carrega `app.js` e executa:
- Depósito de R$200
- Compra de R$70
- Verifica que o saldo final é R$130 e que as transações foram registradas

Se vir `TESTES PASSARAM ✅`, a integração básica está funcionando.

Observações profissionais
- Esta implementação usa `localStorage` + `BroadcastChannel` e é adequada apenas para testes locais e um único usuário (ou múltiplas abas do mesmo navegador).
- Para persistência real e múltiplos usuários, integrar com um backend (API + banco de dados) é necessário.

Próximos passos sugeridos
- Eu posso conectar isso a um backend (API) para persistência multiusuário.
- Posso também adicionar autenticação simples e transformar `meusAtivos` em registros vinculados ao usuário.

Se quiser, eu executo os passos finais agora (ex.: rodar o teste aqui, capturar logs, ou preparar o deploy local).