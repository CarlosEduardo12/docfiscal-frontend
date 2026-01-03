/**
 * Script de Debug Específico para Fluxo de Login em Produção
 * 
 * Execute este script no console do navegador em produção para diagnosticar
 * especificamente onde o fluxo de login está falhando.
 */

console.log('🔍 INICIANDO DEBUG DO FLUXO DE LOGIN EM PRODUÇÃO');

// Função para testar cada etapa do login
async function debugLoginFlow(email, password) {
  console.log('\n=== TESTANDO FLUXO COMPLETO DE LOGIN ===');
  console.log('Email:', email);
  
  // Limpar tokens existentes primeiro
  console.log('\n1. Limpando tokens existentes...');
  localStorage.removeItem('docfiscal_access_token');
  localStorage.removeItem('docfiscal_refresh_token');
  localStorage.removeItem('docfiscal_token_expires_at');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  console.log('✅ Tokens limpos');
  
  // Verificar estado inicial
  console.log('\n2. Estado inicial:');
  console.log('   - localStorage vazio:', {
    docfiscal_access: localStorage.getItem('docfiscal_access_token'),
    docfiscal_refresh: localStorage.getItem('docfiscal_refresh_token'),
    docfiscal_expires: localStorage.getItem('docfiscal_token_expires_at'),
    legacy_access: localStorage.getItem('access_token'),
    legacy_refresh: localStorage.getItem('refresh_token')
  });
  
  try {
    // Etapa 1: Fazer requisição de login
    console.log('\n3. Fazendo requisição de login...');
    const apiUrl = 'https://responsible-balance-production.up.railway.app';
    const loginResponse = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    
    console.log('   - Status:', loginResponse.status);
    console.log('   - Headers:', Object.fromEntries(loginResponse.headers.entries()));
    
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('❌ Login falhou:', errorText);
      return false;
    }
    
    const loginData = await loginResponse.json();
    console.log('   - Response completa:', loginData);
    
    // Etapa 2: Verificar estrutura da resposta
    console.log('\n4. Analisando estrutura da resposta...');
    console.log('   - success:', loginData.success);
    console.log('   - data:', loginData.data);
    console.log('   - tokens:', loginData.data?.tokens);
    
    if (!loginData.success) {
      console.error('❌ Login não foi bem-sucedido:', loginData);
      return false;
    }
    
    if (!loginData.data) {
      console.error('❌ Resposta não contém data:', loginData);
      return false;
    }
    
    // Verificar onde estão os tokens
    const tokenData = loginData.data.tokens || loginData.data;
    console.log('   - tokenData:', tokenData);
    console.log('   - access_token:', tokenData.access_token ? `${tokenData.access_token.substring(0, 20)}...` : 'null');
    console.log('   - refresh_token:', tokenData.refresh_token ? `${tokenData.refresh_token.substring(0, 20)}...` : 'null');
    console.log('   - expires_in:', tokenData.expires_in);
    
    if (!tokenData.access_token || !tokenData.refresh_token) {
      console.error('❌ Tokens não encontrados na resposta:', tokenData);
      return false;
    }
    
    // Etapa 3: Simular armazenamento manual
    console.log('\n5. Testando armazenamento manual...');
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000)
    };
    
    console.log('   - Tokens preparados:', {
      accessLength: tokens.accessToken.length,
      refreshLength: tokens.refreshToken.length,
      expiresAt: tokens.expiresAt.toISOString()
    });
    
    // Tentar armazenar diretamente
    try {
      localStorage.setItem('docfiscal_access_token', tokens.accessToken);
      localStorage.setItem('docfiscal_refresh_token', tokens.refreshToken);
      localStorage.setItem('docfiscal_token_expires_at', tokens.expiresAt.toISOString());
      console.log('✅ Armazenamento direto bem-sucedido');
    } catch (storageError) {
      console.error('❌ Erro no armazenamento direto:', storageError);
      return false;
    }
    
    // Etapa 4: Verificar se foram armazenados
    console.log('\n6. Verificando armazenamento...');
    const stored = {
      access: localStorage.getItem('docfiscal_access_token'),
      refresh: localStorage.getItem('docfiscal_refresh_token'),
      expires: localStorage.getItem('docfiscal_token_expires_at')
    };
    
    console.log('   - Tokens armazenados:', {
      access: stored.access ? `${stored.access.substring(0, 20)}...` : 'null',
      refresh: stored.refresh ? `${stored.refresh.substring(0, 20)}...` : 'null',
      expires: stored.expires
    });
    
    const allStored = stored.access && stored.refresh && stored.expires;
    console.log('   - Todos armazenados:', allStored ? '✅ SIM' : '❌ NÃO');
    
    if (!allStored) {
      console.error('❌ Falha na verificação de armazenamento');
      return false;
    }
    
    // Etapa 5: Testar validação de token
    console.log('\n7. Testando validação de token...');
    try {
      const profileResponse = await fetch(`${apiUrl}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stored.access}`
        }
      });
      
      console.log('   - Status da validação:', profileResponse.status);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('   - Profile data:', profileData);
        console.log('✅ Token válido e funcionando');
      } else {
        const errorText = await profileResponse.text();
        console.log('   - Erro na validação:', errorText);
        console.warn('⚠️ Token armazenado mas não válido');
      }
    } catch (validationError) {
      console.error('❌ Erro na validação:', validationError);
    }
    
    // Etapa 6: Testar com AuthTokenManager (se disponível)
    console.log('\n8. Testando com AuthTokenManager...');
    if (typeof window !== 'undefined' && window.authTokenManager) {
      try {
        const isAuth = await window.authTokenManager.isAuthenticated();
        console.log('   - AuthTokenManager.isAuthenticated():', isAuth);
        
        const validToken = await window.authTokenManager.getValidToken();
        console.log('   - AuthTokenManager.getValidToken():', validToken ? `${validToken.substring(0, 20)}...` : 'null');
        
        const storedTokens = window.authTokenManager.getStoredTokens();
        console.log('   - AuthTokenManager.getStoredTokens():', {
          access: storedTokens.accessToken ? `${storedTokens.accessToken.substring(0, 20)}...` : 'null',
          refresh: storedTokens.refreshToken ? `${storedTokens.refreshToken.substring(0, 20)}...` : 'null',
          expires: storedTokens.expiresAt
        });
      } catch (managerError) {
        console.error('❌ Erro com AuthTokenManager:', managerError);
      }
    } else {
      console.log('   - AuthTokenManager não disponível no window');
    }
    
    console.log('\n✅ TESTE DE LOGIN COMPLETO - SUCESSO');
    return true;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE DE LOGIN:', error);
    return false;
  }
}

// Função para testar especificamente o secure storage
function testSecureStorage() {
  console.log('\n=== TESTANDO SECURE STORAGE ===');
  
  // Verificar se estamos em contexto seguro
  console.log('1. Contexto seguro:');
  console.log('   - HTTPS:', window.location.protocol === 'https:');
  console.log('   - isSecureContext:', window.isSecureContext);
  
  // Testar localStorage básico
  console.log('\n2. Testando localStorage básico...');
  try {
    const testKey = 'test_storage_' + Date.now();
    const testValue = 'test_value_' + Math.random();
    
    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    console.log('   - Set/Get/Remove:', retrieved === testValue ? '✅ OK' : '❌ FALHOU');
  } catch (error) {
    console.error('   - Erro no localStorage:', error);
  }
  
  // Testar quota do localStorage
  console.log('\n3. Testando quota do localStorage...');
  try {
    const testData = 'x'.repeat(1024 * 100); // 100KB
    localStorage.setItem('quota_test', testData);
    localStorage.removeItem('quota_test');
    console.log('   - Quota (100KB):', '✅ OK');
  } catch (error) {
    console.error('   - Erro de quota:', error.message);
  }
}

// Função para verificar se há interferência de outros scripts
function checkInterference() {
  console.log('\n=== VERIFICANDO INTERFERÊNCIAS ===');
  
  // Verificar se há outros scripts modificando localStorage
  console.log('1. Monitorando localStorage por 5 segundos...');
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;
  
  let interceptedCalls = [];
  
  localStorage.setItem = function(key, value) {
    interceptedCalls.push({ action: 'setItem', key, value: value.substring(0, 50) + '...' });
    return originalSetItem.call(this, key, value);
  };
  
  localStorage.removeItem = function(key) {
    interceptedCalls.push({ action: 'removeItem', key });
    return originalRemoveItem.call(this, key);
  };
  
  localStorage.clear = function() {
    interceptedCalls.push({ action: 'clear' });
    return originalClear.call(this);
  };
  
  setTimeout(() => {
    localStorage.setItem = originalSetItem;
    localStorage.removeItem = originalRemoveItem;
    localStorage.clear = originalClear;
    
    console.log('   - Chamadas interceptadas:', interceptedCalls);
    if (interceptedCalls.length === 0) {
      console.log('   - ✅ Nenhuma interferência detectada');
    } else {
      console.log('   - ⚠️ Possível interferência detectada');
    }
  }, 5000);
}

// Executar testes automaticamente
testSecureStorage();
checkInterference();

// Exportar funções para uso manual
window.debugLoginFlow = {
  testLogin: debugLoginFlow,
  testStorage: testSecureStorage,
  checkInterference: checkInterference,
  
  // Função de conveniência
  fullTest: async (email, password) => {
    testSecureStorage();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return await debugLoginFlow(email, password);
  }
};

console.log('\n✅ Debug do fluxo de login carregado!');
console.log('💡 Use window.debugLoginFlow.testLogin(email, password) para testar');
console.log('💡 Use window.debugLoginFlow.fullTest(email, password) para teste completo');
console.log('💡 Use window.debugLoginFlow.testStorage() para testar storage');
console.log('💡 Use window.debugLoginFlow.checkInterference() para verificar interferências');