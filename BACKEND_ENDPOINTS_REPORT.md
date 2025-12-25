# 🔧 Relatório de Endpoints Backend - DocFiscal

## 📊 Resumo Executivo

Com base nos testes E2E do Playwright, foram identificados **endpoints críticos** que estão falhando ou retornando erros, impactando diretamente a funcionalidade do sistema.

**Status dos Endpoints:**
- 🚨 **Múltiplos endpoints retornando 4xx/5xx**
- ⚠️ **Conectividade intermitente com backend**
- 🔍 **Endpoints críticos precisam de correção imediata**

---

## 🚨 Endpoints com Problemas Críticos

### 1. **Autenticação e Autorização**

#### 1.1 POST `/api/auth/login`
**Status:** 🔴 **FALHANDO**
**Problema:** Endpoint retornando 401/500 inconsistentemente
**Impacto:** Usuários não conseguem fazer login

**Correções Necessárias:**
```python
# Melhorar validação de credenciais
@app.post("/api/auth/login")
async def login(credentials: LoginCredentials):
    try:
        # Validar formato do email
        if not is_valid_email(credentials.email):
            raise HTTPException(
                status_code=400,
                detail="Email inválido"
            )
        
        # Buscar usuário no banco
        user = await get_user_by_email(credentials.email)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Credenciais inválidas"
            )
        
        # Verificar senha
        if not verify_password(credentials.password, user.password_hash):
            raise HTTPException(
                status_code=401,
                detail="Credenciais inválidas"
            )
        
        # Gerar tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        return {
            "success": True,
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro interno do servidor"
        )
```

#### 1.2 POST `/api/auth/register`
**Status:** 🔴 **FALHANDO**
**Problema:** Validação inadequada e erros de duplicação
**Impacto:** Novos usuários não conseguem se registrar

**Correções Necessárias:**
```python
@app.post("/api/auth/register")
async def register(user_data: RegisterData):
    try:
        # Validar dados de entrada
        validation_errors = validate_registration_data(user_data)
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail={"errors": validation_errors}
            )
        
        # Verificar se email já existe
        existing_user = await get_user_by_email(user_data.email)
        if existing_user:
            raise HTTPException(
                status_code=409,
                detail="Email já está em uso"
            )
        
        # Hash da senha
        password_hash = hash_password(user_data.password)
        
        # Criar usuário
        user = await create_user({
            "email": user_data.email,
            "name": user_data.full_name,
            "password_hash": password_hash
        })
        
        # Gerar tokens
        access_token = create_access_token(user.id)
        refresh_token = create_refresh_token(user.id)
        
        return {
            "success": True,
            "data": {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user.name
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro interno do servidor"
        )

def validate_registration_data(data: RegisterData) -> List[str]:
    errors = []
    
    if not data.full_name or len(data.full_name.strip()) < 2:
        errors.append("Nome deve ter pelo menos 2 caracteres")
    
    if not is_valid_email(data.email):
        errors.append("Email inválido")
    
    if not data.password or len(data.password) < 6:
        errors.append("Senha deve ter pelo menos 6 caracteres")
    
    if not has_letter(data.password):
        errors.append("Senha deve conter pelo menos uma letra")
    
    return errors
```

#### 1.3 POST `/api/auth/refresh`
**Status:** 🔴 **FALHANDO**
**Problema:** Tokens de refresh não estão sendo validados corretamente
**Impacto:** Usuários são deslogados prematuramente

**Correções Necessárias:**
```python
@app.post("/api/auth/refresh")
async def refresh_token(refresh_data: RefreshTokenData):
    try:
        # Validar refresh token
        payload = decode_refresh_token(refresh_data.refresh_token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail="Token de refresh inválido"
            )
        
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail="Token de refresh inválido"
            )
        
        # Verificar se usuário ainda existe
        user = await get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Usuário não encontrado"
            )
        
        # Gerar novos tokens
        new_access_token = create_access_token(user.id)
        new_refresh_token = create_refresh_token(user.id)
        
        return {
            "success": True,
            "data": {
                "access_token": new_access_token,
                "refresh_token": new_refresh_token
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro interno do servidor"
        )
```

### 2. **Upload e Processamento de Arquivos**

#### 2.1 POST `/api/upload`
**Status:** 🔴 **FALHANDO**
**Problema:** Upload de arquivos falhando com 413/500
**Impacto:** Usuários não conseguem fazer upload de PDFs

**Correções Necessárias:**
```python
@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    try:
        # Validar tipo de arquivo
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=400,
                detail="Apenas arquivos PDF são permitidos"
            )
        
        # Validar tamanho (máximo 100MB)
        max_size = 100 * 1024 * 1024  # 100MB
        file_size = 0
        content = await file.read()
        file_size = len(content)
        
        if file_size > max_size:
            raise HTTPException(
                status_code=413,
                detail="Arquivo muito grande. Máximo 100MB"
            )
        
        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Arquivo está vazio"
            )
        
        # Gerar ID único para o pedido
        order_id = generate_order_id()
        
        # Salvar arquivo temporariamente
        file_path = await save_uploaded_file(content, order_id, file.filename)
        
        # Criar registro do pedido
        order = await create_order({
            "id": order_id,
            "user_id": current_user.id,
            "filename": file.filename,
            "file_path": file_path,
            "file_size": file_size,
            "status": "pending_payment",
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "data": {
                "order_id": order.id,
                "filename": order.filename,
                "file_size": order.file_size,
                "status": order.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro no upload do arquivo"
        )
```

#### 2.2 GET `/api/orders/{order_id}`
**Status:** 🔴 **FALHANDO**
**Problema:** Endpoint retornando 404 para pedidos existentes
**Impacto:** Frontend não consegue verificar status dos pedidos

**Correções Necessárias:**
```python
@app.get("/api/orders/{order_id}")
async def get_order(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        # Buscar pedido
        order = await get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado"
            )
        
        # Verificar se o pedido pertence ao usuário
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Acesso negado"
            )
        
        # Calcular progresso se estiver processando
        progress = 0
        if order.status == "processing":
            progress = await calculate_processing_progress(order_id)
        elif order.status == "completed":
            progress = 100
        
        return {
            "success": True,
            "data": {
                "id": order.id,
                "filename": order.filename,
                "status": order.status,
                "progress": progress,
                "created_at": order.created_at.isoformat(),
                "updated_at": order.updated_at.isoformat(),
                "download_url": f"/api/orders/{order.id}/download" if order.status == "completed" else None
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get order error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao buscar pedido"
        )
```

#### 2.3 GET `/api/orders/{order_id}/download`
**Status:** 🔴 **FALHANDO**
**Problema:** Download de arquivos processados falhando
**Impacto:** Usuários não conseguem baixar arquivos convertidos

**Correções Necessárias:**
```python
@app.get("/api/orders/{order_id}/download")
async def download_file(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    try:
        # Buscar pedido
        order = await get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado"
            )
        
        # Verificar permissão
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Acesso negado"
            )
        
        # Verificar se está completo
        if order.status != "completed":
            raise HTTPException(
                status_code=400,
                detail="Arquivo ainda não está pronto para download"
            )
        
        # Verificar se arquivo existe
        output_file_path = get_output_file_path(order_id)
        if not os.path.exists(output_file_path):
            raise HTTPException(
                status_code=404,
                detail="Arquivo processado não encontrado"
            )
        
        # Gerar nome do arquivo de saída
        base_name = os.path.splitext(order.filename)[0]
        output_filename = f"{base_name}_converted.csv"
        
        return FileResponse(
            path=output_file_path,
            filename=output_filename,
            media_type="text/csv"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro no download do arquivo"
        )
```

### 3. **Sistema de Pagamentos**

#### 3.1 POST `/api/orders/{order_id}/payment`
**Status:** 🔴 **FALHANDO**
**Problema:** Criação de pagamentos falhando com AbacatePay
**Impacto:** Usuários não conseguem pagar pelos serviços

**Correções Necessárias:**
```python
@app.post("/api/orders/{order_id}/payment")
async def create_payment(
    order_id: str,
    payment_data: PaymentCreateData,
    current_user: User = Depends(get_current_user)
):
    try:
        # Buscar pedido
        order = await get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=404,
                detail="Pedido não encontrado"
            )
        
        # Verificar permissão
        if order.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Acesso negado"
            )
        
        # Verificar se já não foi pago
        if order.status != "pending_payment":
            raise HTTPException(
                status_code=400,
                detail="Pedido já foi processado"
            )
        
        # Validar URLs de retorno
        if not payment_data.return_url or not payment_data.cancel_url:
            raise HTTPException(
                status_code=400,
                detail="URLs de retorno são obrigatórias"
            )
        
        # Criar pagamento no AbacatePay
        abacate_payment = await create_abacate_payment({
            "amount": 50.00,  # R$ 50,00
            "description": f"Conversão de PDF - {order.filename}",
            "return_url": payment_data.return_url,
            "cancel_url": payment_data.cancel_url,
            "external_id": order_id
        })
        
        if not abacate_payment.get("success"):
            raise HTTPException(
                status_code=500,
                detail="Erro ao criar pagamento"
            )
        
        # Salvar dados do pagamento
        payment = await create_payment_record({
            "id": abacate_payment["data"]["payment_id"],
            "order_id": order_id,
            "amount": 50.00,
            "status": "pending",
            "payment_url": abacate_payment["data"]["payment_url"],
            "created_at": datetime.utcnow()
        })
        
        return {
            "success": True,
            "data": {
                "payment_id": payment.id,
                "payment_url": payment.payment_url,
                "amount": payment.amount,
                "status": payment.status
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment creation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao criar pagamento"
        )

async def create_abacate_payment(payment_data: dict) -> dict:
    """Integração com AbacatePay"""
    try:
        headers = {
            "Authorization": f"Bearer {ABACATE_PAY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ABACATE_PAY_BASE_URL}/payments",
                json=payment_data,
                headers=headers,
                timeout=30.0
            )
            
            if response.status_code != 200:
                logger.error(f"AbacatePay error: {response.status_code} - {response.text}")
                return {"success": False, "error": "Payment service error"}
            
            return {"success": True, "data": response.json()}
            
    except httpx.TimeoutException:
        logger.error("AbacatePay timeout")
        return {"success": False, "error": "Payment service timeout"}
    except Exception as e:
        logger.error(f"AbacatePay integration error: {str(e)}")
        return {"success": False, "error": "Payment service error"}
```

#### 3.2 GET `/api/payments/{payment_id}/status`
**Status:** 🔴 **FALHANDO**
**Problema:** Verificação de status de pagamento inconsistente
**Impacto:** Frontend não consegue monitorar pagamentos

**Correções Necessárias:**
```python
@app.get("/api/payments/{payment_id}/status")
async def get_payment_status(payment_id: str):
    try:
        # Buscar pagamento local
        payment = await get_payment_by_id(payment_id)
        if not payment:
            raise HTTPException(
                status_code=404,
                detail="Pagamento não encontrado"
            )
        
        # Verificar status no AbacatePay se ainda pendente
        if payment.status == "pending":
            abacate_status = await check_abacate_payment_status(payment_id)
            if abacate_status.get("success"):
                new_status = abacate_status["data"]["status"]
                
                # Mapear status do AbacatePay para nosso sistema
                status_mapping = {
                    "paid": "paid",
                    "pending": "pending",
                    "cancelled": "cancelled",
                    "expired": "expired"
                }
                
                mapped_status = status_mapping.get(new_status, "pending")
                
                # Atualizar status local se mudou
                if mapped_status != payment.status:
                    await update_payment_status(payment_id, mapped_status)
                    payment.status = mapped_status
                    
                    # Se foi pago, iniciar processamento
                    if mapped_status == "paid":
                        await start_order_processing(payment.order_id)
        
        return {
            "success": True,
            "data": {
                "payment_id": payment.id,
                "status": payment.status,
                "amount": payment.amount,
                "order_id": payment.order_id,
                "updated_at": payment.updated_at.isoformat()
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Payment status error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao verificar status do pagamento"
        )

async def check_abacate_payment_status(payment_id: str) -> dict:
    """Verificar status no AbacatePay"""
    try:
        headers = {
            "Authorization": f"Bearer {ABACATE_PAY_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{ABACATE_PAY_BASE_URL}/payments/{payment_id}",
                headers=headers,
                timeout=10.0
            )
            
            if response.status_code == 200:
                return {"success": True, "data": response.json()}
            else:
                logger.error(f"AbacatePay status error: {response.status_code}")
                return {"success": False}
                
    except Exception as e:
        logger.error(f"AbacatePay status check error: {str(e)}")
        return {"success": False}
```

### 4. **Listagem e Gerenciamento de Pedidos**

#### 4.1 GET `/api/orders`
**Status:** 🔴 **FALHANDO**
**Problema:** Listagem de pedidos retornando dados inconsistentes
**Impacto:** Dashboard não mostra pedidos corretamente

**Correções Necessárias:**
```python
@app.get("/api/orders")
async def list_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    try:
        # Calcular offset
        offset = (page - 1) * limit
        
        # Filtros
        filters = {"user_id": current_user.id}
        if status:
            filters["status"] = status
        
        # Buscar pedidos
        orders, total = await get_orders_paginated(
            filters=filters,
            offset=offset,
            limit=limit,
            order_by="created_at DESC"
        )
        
        # Formatar resposta
        formatted_orders = []
        for order in orders:
            # Calcular progresso se necessário
            progress = 0
            if order.status == "processing":
                progress = await calculate_processing_progress(order.id)
            elif order.status == "completed":
                progress = 100
            
            formatted_orders.append({
                "id": order.id,
                "filename": order.filename,
                "status": order.status,
                "progress": progress,
                "file_size": order.file_size,
                "created_at": order.created_at.isoformat(),
                "updated_at": order.updated_at.isoformat(),
                "download_url": f"/api/orders/{order.id}/download" if order.status == "completed" else None
            })
        
        return {
            "success": True,
            "data": {
                "orders": formatted_orders,
                "pagination": {
                    "page": page,
                    "limit": limit,
                    "total": total,
                    "pages": math.ceil(total / limit)
                }
            }
        }
        
    except Exception as e:
        logger.error(f"List orders error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao listar pedidos"
        )
```

### 5. **Webhooks e Notificações**

#### 5.1 POST `/api/webhooks/abacatepay`
**Status:** 🔴 **FALHANDO**
**Problema:** Webhook do AbacatePay não está sendo processado
**Impacto:** Status de pagamentos não atualiza automaticamente

**Correções Necessárias:**
```python
@app.post("/api/webhooks/abacatepay")
async def abacatepay_webhook(request: Request):
    try:
        # Obter dados do webhook
        body = await request.body()
        signature = request.headers.get("X-Abacate-Signature")
        
        # Verificar assinatura
        if not verify_webhook_signature(body, signature):
            raise HTTPException(
                status_code=401,
                detail="Assinatura inválida"
            )
        
        # Parse dos dados
        webhook_data = json.loads(body)
        event_type = webhook_data.get("event")
        payment_data = webhook_data.get("data", {})
        
        if event_type == "payment.paid":
            await handle_payment_paid(payment_data)
        elif event_type == "payment.cancelled":
            await handle_payment_cancelled(payment_data)
        elif event_type == "payment.expired":
            await handle_payment_expired(payment_data)
        
        return {"success": True}
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=400,
            detail="JSON inválido"
        )
    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro no processamento do webhook"
        )

async def handle_payment_paid(payment_data: dict):
    """Processar pagamento confirmado"""
    payment_id = payment_data.get("payment_id")
    if not payment_id:
        return
    
    # Atualizar status do pagamento
    await update_payment_status(payment_id, "paid")
    
    # Buscar pedido associado
    payment = await get_payment_by_id(payment_id)
    if payment:
        # Iniciar processamento do arquivo
        await start_order_processing(payment.order_id)

def verify_webhook_signature(body: bytes, signature: str) -> bool:
    """Verificar assinatura do webhook"""
    if not signature:
        return False
    
    expected_signature = hmac.new(
        ABACATE_PAY_WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected_signature)
```

---

## 🔧 Endpoints de Monitoramento e Saúde

### 1. **Health Check**
**Status:** ❌ **AUSENTE**
**Necessidade:** Endpoint para verificar saúde do sistema

**Implementação Necessária:**
```python
@app.get("/api/health")
async def health_check():
    """Verificar saúde do sistema"""
    try:
        # Verificar banco de dados
        db_status = await check_database_connection()
        
        # Verificar AbacatePay
        abacate_status = await check_abacate_connection()
        
        # Verificar armazenamento
        storage_status = check_storage_availability()
        
        overall_status = "healthy" if all([
            db_status, abacate_status, storage_status
        ]) else "unhealthy"
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "database": "up" if db_status else "down",
                "abacatepay": "up" if abacate_status else "down",
                "storage": "up" if storage_status else "down"
            }
        }
        
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "error": str(e)
        }
```

### 2. **Métricas do Sistema**
**Status:** ❌ **AUSENTE**
**Necessidade:** Endpoint para monitoramento de métricas

**Implementação Necessária:**
```python
@app.get("/api/metrics")
async def get_metrics(current_user: User = Depends(get_admin_user)):
    """Obter métricas do sistema (apenas admin)"""
    try:
        # Métricas de pedidos
        total_orders = await count_orders()
        pending_orders = await count_orders_by_status("pending_payment")
        processing_orders = await count_orders_by_status("processing")
        completed_orders = await count_orders_by_status("completed")
        failed_orders = await count_orders_by_status("failed")
        
        # Métricas de pagamentos
        total_payments = await count_payments()
        successful_payments = await count_payments_by_status("paid")
        
        # Métricas de performance
        avg_processing_time = await get_average_processing_time()
        
        return {
            "success": True,
            "data": {
                "orders": {
                    "total": total_orders,
                    "pending_payment": pending_orders,
                    "processing": processing_orders,
                    "completed": completed_orders,
                    "failed": failed_orders
                },
                "payments": {
                    "total": total_payments,
                    "successful": successful_payments,
                    "success_rate": (successful_payments / total_payments * 100) if total_payments > 0 else 0
                },
                "performance": {
                    "avg_processing_time_seconds": avg_processing_time
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
    except Exception as e:
        logger.error(f"Metrics error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Erro ao obter métricas"
        )
```

---

## 🚨 Problemas de Infraestrutura

### 1. **Configuração de CORS**
**Problema:** CORS não configurado adequadamente
**Impacto:** Frontend não consegue fazer requisições

**Correção Necessária:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",  # Frontend dev
        "http://localhost:3002",  # Frontend dev alternativo
        "https://docfiscal.com",  # Produção
        "https://www.docfiscal.com"  # Produção com www
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
```

### 2. **Tratamento de Erros Global**
**Problema:** Erros não tratados adequadamente
**Impacto:** Respostas inconsistentes para o frontend

**Correção Necessária:**
```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Erro interno do servidor",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat()
        }
    )
```

### 3. **Logging e Monitoramento**
**Problema:** Logs inadequados para debugging
**Impacto:** Dificulta identificação de problemas

**Correção Necessária:**
```python
import logging
from logging.handlers import RotatingFileHandler

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Handler para arquivo
file_handler = RotatingFileHandler(
    'logs/app.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

logger = logging.getLogger(__name__)
logger.addHandler(file_handler)

# Middleware de logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log da requisição
    logger.info(f"Request: {request.method} {request.url}")
    
    response = await call_next(request)
    
    # Log da resposta
    process_time = time.time() - start_time
    logger.info(f"Response: {response.status_code} - {process_time:.3f}s")
    
    return response
```

---

## 📋 Checklist de Correções Prioritárias

### 🚨 Crítico (Corrigir Imediatamente)
- [ ] Corrigir endpoint de login (`POST /api/auth/login`)
- [ ] Corrigir endpoint de upload (`POST /api/upload`)
- [ ] Implementar webhook do AbacatePay (`POST /api/webhooks/abacatepay`)
- [ ] Corrigir criação de pagamentos (`POST /api/orders/{id}/payment`)
- [ ] Configurar CORS adequadamente

### ⚠️ Alto (Corrigir em 1 semana)
- [ ] Corrigir endpoint de registro (`POST /api/auth/register`)
- [ ] Implementar refresh de tokens (`POST /api/auth/refresh`)
- [ ] Corrigir listagem de pedidos (`GET /api/orders`)
- [ ] Corrigir download de arquivos (`GET /api/orders/{id}/download`)
- [ ] Implementar tratamento global de erros

### 📊 Médio (Corrigir em 2 semanas)
- [ ] Implementar health check (`GET /api/health`)
- [ ] Implementar métricas (`GET /api/metrics`)
- [ ] Melhorar logging e monitoramento
- [ ] Implementar rate limiting
- [ ] Adicionar validação de dados mais robusta

### 🔧 Baixo (Melhorias futuras)
- [ ] Implementar cache Redis
- [ ] Adicionar documentação OpenAPI
- [ ] Implementar testes automatizados
- [ ] Otimizar performance de queries
- [ ] Implementar backup automático

---

## 🧪 Testes Recomendados

### Testes de Integração:
```python
# Teste de fluxo completo
async def test_complete_flow():
    # 1. Registrar usuário
    user_data = await register_user(test_user_data)
    
    # 2. Fazer login
    tokens = await login_user(test_credentials)
    
    # 3. Upload de arquivo
    order = await upload_file(test_file, tokens.access_token)
    
    # 4. Criar pagamento
    payment = await create_payment(order.id, tokens.access_token)
    
    # 5. Simular webhook de pagamento
    await simulate_payment_webhook(payment.id)
    
    # 6. Verificar processamento
    processed_order = await wait_for_processing(order.id)
    
    # 7. Download do arquivo
    file_content = await download_file(order.id, tokens.access_token)
    
    assert processed_order.status == "completed"
    assert file_content is not None
```

### Testes de Carga:
```python
# Teste de múltiplos uploads simultâneos
async def test_concurrent_uploads():
    tasks = []
    for i in range(10):
        task = upload_file(f"test_file_{i}.pdf", access_token)
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Verificar se todos foram processados
    successful_uploads = [r for r in results if not isinstance(r, Exception)]
    assert len(successful_uploads) == 10
```

---

## 📊 Métricas de Sucesso

Após implementar as correções, monitorar:
- **Taxa de erro de API:** < 1%
- **Tempo de resposta:** < 2s para 95% das requisições
- **Disponibilidade:** > 99.9%
- **Taxa de sucesso de uploads:** > 98%
- **Taxa de sucesso de pagamentos:** > 95%

---

**Status:** 🔴 **AÇÃO CRÍTICA NECESSÁRIA**  
**Prioridade:** 🚨 **MÁXIMA**  
**Prazo Recomendado:** **1 semana para correções críticas**