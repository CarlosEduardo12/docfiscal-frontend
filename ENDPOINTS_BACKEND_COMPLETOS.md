# Endpoints Completos que o Backend Precisa Prover - DocFiscal

## Visão Geral
Este documento lista TODOS os endpoints que o backend precisa implementar para suportar completamente o frontend da aplicação DocFiscal. O frontend é construído em Next.js 14 e espera uma API REST com autenticação JWT.

**URL Base:**
- Desenvolvimento: `http://localhost:8000`
- Produção: `https://responsible-balance-production.up.railway.app`

---

## 🔐 ENDPOINTS DE AUTENTICAÇÃO

### 1. Registro de Usuário
**Endpoint:** `POST /api/auth/register`

**Body da Requisição:**
```json
{
  "name": "string (obrigatório)",
  "email": "string (obrigatório, formato email válido)",
  "password": "string (obrigatório, mínimo 6 caracteres)"
}
```

**Resposta de Sucesso (201):**
```json
{
  "success": true,
  "data": {
    "id": "string (UUID ou ID único)",
    "email": "string",
    "name": "string",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "message": "Usuário registrado com sucesso"
}
```

**Resposta de Erro (400/409):**
```json
{
  "success": false,
  "error": "validation_error",
  "message": "Dados inválidos fornecidos",
  "details": {
    "field_errors": {
      "email": ["Email já está em uso"],
      "password": ["Senha deve ter pelo menos 6 caracteres"]
    }
  }
}
```

**Validações Necessárias:**
- Email deve ser único no sistema
- Email deve ter formato válido
- Senha deve ter pelo menos 6 caracteres
- Nome é obrigatório

---

### 2. Login de Usuário
**Endpoint:** `POST /api/auth/login`

**Body da Requisição:**
```json
{
  "email": "string (obrigatório)",
  "password": "string (obrigatório)"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "message": "Login realizado com sucesso"
}
```

**Resposta de Erro (401):**
```json
{
  "success": false,
  "error": "invalid_credentials",
  "message": "Email ou senha incorretos"
}
```

**Especificações dos Tokens:**
- `access_token`: JWT com expiração de 15-30 minutos
- `refresh_token`: JWT com expiração de 7-30 dias
- Tokens devem conter `user_id` e `exp` (expiration)

---

### 3. Renovação de Token
**Endpoint:** `POST /api/auth/refresh`

**Body da Requisição:**
```json
{
  "refresh_token": "string (obrigatório)"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "tokens": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  },
  "message": "Token renovado com sucesso"
}
```

**Resposta de Erro (401):**
```json
{
  "success": false,
  "error": "invalid_refresh_token",
  "message": "Token de renovação inválido ou expirado"
}
```

**Comportamento Esperado:**
- Validar se o refresh_token é válido e não expirou
- Gerar novos access_token e refresh_token
- Invalidar o refresh_token antigo (opcional, mas recomendado)

---

### 4. Obter Perfil do Usuário Atual
**Endpoint:** `GET /api/auth/me`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "message": "Perfil do usuário obtido com sucesso"
}
```

**Resposta de Erro (401):**
```json
{
  "success": false,
  "error": "unauthorized",
  "message": "Token de acesso inválido ou expirado"
}
```

---

### 5. Logout de Usuário
**Endpoint:** `POST /api/auth/logout`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

**Comportamento Esperado:**
- Invalidar o access_token atual (adicionar à blacklist)
- Opcionalmente invalidar todos os refresh_tokens do usuário

---

## 📁 ENDPOINTS DE UPLOAD DE ARQUIVOS

### 6. Upload de Arquivo
**Endpoint:** `POST /api/upload`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Body da Requisição:**
- Campo `file`: Arquivo PDF (máximo 10MB)

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "upload_id": "string (UUID único)",
    "order_id": "string (UUID do pedido criado)",
    "filename": "documento.pdf",
    "file_size": 2048576,
    "status": "uploading",
    "progress": 100
  },
  "message": "Arquivo enviado com sucesso"
}
```

**Resposta de Erro (400/413/415):**
```json
{
  "success": false,
  "error": "file_too_large",
  "message": "Arquivo excede o tamanho máximo de 10MB"
}
```

**Validações Necessárias:**
- Tipo de arquivo: apenas `application/pdf`
- Tamanho máximo: 10MB (10.485.760 bytes)
- Arquivo não pode estar corrompido
- Usuário deve estar autenticado

**Comportamento Esperado:**
- Criar um novo pedido (order) com status `pending_payment`
- Salvar o arquivo temporariamente
- Retornar IDs únicos para upload e pedido

---

### 7. Progresso do Upload
**Endpoint:** `GET /api/upload/{uploadId}/progress`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "upload_id": "string",
    "progress": 100,
    "status": "completed",
    "error_message": null
  },
  "message": "Progresso obtido com sucesso"
}
```

**Status Possíveis:**
- `uploading`: Upload em andamento
- `completed`: Upload concluído
- `error`: Erro durante o upload

---

### 8. Cancelar Upload
**Endpoint:** `DELETE /api/upload/{uploadId}`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Upload cancelado com sucesso"
}
```

**Comportamento Esperado:**
- Interromper o upload se ainda estiver em andamento
- Remover arquivos temporários
- Cancelar o pedido associado

---

## 📋 ENDPOINTS DE PEDIDOS (ORDERS)

### 9. Listar Todos os Pedidos
**Endpoint:** `GET /api/orders`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Parâmetros de Query (opcionais):**
```
?page=1&limit=10&sort_by=created_at&sort_order=desc
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "string",
        "user_id": "string",
        "filename": "documento.pdf",
        "original_file_size": 2048576,
        "status": "completed",
        "payment_id": "string",
        "payment_url": null,
        "download_url": "https://api.exemplo.com/api/orders/123/download",
        "error_message": null,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:35:00Z",
        "completed_at": "2024-01-15T10:35:00Z"
      }
    ],
    "total": 25,
    "page": 1,
    "limit": 10
  },
  "message": "Pedidos obtidos com sucesso"
}
```

**Status de Pedidos Possíveis:**
- `pending_payment`: Aguardando pagamento
- `paid`: Pagamento confirmado
- `processing`: Processando conversão
- `completed`: Conversão concluída
- `failed`: Falha na conversão

---

### 10. Obter Pedido por ID
**Endpoint:** `GET /api/orders/{orderId}`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "user_id": "string",
    "filename": "documento.pdf",
    "original_file_size": 2048576,
    "status": "completed",
    "payment_id": "string",
    "payment_url": null,
    "download_url": "https://api.exemplo.com/api/orders/123/download",
    "error_message": null,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:35:00Z",
    "completed_at": "2024-01-15T10:35:00Z"
  },
  "message": "Pedido obtido com sucesso"
}
```

**Resposta de Erro (404):**
```json
{
  "success": false,
  "error": "order_not_found",
  "message": "Pedido não encontrado"
}
```

**Validações Necessárias:**
- Usuário só pode acessar seus próprios pedidos
- Pedido deve existir no sistema

---

### 11. Download do Arquivo Convertido
**Endpoint:** `GET /api/orders/{orderId}/download`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Resposta de Sucesso (200):**
- Content-Type: `text/csv` ou `application/octet-stream`
- Content-Disposition: `attachment; filename="converted-{orderId}.csv"`
- Body: Dados binários do arquivo CSV

**Resposta de Erro (404/410):**
```json
{
  "success": false,
  "error": "file_not_found",
  "message": "Arquivo não encontrado ou expirado"
}
```

**Validações Necessárias:**
- Pedido deve ter status `completed`
- Usuário deve ser o dono do pedido
- Arquivo convertido deve existir no sistema
- Considerar expiração de arquivos (ex: 30 dias)

---

### 12. Tentar Novamente Processamento
**Endpoint:** `POST /api/orders/{orderId}/retry`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "processing",
    "message": "Reprocessamento iniciado"
  },
  "message": "Tentativa de reprocessamento iniciada"
}
```

**Resposta de Erro (400):**
```json
{
  "success": false,
  "error": "invalid_status",
  "message": "Pedido deve ter status 'failed' para ser reprocessado"
}
```

**Validações Necessárias:**
- Pedido deve ter status `failed`
- Usuário deve ser o dono do pedido
- Alterar status para `processing`

---

### 13. Obter Pedidos do Usuário
**Endpoint:** `GET /api/users/{userId}/orders`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Parâmetros de Query (opcionais):**
```
?page=1&limit=10&sort_by=created_at&sort_order=desc
```

**Resposta:** Igual ao endpoint `/api/orders`, mas filtrado por usuário

**Validações Necessárias:**
- Usuário só pode acessar seus próprios pedidos
- Implementar paginação adequada

---

## 💳 ENDPOINTS DE PAGAMENTO

### 14. Iniciar Pagamento
**Endpoint:** `POST /api/orders/{orderId}/payment`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body da Requisição:**
```json
{
  "return_url": "https://app.exemplo.com/payment/success",
  "cancel_url": "https://app.exemplo.com/payment/cancel"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "payment_id": "string (ID único do pagamento)",
    "payment_url": "https://abacatepay.com/checkout/v1/redirect?pref_id=123",
    "order_id": "string",
    "amount": 10.00,
    "currency": "BRL",
    "expires_at": "2024-01-15T11:30:00Z"
  },
  "message": "Pagamento criado com sucesso"
}
```

**Resposta de Erro (400):**
```json
{
  "success": false,
  "error": "invalid_order_status",
  "message": "Pedido deve ter status 'pending_payment'"
}
```

**Integração com AbacatePay:**
- Criar pagamento no AbacatePay
- Configurar URLs de retorno e cancelamento
- Definir valor fixo (ex: R$ 50,00)
- Configurar webhook para notificações

**Validações Necessárias:**
- Pedido deve ter status `pending_payment`
- Usuário deve ser o dono do pedido
- URLs de retorno devem ser válidas

---

### 15. Status do Pagamento
**Endpoint:** `GET /api/payments/{paymentId}/status`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "payment_id": "string",
    "status": "approved",
    "order_id": "string",
    "amount": 10.00,
    "currency": "BRL",
    "error_message": null
  },
  "message": "Status do pagamento obtido"
}
```

**Status de Pagamento Possíveis:**
- `pending`: Aguardando confirmação
- `approved`: Pagamento aprovado
- `rejected`: Pagamento rejeitado
- `cancelled`: Pagamento cancelado pelo usuário
- `expired`: Link de pagamento expirado

**Comportamento Esperado:**
- Consultar status no AbacatePay
- Atualizar status do pedido se necessário
- Retornar informações atualizadas

---

### 16. Webhook de Pagamento (AbacatePay)
**Endpoint:** `POST /api/webhooks/abacatepay`

**Headers da Requisição:**
```
Content-Type: application/json
X-Abacate-Signature: string (assinatura do AbacatePay)
```

**Body da Requisição (do AbacatePay):**
```json
{
  "event": "payment.paid",
  "data": {
    "payment_id": "string",
    "status": "paid",
    "amount": 50.00,
    "external_id": "string (order_id)"
  }
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Webhook processado com sucesso"
}
```

**Comportamento Esperado:**
- Validar assinatura do AbacatePay
- Processar evento de pagamento
- Atualizar status do pedido conforme pagamento
- Se aprovado, alterar status para `paid` e iniciar processamento
- Implementar idempotência (evitar processamento duplicado)

**Eventos Suportados:**
- `payment.paid`: Pagamento confirmado
- `payment.cancelled`: Pagamento cancelado
- `payment.expired`: Pagamento expirado

---

### 17. Callback de Pagamento (Alternativo)
**Endpoint:** `POST /api/payments/{paymentId}/callback`

**Headers da Requisição:**
```
Content-Type: application/json
X-Abacate-Signature: string (assinatura do AbacatePay)
```

**Body da Requisição (do AbacatePay):**
```json
{
  "id": "string",
  "type": "payment",
  "data": {
    "id": "string"
  }
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Webhook processado com sucesso"
}
```

**Comportamento Esperado:**
- Validar assinatura do AbacatePay
- Consultar detalhes do pagamento no AbacatePay
- Atualizar status do pedido conforme pagamento
- Se aprovado, alterar status para `paid` e iniciar processamento
- Implementar idempotência (evitar processamento duplicado)

---

## 👤 ENDPOINTS DE USUÁRIO

### 18. Atualizar Perfil do Usuário
**Endpoint:** `PUT /api/users/{userId}`

**Headers da Requisição:**
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

**Body da Requisição:**
```json
{
  "name": "string (opcional)",
  "email": "string (opcional)"
}
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "name": "string",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:40:00Z"
  },
  "message": "Perfil atualizado com sucesso"
}
```

**Validações Necessárias:**
- Usuário só pode atualizar seu próprio perfil
- Email deve ser único se alterado
- Validar formato do email

---

## 📊 ENDPOINTS OPCIONAIS (FUTUROS)

### 20. Métricas do Sistema (Opcional)
**Endpoint:** `GET /api/metrics`

**Headers da Requisição:**
```
Authorization: Bearer {access_token} (admin apenas)
```

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "data": {
    "orders": {
      "total": 1250,
      "pending_payment": 45,
      "processing": 12,
      "completed": 1180,
      "failed": 13
    },
    "payments": {
      "total": 1205,
      "successful": 1180,
      "success_rate": 97.9
    },
    "performance": {
      "avg_processing_time_seconds": 45.2
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Uso:** Monitoramento e analytics do sistema (apenas para administradores)

---

### 21. Endpoints de Administração (Opcionais)
**Endpoints:** 
- `GET /api/admin/users` - Listar todos os usuários
- `GET /api/admin/orders` - Listar todos os pedidos
- `POST /api/admin/orders/{id}/process` - Forçar processamento
- `DELETE /api/admin/orders/{id}` - Deletar pedido

**Uso:** Administração do sistema (apenas para administradores)

---

## 🏥 ENDPOINT DE SAÚDE

### 19. Verificação de Saúde
**Endpoint:** `GET /health`

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Backend funcionando corretamente",
  "data": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "environment": "production"
  }
}
```

**Uso:** Verificar se o backend está funcionando

---

## 🔧 ESPECIFICAÇÕES TÉCNICAS

### Formato Padrão de Resposta
Todas as respostas devem seguir este formato:

```json
{
  "success": boolean,
  "data": object | array | null,
  "message": "string",
  "error": "string (apenas em caso de erro)",
  "details": {
    "field_errors": {
      "campo": ["mensagem de erro"]
    }
  }
}
```

### Códigos de Status HTTP
- `200`: Sucesso
- `201`: Criado (registro, upload)
- `400`: Requisição inválida
- `401`: Não autorizado
- `403`: Proibido
- `404`: Não encontrado
- `409`: Conflito (email duplicado)
- `413`: Arquivo muito grande
- `415`: Tipo de arquivo não suportado
- `429`: Muitas requisições
- `500`: Erro interno do servidor

### Headers Obrigatórios
Para endpoints autenticados:
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

### CORS
Configurar CORS para permitir:
- Origin: `http://localhost:3000` (desenvolvimento)
- Origin: domínio de produção
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Authorization, Content-Type`

### Segurança
- Validar todos os tokens JWT
- Implementar rate limiting
- Validar tipos e tamanhos de arquivo
- Sanitizar inputs
- Usar HTTPS em produção
- Implementar logs de auditoria

### Banco de Dados
Tabelas necessárias:
- `users` (id, email, name, password_hash, created_at, updated_at)
- `orders` (id, user_id, filename, file_size, status, payment_id, etc.)
- `payments` (id, order_id, payment_id, status, amount, currency, etc.)
- `uploads` (id, order_id, filename, file_size, status, progress, etc.)

### Processamento de Arquivos
- Converter PDF para CSV usando biblioteca apropriada
- Implementar fila de processamento (Redis/Celery ou similar)
- Armazenar arquivos em storage seguro (S3, Google Cloud, etc.)
- Implementar limpeza automática de arquivos antigos

---

## 📝 RESUMO DOS ENDPOINTS

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/auth/register` | ❌ | Registrar usuário |
| POST | `/api/auth/login` | ❌ | Login do usuário |
| POST | `/api/auth/refresh` | ❌ | Renovar token |
| GET | `/api/auth/me` | ✅ | Perfil atual |
| POST | `/api/auth/logout` | ✅ | Logout |
| POST | `/api/upload` | ✅ | Upload de PDF |
| GET | `/api/upload/{id}/progress` | ✅ | Progresso do upload |
| DELETE | `/api/upload/{id}` | ✅ | Cancelar upload |
| GET | `/api/orders` | ✅ | Listar pedidos |
| GET | `/api/orders/{id}` | ✅ | Detalhes do pedido |
| GET | `/api/orders/{id}/download` | ✅ | Download do CSV |
| POST | `/api/orders/{id}/retry` | ✅ | Tentar novamente |
| GET | `/api/users/{id}/orders` | ✅ | Pedidos do usuário |
| POST | `/api/orders/{id}/payment` | ✅ | Iniciar pagamento |
| GET | `/api/payments/{id}/status` | ✅ | Status do pagamento |
| POST | `/api/webhooks/abacatepay` | ❌ | Webhook AbacatePay |
| POST | `/api/payments/{id}/callback` | ❌ | Callback alternativo |
| PUT | `/api/users/{id}` | ✅ | Atualizar perfil |
| GET | `/health` | ❌ | Verificação de saúde |

**Total: 19 endpoints essenciais + 2 opcionais**

---

## 🚀 PRÓXIMOS PASSOS

1. **Implementar autenticação JWT** com access/refresh tokens
2. **Configurar integração com AbacatePay** para pagamentos
3. **Implementar processamento de PDF para CSV**
4. **Configurar storage de arquivos** (local ou cloud)
5. **Implementar sistema de filas** para processamento assíncrono
6. **Configurar banco de dados** com as tabelas necessárias
7. **Implementar logs e monitoramento**
8. **Configurar ambiente de produção** com HTTPS e domínio

Este documento serve como especificação completa para o desenvolvimento do backend. Todos os endpoints listados são necessários para o funcionamento completo da aplicação frontend.