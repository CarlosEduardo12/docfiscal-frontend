# DocFiscal Frontend

Frontend da aplicação DocFiscal - SaaS para conversão de documentos fiscais PDF para CSV.

## 🚀 Tecnologias

- **Next.js 14** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **Tailwind CSS** - Estilização
- **Shadcn/ui** - Componentes UI
- **React Query** - Gerenciamento de estado servidor
- **NextAuth.js** - Autenticação
- **Jest + Testing Library** - Testes

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Backend da aplicação rodando

## 🔧 Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/CarlosEduardo12/docfiscal-frontend.git
cd docfiscal-frontend
```

### 2. Instale as dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e configure as variáveis:

```bash
cp .env.local.example .env.local
```

Edite o arquivo `.env.local`:

```env
# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENVIRONMENT=development

# File Upload
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=application/pdf

# Payment Configuration
NEXT_PUBLIC_PAYMENT_RETURN_URL=http://localhost:3000/payment/success
NEXT_PUBLIC_PAYMENT_CANCEL_URL=http://localhost:3000/payment/cancel
```

### 4. Execute o projeto

```bash
npm run dev
# ou
yarn dev
```

A aplicação estará disponível em `http://localhost:3000`

## 🌐 Configuração do Backend

### URLs da API

- **Desenvolvimento**: `http://localhost:8000`
- **Produção**: `https://responsible-balance-production.up.railway.app`

### Endpoints Principais

- `POST /api/auth/register` - Registro de usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Perfil do usuário
- `POST /api/upload` - Upload de arquivo
- `GET /api/orders` - Listar pedidos
- `GET /api/orders/{id}` - Detalhes do pedido
- `GET /api/orders/{id}/download` - Download do arquivo convertido
- `POST /api/orders/{id}/payment` - Iniciar pagamento
- `GET /api/payments/{id}/status` - Status do pagamento

## 🔐 Autenticação

O sistema usa JWT tokens com refresh automático:

- **Access Token**: Válido por tempo limitado
- **Refresh Token**: Para renovar o access token
- **Armazenamento**: localStorage (desenvolvimento)

### Headers de Autenticação

```javascript
{
  'Authorization': 'Bearer {access_token}',
  'Content-Type': 'application/json'
}
```

## 📁 Estrutura do Projeto

```
src/
├── app/                    # App Router (Next.js 14)
│   ├── (auth)/            # Rotas de autenticação
│   ├── dashboard/         # Dashboard do usuário
│   ├── pedido/           # Detalhes do pedido
│   ├── payment/          # Páginas de pagamento
│   └── api/              # API routes (se necessário)
├── components/           # Componentes React
│   ├── auth/            # Componentes de autenticação
│   ├── error/           # Tratamento de erros
│   ├── order/           # Componentes de pedidos
│   ├── ui/              # Componentes UI (shadcn)
│   └── upload/          # Componentes de upload
├── hooks/               # Custom hooks
├── lib/                 # Utilitários e configurações
├── types/               # Definições de tipos TypeScript
└── __tests__/           # Testes
```

## 🧪 Testes

Execute os testes:

```bash
# Testes unitários
npm run test

# Testes em modo watch
npm run test:watch

# Coverage
npm run test:coverage
```

## 🚀 Deploy

### Variáveis de Ambiente para Produção

```env
# NextAuth.js
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-production-secret

# API Configuration
NEXT_PUBLIC_API_URL=https://responsible-balance-production.up.railway.app
NEXT_PUBLIC_ENVIRONMENT=production

# Payment Configuration
NEXT_PUBLIC_PAYMENT_RETURN_URL=https://your-domain.com/payment/success
NEXT_PUBLIC_PAYMENT_CANCEL_URL=https://your-domain.com/payment/cancel
```

### Build para Produção

```bash
npm run build
npm start
```

## 📱 Funcionalidades

### ✅ Implementadas

- [x] Autenticação (Login/Register)
- [x] Upload de arquivos PDF
- [x] Dashboard com histórico de pedidos
- [x] Visualização de status dos pedidos
- [x] Download de arquivos convertidos
- [x] Integração com pagamentos
- [x] Tratamento de erros
- [x] Responsividade
- [x] Testes automatizados

### 🔄 Em Desenvolvimento

- [ ] Notificações em tempo real
- [ ] Perfil do usuário
- [ ] Histórico de pagamentos
- [ ] Suporte a múltiplos arquivos

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de CORS**
   - Verifique se o backend está configurado para aceitar requisições do frontend
   - URL: `http://localhost:3000` (desenvolvimento)

2. **Token expirado**
   - O sistema faz refresh automático
   - Se persistir, faça logout e login novamente

3. **Upload falha**
   - Verifique se o arquivo é PDF
   - Tamanho máximo: 10MB
   - Backend deve estar rodando

4. **Pagamento não funciona**
   - Verifique as URLs de retorno
   - Confirme configuração do MercadoPago no backend

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique os logs do console do navegador
2. Confirme se o backend está rodando
3. Verifique as variáveis de ambiente
4. Consulte a documentação da API

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.