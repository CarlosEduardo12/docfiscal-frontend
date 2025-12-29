# Documentação Detalhada das Atualizações do Frontend

## Resumo Executivo

Este documento detalha todas as alterações que serão feitas no frontend do DocFiscal para alinhar com a especificação OpenAPI v2.0.0 do backend. As mudanças incluem atualizações de endpoints, formatos de resposta, estruturas de dados e remoção de handlers de API mock.

## Principais Alterações por Categoria

### 1. Endpoints de Autenticação

#### Alterações nos Endpoints:
- ✅ **Mantido**: `/api/auth/register` - Endpoint correto
- ✅ **Mantido**: `/api/auth/login` - Endpoint correto  
- ✅ **Novo**: `/api/auth/refresh` - Endpoint para refresh de token
- ✅ **Novo**: `/api/auth/me` - Endpoint para perfil do usuário
- ✅ **Novo**: `/api/auth/logout` - Endpoint para logout

#### Alterações no Formato de Resposta:
```typescript
// ANTES (formato atual)
interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

// DEPOIS (novo formato padronizado)
interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
    };
  };
  message: string;
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Métodos de autenticação
- `src/hooks/useAuth.ts` - Hook de autenticação
- `src/hooks/useAuthNew.ts` - Hook de autenticação atualizado
- `src/components/auth/` - Componentes de autenticação
- `src/app/api/auth/` - **SERÁ REMOVIDO** (handlers mock)

### 2. Endpoints de Upload de Arquivos

#### Alterações nos Endpoints:
- 🔄 **Alterado**: `/api/upload` → `/api/upload/` (com barra final)
- ✅ **Novo**: `/api/upload/{upload_id}/progress` - Progresso do upload
- ✅ **Novo**: `/api/upload/{upload_id}` (DELETE) - Cancelar upload

#### Alterações no Formato de Resposta:
```typescript
// ANTES
interface UploadResponse {
  orderId: string;
  status: string;
  paymentUrl?: string;
  message: string;
}

// DEPOIS
interface UploadResponse {
  success: boolean;
  data: {
    upload_id: string;
    order_id: string;
    filename: string;
    file_size: number;
    status: string;
    payment_required: boolean;
    payment_url?: string;
  };
  message: string;
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Métodos de upload
- `src/hooks/useFileUpload.ts` - Hook de upload
- `src/components/upload/UploadArea.tsx` - Componente de upload
- `src/components/upload/UploadProgress.tsx` - Progresso do upload
- `src/app/api/upload/` - **SERÁ REMOVIDO** (handlers mock)

### 3. Endpoints de Gerenciamento de Pedidos

#### Alterações nos Endpoints:
- ✅ **Mantido**: `/api/orders` - Listar pedidos
- ✅ **Mantido**: `/api/orders/{order_id}` - Detalhes do pedido
- ✅ **Novo**: `/api/orders/{order_id}/retry` - Tentar novamente
- ✅ **Mantido**: `/api/orders/{order_id}/download` - Download

#### Alterações nos Parâmetros de Query:
```typescript
// ANTES
interface OrderParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// DEPOIS
interface OrderParams {
  page?: number;
  limit?: number;
  status?: 'pending_payment' | 'processing' | 'completed' | 'failed';
  sort?: 'created_at' | 'updated_at' | 'filename';
  order?: 'asc' | 'desc';
}
```

#### Alterações na Estrutura de Dados:
```typescript
// ANTES
interface Order {
  id: string;
  userId: string;
  filename: string;
  originalFileSize: number;
  status: OrderStatus;
  paymentId?: string;
  paymentUrl?: string;
  downloadUrl?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// DEPOIS
interface Order {
  id: string;
  user_id: string;
  filename: string;
  file_size: number;
  status: 'pending_payment' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  error_message?: string;
  download_url?: string;
  expires_at?: string;
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Métodos de pedidos
- `src/components/order/OrderStatusCard.tsx` - Card de status
- `src/components/order/OrderHistoryTable.tsx` - Tabela de histórico
- `src/app/dashboard/page.tsx` - Página do dashboard
- `src/app/api/orders/` - **SERÁ REMOVIDO** (handlers mock)

### 4. Endpoints de Pagamento

#### Alterações nos Endpoints:
- 🔄 **Alterado**: `/api/orders/{orderId}/payment` → `/api/payments/orders/{order_id}/payment`
- 🔄 **Alterado**: `/api/payments/{paymentId}/status` → `/api/payments/{payment_id}`

#### Alterações no Formato de Resposta:
```typescript
// ANTES
interface PaymentResponse {
  paymentId: string;
  paymentUrl: string;
  status: string;
  message: string;
}

// DEPOIS
interface PaymentResponse {
  success: boolean;
  data: {
    payment_id: string;
    order_id: string;
    amount: number;
    currency: string;
    payment_method: string;
    status: string;
    checkout_url: string;
    qr_code?: string;
    expires_at: string;
  };
  message: string;
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Métodos de pagamento
- `src/hooks/usePaymentFlow.ts` - Hook de fluxo de pagamento
- `src/components/payment/` - Componentes de pagamento
- `src/app/payment/` - Páginas de pagamento
- `src/app/api/payments/` - **SERÁ REMOVIDO** (handlers mock)

### 5. Novos Endpoints de Gerenciamento de Usuário

#### Novos Endpoints:
- ✅ **Novo**: `/api/users/me` (PUT) - Atualizar perfil
- ✅ **Novo**: `/api/users/me/password` (PUT) - Alterar senha

#### Novos Métodos na API:
```typescript
// Novos métodos que serão adicionados
async updateProfile(data: {
  name?: string;
  email?: string;
}): Promise<ApiResponse>

async changePassword(data: {
  current_password: string;
  new_password: string;
}): Promise<ApiResponse>
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Novos métodos de usuário
- `src/hooks/useAuth.ts` - Atualização de perfil
- Novos componentes de perfil (a serem criados)

### 6. Endpoint de Health Check

#### Novo Endpoint:
- ✅ **Novo**: `/health` - Verificação de saúde do sistema

#### Formato de Resposta:
```typescript
interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy' | 'degraded';
    storage: 'healthy' | 'unhealthy' | 'degraded';
    payment_provider: 'healthy' | 'unhealthy' | 'degraded';
  };
  uptime: string;
  errors?: string[];
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Novo método de health check
- Novos componentes de status do sistema (a serem criados)

### 7. Padronização de Formato de Resposta

#### Formato Padronizado:
```typescript
// Todas as respostas seguirão este formato
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

// Formato de erro padronizado
interface ApiError {
  success: false;
  error: string;
  message: string;
  details?: {
    field_errors?: Record<string, string[]>;
    retry_after?: number;
    guidance?: string;
  };
  request_id?: string;
}
```

#### Arquivos Afetados:
- `src/lib/api.ts` - Processamento de resposta
- `src/types/index.ts` - Interfaces de tipo
- Todos os componentes que processam respostas da API

## Arquivos que Serão Removidos

### Handlers de API Mock (Diretório completo)
- `src/app/api/auth/` - **REMOVIDO COMPLETAMENTE**
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/register/route.ts`
  - `src/app/api/auth/[...nextauth]/route.ts`

- `src/app/api/orders/` - **REMOVIDO COMPLETAMENTE**
  - `src/app/api/orders/[orderId]/route.ts`
  - `src/app/api/orders/[orderId]/payment/route.ts`

- `src/app/api/payments/` - **REMOVIDO COMPLETAMENTE**
  - `src/app/api/payments/[paymentId]/status/route.ts`
  - `src/app/api/payments/[paymentId]/callback/route.ts`

- `src/app/api/upload/` - **REMOVIDO COMPLETAMENTE**
  - Todos os handlers de upload mock

## Arquivos que Serão Modificados

### Core API e Tipos
- ✏️ `src/lib/api.ts` - **MODIFICAÇÃO EXTENSIVA**
  - Atualização de todos os métodos
  - Novos endpoints e formatos de resposta
  - Novo tratamento de erro padronizado

- ✏️ `src/types/index.ts` - **MODIFICAÇÃO EXTENSIVA**
  - Atualização de todas as interfaces
  - Novos tipos para resposta padronizada
  - Estruturas de dados atualizadas

### Hooks Personalizados
- ✏️ `src/hooks/useAuth.ts` - **MODIFICAÇÃO MODERADA**
  - Novo formato de token
  - Novos métodos de perfil

- ✏️ `src/hooks/useFileUpload.ts` - **MODIFICAÇÃO MODERADA**
  - Novo formato de resposta de upload
  - Novos campos de progresso

- ✏️ `src/hooks/usePaymentFlow.ts` - **MODIFICAÇÃO EXTENSIVA**
  - Novos endpoints de pagamento
  - Novo formato de resposta
  - Polling de status atualizado

### Componentes
- ✏️ `src/components/upload/UploadArea.tsx` - **MODIFICAÇÃO MODERADA**
  - Novo formato de resposta de upload
  - Tratamento de erro atualizado

- ✏️ `src/components/order/OrderStatusCard.tsx` - **MODIFICAÇÃO MODERADA**
  - Nova estrutura de dados de pedido
  - Novos campos de status

- ✏️ `src/components/order/OrderHistoryTable.tsx` - **MODIFICAÇÃO MODERADA**
  - Novos parâmetros de query
  - Nova estrutura de paginação

### Páginas
- ✏️ `src/app/dashboard/page.tsx` - **MODIFICAÇÃO MODERADA**
  - Novos métodos de API
  - Novo formato de dados

- ✏️ `src/app/payment/success/page.tsx` - **MODIFICAÇÃO MODERADA**
  - Novo formato de status de pagamento

- ✏️ `src/app/upload/page.tsx` - **MODIFICAÇÃO LEVE**
  - Redirecionamento atualizado

## Impacto nos Testes

### Testes que Serão Atualizados
- Todos os testes de propriedade existentes
- Testes de componente com mocks de API
- Testes de integração E2E
- Testes de hook personalizado

### Novos Testes que Serão Criados
- 38 novos testes de propriedade para validar endpoints
- Testes unitários para novos componentes
- Testes de integração para novos fluxos

## Cronograma de Implementação

### Fase 1: API Client e Tipos (Semana 1)
- Atualizar `src/lib/api.ts`
- Atualizar `src/types/index.ts`
- Criar testes de propriedade para API

### Fase 2: Componentes Core (Semana 2)
- Atualizar componentes de upload
- Atualizar componentes de pedido
- Atualizar hooks personalizados

### Fase 3: Páginas e Fluxos (Semana 3)
- Atualizar páginas principais
- Atualizar fluxos de pagamento
- Testes de integração

### Fase 4: Limpeza e Testes (Semana 4)
- Remover handlers de API mock
- Testes finais e validação
- Documentação atualizada

## Riscos e Mitigações

### Riscos Identificados:
1. **Quebra de funcionalidade existente** - Mitigado por testes abrangentes
2. **Problemas de compatibilidade** - Mitigado por implementação faseada
3. **Regressões em fluxos críticos** - Mitigado por testes E2E
4. **Problemas de performance** - Mitigado por testes de performance

### Estratégias de Mitigação:
- Implementação incremental com checkpoints
- Testes abrangentes em cada fase
- Rollback plan para cada componente
- Monitoramento contínuo durante a migração

## Conclusão

Esta atualização representa uma modernização significativa do frontend para alinhar com as melhores práticas de API REST e garantir compatibilidade total com o backend atualizado. A abordagem faseada e os testes abrangentes garantem uma migração segura e confiável.

**Total de arquivos afetados**: ~50 arquivos
**Total de arquivos removidos**: ~10 arquivos  
**Total de novos testes**: ~60 testes
**Tempo estimado**: 4 semanas
**Impacto no usuário**: Mínimo (melhorias na experiência)