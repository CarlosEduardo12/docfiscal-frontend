import { test, expect } from '@playwright/test';
import { AuthHelper } from '../helpers/auth';
import { UIInteractionHelper } from '../helpers/ui-interactions';
import { NetworkLogger } from '../helpers/network-logger';
import { ErrorReporter } from '../helpers/error-reporter';

test.describe('6.1 Landing Page Elements Test', () => {
  let authHelper: AuthHelper;
  let uiHelper: UIInteractionHelper;
  let networkLogger: NetworkLogger;
  let errorReporter: ErrorReporter;
  let networkErrors: any[] = [];

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    uiHelper = new UIInteractionHelper(page);
    networkLogger = new NetworkLogger();
    errorReporter = new ErrorReporter();
    networkErrors = [];

    // Set up network error capture
    networkLogger.captureBackendErrors(page, networkErrors);

    // Navigate to landing page (unauthenticated)
    await page.goto('/');
  });

  test.afterEach(async () => {
    // Report any network errors found during test
    if (networkErrors.length > 0) {
      const report = errorReporter.generateReport(networkErrors, []);
      console.error('Network errors detected:', JSON.stringify(report, null, 2));
      throw new Error(`Test failed due to ${networkErrors.length} backend errors`);
    }
  });

  test('should display hero section with title and description', async ({ page }) => {
    console.log('🧪 Testing hero section elements...');

    // Verify main title
    await expect(page.locator('h1:has-text("DocFiscal")')).toBeVisible();
    
    // Verify description text
    await expect(page.locator('text=Converta seus PDFs em CSV de forma rápida, segura e profissional')).toBeVisible();
    
    console.log('✅ Hero section elements verified');
  });

  test('should display CTA buttons with correct functionality', async ({ page }) => {
    console.log('🧪 Testing CTA buttons functionality...');

    // Verify "Fazer Login" button is visible and clickable
    const loginButton = page.locator('button:has-text("Fazer Login")');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toBeEnabled();
    
    // Verify "Criar Conta" button is visible and clickable
    const registerButton = page.locator('button:has-text("Criar Conta")');
    await expect(registerButton).toBeVisible();
    await expect(registerButton).toBeEnabled();

    // Test login button navigation
    await loginButton.click();
    await expect(page).toHaveURL('/login');
    
    // Go back to landing page
    await page.goto('/');
    
    // Test register button navigation
    await registerButton.click();
    await expect(page).toHaveURL('/register');
    
    console.log('✅ CTA buttons functionality verified');
  });

  test('should display feature cards with icons and descriptions', async ({ page }) => {
    console.log('🧪 Testing feature cards...');

    // Verify "Processamento Rápido" card
    const rapidProcessingCard = page.locator('text=Processamento Rápido').locator('..');
    await expect(rapidProcessingCard).toBeVisible();
    await expect(page.locator('text=Converta seus arquivos em segundos com nossa tecnologia avançada')).toBeVisible();
    
    // Verify "100% Seguro" card
    const securityCard = page.locator('text=100% Seguro').locator('..');
    await expect(securityCard).toBeVisible();
    await expect(page.locator('text=Seus dados são protegidos e automaticamente excluídos após a conversão')).toBeVisible();
    
    // Verify "Alta Qualidade" card
    const qualityCard = page.locator('text=Alta Qualidade').locator('..');
    await expect(qualityCard).toBeVisible();
    await expect(page.locator('text=Conversão precisa mantendo a integridade dos seus dados')).toBeVisible();

    // Verify icons are present (using Lucide icons)
    await expect(page.locator('[data-lucide="zap"], .lucide-zap')).toBeVisible();
    await expect(page.locator('[data-lucide="shield"], .lucide-shield')).toBeVisible();
    await expect(page.locator('[data-lucide="file-text"], .lucide-file-text')).toBeVisible();
    
    console.log('✅ Feature cards verified');
  });

  test('should display "Como Funciona" section with steps', async ({ page }) => {
    console.log('🧪 Testing "Como Funciona" section...');

    // Verify section title
    await expect(page.locator('h2:has-text("Como Funciona")')).toBeVisible();
    
    // Verify step 1: Upload do PDF
    await expect(page.locator('text=Upload do PDF')).toBeVisible();
    await expect(page.locator('text=Faça upload do seu arquivo PDF')).toBeVisible();
    await expect(page.locator('div:has-text("1")').first()).toBeVisible();
    
    // Verify step 2: Pagamento
    await expect(page.locator('h4:has-text("Pagamento")')).toBeVisible();
    await expect(page.locator('text=Complete o pagamento via PIX')).toBeVisible();
    await expect(page.locator('div:has-text("2")').first()).toBeVisible();
    
    // Verify step 3: Download
    await expect(page.locator('text=Download')).toBeVisible();
    await expect(page.locator('text=Baixe seu arquivo CSV convertido')).toBeVisible();
    await expect(page.locator('div:has-text("3")').first()).toBeVisible();
    
    console.log('✅ "Como Funciona" section verified');
  });

  test('should have proper responsive layout', async ({ page }) => {
    console.log('🧪 Testing responsive layout...');

    // Test desktop layout
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('h1:has-text("DocFiscal")')).toBeVisible();
    
    // Test mobile layout
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1:has-text("DocFiscal")')).toBeVisible();
    await expect(page.locator('button:has-text("Fazer Login")')).toBeVisible();
    await expect(page.locator('button:has-text("Criar Conta")')).toBeVisible();
    
    console.log('✅ Responsive layout verified');
  });
});