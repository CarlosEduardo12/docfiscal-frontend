/**
 * Script de Debug para Problemas de Autenticação em Produção
 * 
 * Execute este script no console do navegador em produção para diagnosticar
 * problemas de sincronização de autenticação.
 */

console.log('🔍 INICIANDO DIAGNÓSTICO DE AUTENTICAÇÃO EM PRODUÇÃO');

// Função para verificar o estado atual da autenticação
async function debugAuthState() {
  console.log('\n=== ESTADO ATUAL DA AUTENTICAÇÃO ===');
  
  // 1. Verificar variáveis de ambiente
  console.log('1. Variáveis de Ambiente:');
  console.log('   - NODE_ENV:', process?.env?.NODE_ENV || 'undefined');
  console.log('   - URL atual:', window.location.href);
  console.log('   - Origin:', window.location.origin);
  console.log('   - Protocol:', window.location.protocol);
  
  // 2. Verificar localStorage
  console.log('\n2. LocalStorage:');
  const tokens = {
    access: localStorage.getItem('docfiscal_access_token'),
    refresh: localStorage.getItem('docfiscal_refresh_token'),
    expires: localStorage.getItem('docfiscal_token_expires_at')
  };
  
  console.log('   - Access Token:', tokens.access ? `${tokens.access.substring(0, 20)}...` : 'null');
  console.log('   - Refresh Token:', tokens.refresh ? `${tokens.refresh.substring(0, 20)}...` : 'null');
  console.log('   - Expires At:', tokens.expires);
  
  // 3. Verificar se há tokens antigos (sistema legado)
  console.log('\n3. Tokens Legados:');
  const legacyTokens = {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token')
  };
  console.log('   - Legacy Access:', legacyTokens.access ? `${legacyTokens.access.substring(0, 20)}...` : 'null');
  console.log('   - Legacy Refresh:', legacyTokens.refresh ? `${legacyTokens.refresh.substring(0, 20)}...` : 'null');
  
  // 4. Testar conectividade com API
  console.log('\n4. Teste de Conectividade:');
  try {
    const apiUrl = 'https://responsible-balance-production.up.railway.app';
    console.log('   - API URL:', apiUrl);
    
    const response = await fetch(`${apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('   - Status:', response.status);
    console.log('   - Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.text();
      console.log('   - Response:', data);
    }
  } catch (error) {
    console.error('   - Erro de conectividade:', error.message);
  }
  
  // 5. Testar refresh token se disponível
  if (tokens.refresh) {
    console.log('\n5. Teste de Refresh Token:');
    try {
      const apiUrl = 'https://responsible-balance-production.up.railway.app';
      const response = await fetch(`${apiUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: tokens.refresh
        })
      });
      
      console.log('   - Status:', response.status);
      console.log('   - Headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log('   - Refresh bem-sucedido:', !!data.success);
        console.log('   - Novo token recebido:', !!data.tokens?.access_token);
      } else {
        const errorText = await response.text();
        console.log('   - Erro:', errorText);
      }
    } catch (error) {
      console.error('   - Erro no refresh:', error.message);
    }
  }
  
  // 6. Verificar contexto seguro (HTTPS)
  console.log('\n6. Contexto Seguro:');
  console.log('   - HTTPS:', window.location.protocol === 'https:');
  console.log('   - Secure Context:', window.isSecureContext);
  console.log('   - Service Worker:', 'serviceWorker' in navigator);
  
  // 7. Verificar se há erros de CORS
  console.log('\n7. Teste de CORS:');
  try {
    const apiUrl = 'https://responsible-balance-production.up.railway.app';
    const response = await fetch(`${apiUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': tokens.access ? `Bearer ${tokens.access}` : ''
      }
    });
    
    console.log('   - Status:', response.status);
    console.log('   - CORS OK:', response.type !== 'opaque');
    
    if (response.ok) {
      const data = await response.json();
      console.log('   - User data:', data);
    } else {
      const errorText = await response.text();
      console.log('   - Erro:', errorText);
    }
  } catch (error) {
    console.error('   - Erro de CORS/Network:', error.message);
  }
}

// Função para simular o fluxo de login
async function simulateLogin(email, password) {
  console.log('\n=== SIMULANDO FLUXO DE LOGIN ===');
  console.log('Email:', email);
  
  try {
    const apiUrl = 'https://responsible-balance-production.up.railway.app';
    const response = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const data = await response.json();
      console.log('Login Response:', data);
      
      if (data.success && data.tokens) {
        // Simular armazenamento de tokens
        const tokens = {
          accessToken: data.tokens.access_token,
          refreshToken: data.tokens.refresh_token,
          expiresAt: new Date(Date.now() + (data.tokens.expires_in || 3600) * 1000)
        };
        
        console.log('Tokens recebidos:', {
          access: tokens.accessToken.substring(0, 20) + '...',
          refresh: tokens.refreshToken.substring(0, 20) + '...',
          expires: tokens.expiresAt.toISOString()
        });
        
        // Armazenar tokens
        localStorage.setItem('docfiscal_access_token', tokens.accessToken);
        localStorage.setItem('docfiscal_refresh_token', tokens.refreshToken);
        localStorage.setItem('docfiscal_token_expires_at', tokens.expiresAt.toISOString());
        
        console.log('✅ Tokens armazenados com sucesso');
        
        // Verificar se foram armazenados corretamente
        const stored = {
          access: localStorage.getItem('docfiscal_access_token'),
          refresh: localStorage.getItem('docfiscal_refresh_token'),
          expires: localStorage.getItem('docfiscal_token_expires_at')
        };
        
        const verification = stored.access && stored.refresh && stored.expires;
        console.log('Verificação de armazenamento:', verification ? '✅ OK' : '❌ FALHOU');
        
        if (!verification) {
          console.error('❌ Falha na verificação de armazenamento:', stored);
        }
        
        return true;
      }
    } else {
      const errorText = await response.text();
      console.error('Erro no login:', errorText);
    }
  } catch (error) {
    console.error('Erro na simulação de login:', error.message);
  }
  
  return false;
}

// Função para limpar todos os tokens
function clearAllTokens() {
  console.log('\n=== LIMPANDO TODOS OS TOKENS ===');
  
  // Tokens atuais
  localStorage.removeItem('docfiscal_access_token');
  localStorage.removeItem('docfiscal_refresh_token');
  localStorage.removeItem('docfiscal_token_expires_at');
  
  // Tokens legados
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  
  // Outros possíveis tokens
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_token');
  
  console.log('✅ Todos os tokens foram removidos');
}

// Executar diagnóstico automaticamente
debugAuthState();

// Exportar funções para uso manual
window.debugAuth = {
  checkState: debugAuthState,
  simulateLogin: simulateLogin,
  clearTokens: clearAllTokens,
  
  // Função de conveniência para testar login
  testLogin: (email, password) => {
    clearAllTokens();
    return simulateLogin(email, password);
  }
};

console.log('\n✅ Diagnóstico concluído!');
console.log('💡 Use window.debugAuth.checkState() para verificar novamente');
console.log('💡 Use window.debugAuth.testLogin(email, password) para testar login');
console.log('💡 Use window.debugAuth.clearTokens() para limpar tokens');