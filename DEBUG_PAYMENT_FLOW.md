# 🔧 Debug do Fluxo de Pagamento

## 🎯 Problema Identificado

- Redirecionamento após pagamento não está voltando para a aplicação
- Pedidos não estão sendo atualizados após pagamento

## ✅ Correções Implementadas

### 1. **URLs de Retorno Corrigidas**
- ✅ Servidor agora roda em `http://localhost:3001`
- ✅ URLs de retorno atualizadas no `.env.local`
- ✅ ConversionFlow usa variáveis de ambiente como fallback

### 2. **Logs de Debug Adicionados**
- ✅ Console logs mostram URLs sendo enviadas
- ✅ Logs de criação de pagamento
- ✅ Logs de redirecionamento

### 3. **Página de Teste Criada**
- ✅ `/test-payment-urls` para testar URLs
- ✅ Verificação de configurações
- ✅ Teste completo do fluxo

## 🧪 Como Testar o Fluxo Completo

### Passo 1: Verificar Configurações
1. Acesse: `http://localhost:3001/test-payment-urls`
2. Verifique se as URLs estão corretas:
   - Return URL: `http://localhost:3001/payment/complete`
   - Cancel URL: `http://localhost:3001/payment/success`
3. Clique em "Testar Criação de Pagamento"
4. Verifique se não há erros

### Passo 2: Testar Fluxo Real
1. Acesse: `http://localhost:3001`
2. Faça login
3. Selecione um arquivo PDF
4. Clique em "Enviar PDF para Conversão"
5. Clique em "Pagar com PIX - R$ 50,00"
6. **Observe os logs no console do navegador**

### Passo 3: Verificar Logs
Abra o console do navegador (F12) e procure por:
```
🔗 URLs de retorno configuradas:
  Return URL: http://localhost:3001/payment/complete
  Cancel URL: http://localhost:3001/payment/success
  Base URL: http://localhost:3001

✅ Pagamento criado com sucesso: {...}

🔗 Abrindo URL de pagamento: https://abacatepay.com/...
```

### Passo 4: Testar Pagamento
1. Na aba do AbacatePay que abriu:
   - **Para testar sucesso:** Complete o pagamento
   - **Para testar cancelamento:** Cancele ou feche a aba
2. **Resultado esperado:** Deve redirecionar para:
   - Sucesso: `http://localhost:3001/payment/complete`
   - Cancelamento: `http://localhost:3001/payment/success`

## 🔍 Possíveis Problemas e Soluções

### Problema 1: URLs Incorretas no Backend
**Sintoma:** AbacatePay redireciona para URL errada
**Solução:** Verificar se o backend está recebendo as URLs corretas

**Debug:**
```bash
# Verificar logs do backend
# Procurar por logs de criação de pagamento
# Verificar se return_url e cancel_url estão corretos
```

### Problema 2: Backend Não Atualiza Status
**Sintoma:** Pagamento efetuado mas pedido não muda status
**Solução:** Verificar webhook do AbacatePay no backend

**Debug:**
1. Acesse: `http://localhost:3001/dashboard`
2. Clique em "Atualizar Lista" após pagamento
3. Verifique se status mudou manualmente

### Problema 3: CORS ou Configuração
**Sintoma:** Erro ao criar pagamento
**Solução:** Verificar configurações de CORS no backend

## 📊 Monitoramento em Tempo Real

### Console Logs Importantes:
```javascript
// Criação de pagamento
🔗 URLs de retorno configuradas:
✅ Pagamento criado com sucesso:

// Monitoramento de status
🔍 Verificando status do pagamento...
✅ Pagamento confirmado!

// Atualização de cache
🔄 Lista de pedidos atualizada automaticamente
```

### Network Tab (F12 > Network):
- `POST /api/orders/{id}/payment` - Criação do pagamento
- `GET /api/payments/{id}/status` - Verificação de status
- `GET /api/orders/{id}` - Status do pedido

## 🛠️ Ferramentas de Debug

### 1. Página de Teste de URLs
```
http://localhost:3001/test-payment-urls
```

### 2. Debug de Pagamento
```
http://localhost:3001/debug-payment
```

### 3. Teste de API
```
http://localhost:3001/test-api-connection
```

## 🔄 Fluxo Esperado Completo

```
1. Usuário faz upload
   ↓
2. ConversionFlow cria pagamento com URLs corretas
   ↓
3. AbacatePay abre em nova aba
   ↓
4. Usuário paga
   ↓
5. AbacatePay redireciona para: http://localhost:3001/payment/complete
   ↓
6. /payment/complete verifica status e monitora processamento
   ↓
7. Quando completo, auto-download do arquivo
   ↓
8. Dashboard atualiza automaticamente
```

## ⚠️ Checklist de Verificação

- [ ] Servidor rodando em `http://localhost:3001`
- [ ] Backend rodando em `http://localhost:8000`
- [ ] URLs no `.env.local` corretas
- [ ] Console logs aparecem durante criação de pagamento
- [ ] AbacatePay abre em nova aba
- [ ] Redirecionamento volta para localhost:3001
- [ ] Status do pedido atualiza após pagamento
- [ ] Dashboard mostra mudanças automaticamente

## 🚨 Se Ainda Não Funcionar

### Verificar Backend:
1. Logs do backend durante criação de pagamento
2. Configuração do webhook do AbacatePay
3. URLs sendo enviadas para o AbacatePay

### Verificar Frontend:
1. Console logs no navegador
2. Network tab para ver requests
3. Verificar se as páginas de retorno existem e funcionam

### Teste Manual:
1. Acesse diretamente: `http://localhost:3001/payment/success?payment_id=test&order_id=test`
2. Acesse diretamente: `http://localhost:3001/payment/complete?payment_id=test&order_id=test`
3. Verifique se as páginas carregam sem erro