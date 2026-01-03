/**
 * Script de Debug Específico para SecureStorage em Produção
 * 
 * Execute este script no console do navegador em produção para diagnosticar
 * problemas específicos com o secureStorage.
 */

console.log('🔍 INICIANDO DEBUG DO SECURE STORAGE EM PRODUÇÃO');

// Função para testar o secureStorage diretamente
function testSecureStorageDirectly() {
  console.log('\n=== TESTANDO SECURE STORAGE DIRETAMENTE ===');
  
  // Verificar se secureStorage está disponível
  if (typeof window.secureStorage === 'undefined') {
    console.error('❌ secureStorage não está disponível no window');
    return false;
  }
  
  const testKey = 'test_secure_storage_' + Date.now();
  const testValue = 'test_value_' + Math.random();
  
  try {
    console.log('1. Testando setItem...');
    window.secureStorage.setItem(testKey, testValue, { encrypt: true, secure: true });
    console.log('✅ setItem bem-sucedido');
    
    console.log('2. Testando getItem...');
    const retrieved = window.secureStorage.getItem(testKey);
    console.log('   - Valor recuperado:', retrieved);
    console.log('   - Valores coincidem:', retrieved === testValue ? '✅ SIM' : '❌ NÃO');
    
    console.log('3. Testando removeItem...');
    window.secureStorage.removeItem(testKey);
    const afterRemove = window.secureStorage.getItem(testKey);
    console.log('   - Após remoção:', afterRemove === null ? '✅ NULL' : '❌ AINDA EXISTE');
    
    return retrieved === testValue;
  } catch (error) {
    console.error('❌ Erro no teste de secureStorage:', error);
    return false;
  }
}

// Função para testar tokens específicos
function testTokenStorage() {
  console.log('\n=== TESTANDO ARMAZENAMENTO DE TOKENS ===');
  
  const testTokens = {
    access: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    refresh: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.different_signature',
    expires: new Date(Date.now() + 3600000).toISOString()
  };
  
  const keys = {
    access: 'docfiscal_access_token',
    refresh: 'docfiscal_refresh_token',
    expires: 'docfiscal_token_expires_at'
  };
  
  // Limpar tokens existentes
  console.log('1. Limpando tokens existentes...');
  Object.values(keys).forEach(key => {
    localStorage.removeItem(key);
    if (typeof window.secureStorage !== 'undefined') {
      try {
        window.secureStorage.removeItem(key);
      } catch (e) {
        console.warn('Erro ao limpar secureStorage:', e);
      }
    }
  });
  
  // Testar armazenamento com secureStorage
  console.log('2. Testando com secureStorage...');
  if (typeof window.secureStorage !== 'undefined') {
    try {
      window.secureStorage.setItem(keys.access, testTokens.access, { encrypt: true, secure: true });
      window.secureStorage.setItem(keys.refresh, testTokens.refresh, { encrypt: true, secure: true });
      window.secureStorage.setItem(keys.expires, testTokens.expires, { encrypt: false, secure: true });
      
      const retrievedSecure = {
        access: window.secureStorage.getItem(keys.access),
        refresh: window.secureStorage.getItem(keys.refresh),
        expires: window.secureStorage.getItem(keys.expires)
      };
      
      console.log('   - SecureStorage results:', {
        access: retrievedSecure.access ? `${retrievedSecure.access.substring(0, 20)}...` : 'null',
        refresh: retrievedSecure.refresh ? `${retrievedSecure.refresh.substring(0, 20)}...` : 'null',
        expires: retrievedSecure.expires
      });
      
      const secureStorageWorks = retrievedSecure.access === testTokens.access && 
                                retrievedSecure.refresh === testTokens.refresh && 
                                retrievedSecure.expires === testTokens.expires;
      
      console.log('   - SecureStorage funciona:', secureStorageWorks ? '✅ SIM' : '❌ NÃO');
      
      // Limpar após teste
      Object.values(keys).forEach(key => {
        try {
          window.secureStorage.removeItem(key);
        } catch (e) {
          console.warn('Erro ao limpar após teste:', e);
        }
      });
      
      if (!secureStorageWorks) {
        console.log('3. Testando com localStorage regular...');
        localStorage.setItem(keys.access, testTokens.access);
        localStorage.setItem(keys.refresh, testTokens.refresh);
        localStorage.setItem(keys.expires, testTokens.expires);
        
        const retrievedRegular = {
          access: localStorage.getItem(keys.access),
          refresh: localStorage.getItem(keys.refresh),
          expires: localStorage.getItem(keys.expires)
        };
        
        console.log('   - LocalStorage results:', {
          access: retrievedRegular.access ? `${retrievedRegular.access.substring(0, 20)}...` : 'null',
          refresh: retrievedRegular.refresh ? `${retrievedRegular.refresh.substring(0, 20)}...` : 'null',
          expires: retrievedRegular.expires
        });
        
        const regularStorageWorks = retrievedRegular.access === testTokens.access && 
                                   retrievedRegular.refresh === testTokens.refresh && 
                                   retrievedRegular.expires === testTokens.expires;
        
        console.log('   - LocalStorage funciona:', regularStorageWorks ? '✅ SIM' : '❌ NÃO');
        
        // Limpar após teste
        Object.values(keys).forEach(key => localStorage.removeItem(key));
        
        return regularStorageWorks;
      }
      
      return secureStorageWorks;
    } catch (error) {
      console.error('❌ Erro no teste de secureStorage:', error);
      return false;
    }
  } else {
    console.log('   - SecureStorage não disponível, testando localStorage...');
    localStorage.setItem(keys.access, testTokens.access);
    localStorage.setItem(keys.refresh, testTokens.refresh);
    localStorage.setItem(keys.expires, testTokens.expires);
    
    const retrieved = {
      access: localStorage.getItem(keys.access),
      refresh: localStorage.getItem(keys.refresh),
      expires: localStorage.getItem(keys.expires)
    };
    
    console.log('   - LocalStorage results:', {
      access: retrieved.access ? `${retrieved.access.substring(0, 20)}...` : 'null',
      refresh: retrieved.refresh ? `${retrieved.refresh.substring(0, 20)}...` : 'null',
      expires: retrieved.expires
    });
    
    const works = retrieved.access === testTokens.access && 
                  retrieved.refresh === testTokens.refresh && 
                  retrieved.expires === testTokens.expires;
    
    console.log('   - LocalStorage funciona:', works ? '✅ SIM' : '❌ NÃO');
    
    // Limpar após teste
    Object.values(keys).forEach(key => localStorage.removeItem(key));
    
    return works;
  }
}

// Função para verificar configuração do ambiente
function checkEnvironmentConfig() {
  console.log('\n=== VERIFICANDO CONFIGURAÇÃO DO AMBIENTE ===');
  
  if (typeof window.environmentConfig !== 'undefined') {
    try {
      const config = window.environmentConfig.getConfig();
      console.log('Environment Config:', config);
      
      console.log('Análise da configuração:');
      console.log('   - Environment:', config.environment);
      console.log('   - Is Production:', config.isProduction);
      console.log('   - Is HTTPS:', config.isHttps);
      console.log('   - Secure Storage:', config.secureStorage);
      console.log('   - API URL:', config.apiUrl);
      console.log('   - Frontend URL:', config.frontendUrl);
      
      return config;
    } catch (error) {
      console.error('❌ Erro ao acessar environmentConfig:', error);
      return null;
    }
  } else {
    console.log('❌ environmentConfig não disponível no window');
    return null;
  }
}

// Função para verificar se AuthTokenManager está funcionando
function testAuthTokenManager() {
  console.log('\n=== TESTANDO AUTH TOKEN MANAGER ===');
  
  if (typeof window.authTokenManager !== 'undefined') {
    try {
      console.log('1. Verificando métodos disponíveis...');
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(window.authTokenManager));
      console.log('   - Métodos:', methods);
      
      console.log('2. Testando getStoredTokens...');
      const storedTokens = window.authTokenManager.getStoredTokens();
      console.log('   - Stored tokens:', {
        access: storedTokens.accessToken ? `${storedTokens.accessToken.substring(0, 20)}...` : 'null',
        refresh: storedTokens.refreshToken ? `${storedTokens.refreshToken.substring(0, 20)}...` : 'null',
        expires: storedTokens.expiresAt
      });
      
      console.log('3. Testando isAuthenticated...');
      window.authTokenManager.isAuthenticated().then(isAuth => {
        console.log('   - Is authenticated:', isAuth);
      }).catch(error => {
        console.error('   - Erro em isAuthenticated:', error);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao testar AuthTokenManager:', error);
      return false;
    }
  } else {
    console.log('❌ authTokenManager não disponível no window');
    return false;
  }
}

// Executar todos os testes
async function runAllTests() {
  console.log('🚀 EXECUTANDO TODOS OS TESTES...\n');
  
  const results = {
    environmentConfig: checkEnvironmentConfig(),
    secureStorageDirect: testSecureStorageDirectly(),
    tokenStorage: testTokenStorage(),
    authTokenManager: testAuthTokenManager()
  };
  
  console.log('\n📊 RESUMO DOS RESULTADOS:');
  console.log('   - Environment Config:', results.environmentConfig ? '✅ OK' : '❌ FALHOU');
  console.log('   - Secure Storage Direct:', results.secureStorageDirect ? '✅ OK' : '❌ FALHOU');
  console.log('   - Token Storage:', results.tokenStorage ? '✅ OK' : '❌ FALHOU');
  console.log('   - Auth Token Manager:', results.authTokenManager ? '✅ OK' : '❌ FALHOU');
  
  return results;
}

// Executar testes automaticamente
runAllTests();

// Exportar funções para uso manual
window.debugSecureStorage = {
  testDirect: testSecureStorageDirectly,
  testTokens: testTokenStorage,
  checkConfig: checkEnvironmentConfig,
  testManager: testAuthTokenManager,
  runAll: runAllTests
};

console.log('\n✅ Debug do SecureStorage carregado!');
console.log('💡 Use window.debugSecureStorage.runAll() para executar todos os testes');
console.log('💡 Use window.debugSecureStorage.testTokens() para testar apenas tokens');
console.log('💡 Use window.debugSecureStorage.testDirect() para testar secureStorage diretamente');