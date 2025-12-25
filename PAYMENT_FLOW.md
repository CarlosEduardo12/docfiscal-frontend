# 🔄 Fluxo de Pagamento - DocFiscal

## 📋 Visão Geral

O sistema agora possui um fluxo completo de pagamento com monitoramento em tempo real e redirecionamentos automáticos.

## 🛣️ Rotas Criadas

### 1. `/payment/success` - Rota de Retorno
**Quando é usada:** Quando o usuário retorna do AbacatePay (sucesso ou cancelamento)

**Funcionalidades:**
- ✅ Verifica o status do pagamento via API
- ✅ Polling automático a cada 3 segundos se pendente
- ✅ Redireciona para `/payment/complete` quando pagamento confirmado
- ✅ Mostra mensagens apropriadas para cada status
- ✅ Permite tentar novamente se cancelado/expirado

**Estados:**
- `checking` - Verificando status inicial
- `pending` - Pagamento ainda pendente (continua verificando)
- `paid` - Pagamento confirmado (redireciona para complete)
- `cancelled` - Pagamento cancelado/expirado
- `error` - Erro ao verificar status

### 2. `/payment/complete` - Rota de Conclusão
**Quando é usada:** Após confirmação do pagamento

**Funcionalidades:**
- ✅ Verifica status do pagamento
- ✅ Monitora processamento do arquivo
- ✅ Barra de progresso visual (0-100%)
- ✅ Polling do status do pedido a cada 3 segundos
- ✅ Auto-download quando conversão completa
- ✅ Mostra diferentes estados do processo

**Estados:**
- `checking` - Verificando pagamento
- `waiting` - Aguardando confirmação
- `processing` - Processando arquivo (com barra de progresso)
- `completed` - Conversão concluída (com download)
- `failed` - Erro no processamento

### 3. `/payment/cancel` - Rota de Cancelamento
**Quando é usada:** Quando o usuário cancela explicitamente no AbacatePay

**Funcionalidades:**
- ✅ Mostra mensagem de cancelamento
- ✅ Permite tentar novamente
- ✅ Retorna ao dashboard

## 🔄 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO NO FRONTEND (/)                                      │
│    - Seleciona arquivo PDF                                      │
│    - Clica em "Enviar PDF para Conversão"                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. UPLOAD DO ARQUIVO                                            │
│    POST /api/upload                                             │
│    ✅ Retorna: { order_id: "xxx" }                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. CRIAR PAGAMENTO                                              │
│    POST /api/orders/{order_id}/payment                          │
│    Body: {                                                      │
│      return_url: "http://localhost:3001/payment/complete"      │
│      cancel_url: "http://localhost:3001/payment/success"       │
│    }                                                            │
│    ✅ Retorna: {                                                │
│         payment_id: "yyy",                                      │
│         payment_url: "https://abacatepay.com/..."              │
│       }                                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. REDIRECIONAR PARA ABACATEPAY                                │
│    window.open(payment_url, '_blank')                           │
│    - Usuário vê QR Code PIX                                     │
│    - Usuário paga via PIX                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5A. PAGAMENTO CONCLUÍDO                                         │
│     AbacatePay redireciona para:                                │
│     → /payment/complete?payment_id=yyy&order_id=xxx             │
│                                                                 │
│ 5B. PAGAMENTO CANCELADO                                         │
│     AbacatePay redireciona para:                                │
│     → /payment/success?payment_id=yyy&order_id=xxx              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. VERIFICAÇÃO DE STATUS (/payment/success)                    │
│    GET /api/payments/{payment_id}/status                        │
│    - Se "paid" → Redireciona para /payment/complete            │
│    - Se "pending" → Continua verificando (polling 3s)          │
│    - Se "cancelled" → Mostra opção de tentar novamente         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. MONITORAMENTO DE PROCESSAMENTO (/payment/complete)          │
│    GET /api/orders/{order_id}                                   │
│    Polling a cada 3 segundos:                                   │
│    - "pending_payment" → Aguardando                             │
│    - "processing" → Mostra barra de progresso                   │
│    - "completed" → Auto-download + botão manual                 │
│    - "failed" → Mostra erro + opção de nova conversão          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. DOWNLOAD DO ARQUIVO                                          │
│    GET /api/orders/{order_id}/download                          │
│    ✅ Arquivo CSV baixado automaticamente                       │
│    ✅ Opção de fazer nova conversão                             │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 URLs de Retorno Configuradas

### Desenvolvimento (localhost:3001)
```javascript
return_url: "http://localhost:3001/payment/complete"
cancel_url: "http://localhost:3001/payment/success"
```

### Produção (quando deployado)
```javascript
return_url: "https://seu-dominio.com/payment/complete"
cancel_url: "https://seu-dominio.com/payment/success"
```

## 📊 Monitoramento em Tempo Real

### Polling de Pagamento
- **Intervalo:** 3 segundos
- **Timeout:** 10 minutos
- **Endpoint:** `GET /api/payments/{payment_id}/status`

### Polling de Processamento
- **Intervalo:** 3 segundos
- **Timeout:** 10 minutos
- **Endpoint:** `GET /api/orders/{order_id}`

### Progresso Visual
- **Simulação:** Incremento de 10% a cada 500ms até 90%
- **Real:** Atualiza para 100% quando status = "completed"

## 🎨 Estados Visuais

### /payment/success
| Status | Ícone | Cor | Ação |
|--------|-------|-----|------|
| checking | RefreshCw (spin) | Azul | Verificando... |
| pending | RefreshCw (spin) | Azul | Continua verificando |
| paid | RefreshCw (spin) | Verde | Redireciona |
| cancelled | AlertCircle | Amarelo | Botão tentar novamente |
| error | AlertCircle | Amarelo | Botão tentar novamente |

### /payment/complete
| Status | Ícone | Cor | Ação |
|--------|-------|-----|------|
| checking | RefreshCw (spin) | Azul | Verificando... |
| waiting | Clock (pulse) | Amarelo | Aguardando... |
| processing | RefreshCw (spin) | Azul | Barra de progresso |
| completed | CheckCircle | Verde | Botão download |
| failed | RefreshCw | Vermelho | Botão nova conversão |

## 🔧 Configuração no Backend

Certifique-se de que o backend está configurado para aceitar as URLs de retorno:

```python
# No backend, ao criar pagamento no AbacatePay
payment_data = {
    "amount": 50.00,
    "return_url": request.return_url,  # Vem do frontend
    "cancel_url": request.cancel_url,  # Vem do frontend
    # ... outros campos
}
```

## ✅ Checklist de Implementação

- [x] Rota `/payment/success` criada
- [x] Rota `/payment/complete` criada
- [x] Polling de status de pagamento implementado
- [x] Polling de status de processamento implementado
- [x] Barra de progresso visual
- [x] Auto-download quando completo
- [x] Tratamento de erros
- [x] URLs de retorno configuradas no ConversionFlow
- [x] Estados visuais para cada etapa
- [x] Redirecionamentos automáticos

## 🧪 Como Testar

1. **Fazer login** no sistema
2. **Selecionar um PDF** na página inicial
3. **Clicar em "Enviar PDF para Conversão"**
4. **Clicar em "Pagar com PIX"**
5. **Abrir a aba do AbacatePay** que foi aberta
6. **Completar ou cancelar o pagamento**
7. **Observar o redirecionamento automático**
8. **Verificar o monitoramento em tempo real**
9. **Baixar o arquivo quando completo**

## 📝 Notas Importantes

- O sistema usa `window.open()` para abrir o AbacatePay em nova aba
- O polling continua mesmo se o usuário fechar a aba do AbacatePay
- Timeout de 10 minutos para evitar polling infinito
- Auto-download acontece 2 segundos após conclusão
- Todas as rotas funcionam sem autenticação (para permitir retorno do AbacatePay)
