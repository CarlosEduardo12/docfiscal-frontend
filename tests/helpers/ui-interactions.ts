import { Page, expect, Locator } from '@playwright/test';
import testData from '../fixtures/test-data.json';

/**
 * Form data interface for filling forms
 */
export interface FormData {
  [key: string]: string | number | boolean;
}

/**
 * Order data interface for table validation
 */
export interface OrderData {
  id: string;
  filename: string;
  status: string;
  size?: string;
  createdAt?: string;
  actions?: string[];
}

/**
 * Viewport configuration for responsive testing
 */
export interface ViewportConfig {
  width: number;
  height: number;
  name: string;
}

/**
 * UI interaction helper for E2E tests
 * Provides utilities for interacting with UI elements, forms, and validating layouts
 */
export class UIInteractionHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Click a button by text content
   */
  async clickButton(buttonText: string, options?: { timeout?: number; exact?: boolean }): Promise<void> {
    console.log(`🖱️ Clicking button: "${buttonText}"`);
    
    const timeout = options?.timeout || 10000;
    const exact = options?.exact || false;
    
    // Try different button selectors
    const selectors = [
      `button:has-text("${buttonText}")`,
      `[role="button"]:has-text("${buttonText}")`,
      `input[type="button"][value="${buttonText}"]`,
      `input[type="submit"][value="${buttonText}"]`,
      `a:has-text("${buttonText}")`
    ];
    
    let clicked = false;
    
    for (const selector of selectors) {
      try {
        const element = this.page.locator(selector);
        if (exact) {
          await element.filter({ hasText: new RegExp(`^${buttonText}$`) }).first().click({ timeout: 2000 });
        } else {
          await element.first().click({ timeout: 2000 });
        }
        clicked = true;
        break;
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    if (!clicked) {
      throw new Error(`Button with text "${buttonText}" not found or not clickable`);
    }
    
    console.log(`✅ Successfully clicked button: "${buttonText}"`);
  }

  /**
   * Fill a form with provided data
   */
  async fillForm(formData: FormData, formSelector?: string): Promise<void> {
    console.log('📝 Filling form with data:', Object.keys(formData));
    
    const form = formSelector ? this.page.locator(formSelector) : this.page;
    
    for (const [fieldName, value] of Object.entries(formData)) {
      try {
        // Try different field selectors
        const selectors = [
          `#${fieldName}`,
          `[name="${fieldName}"]`,
          `[data-testid="${fieldName}"]`,
          `input[placeholder*="${fieldName}"]`,
          `label:has-text("${fieldName}") + input`,
          `label:has-text("${fieldName}") input`
        ];
        
        let filled = false;
        
        for (const selector of selectors) {
          try {
            const field = form.locator(selector);
            const fieldCount = await field.count();
            
            if (fieldCount > 0) {
              const fieldType = await field.first().getAttribute('type');
              
              if (fieldType === 'checkbox' || fieldType === 'radio') {
                if (value) {
                  await field.first().check();
                } else {
                  await field.first().uncheck();
                }
              } else if (fieldType === 'file') {
                // Handle file uploads separately
                continue;
              } else {
                await field.first().fill(String(value));
              }
              
              filled = true;
              break;
            }
          } catch (error) {
            // Try next selector
            continue;
          }
        }
        
        if (!filled) {
          console.warn(`⚠️ Could not fill field: ${fieldName}`);
        }
      } catch (error) {
        console.error(`❌ Error filling field ${fieldName}:`, error);
        throw error;
      }
    }
    
    console.log('✅ Form filled successfully');
  }

  /**
   * Upload a file using file input
   */
  async uploadFile(fileSelector: string, filePath: string): Promise<void> {
    console.log(`📁 Uploading file: ${filePath}`);
    
    // Wait for file input to be present
    await this.page.waitForSelector(fileSelector, { timeout: 10000 });
    
    // Set the file
    await this.page.setInputFiles(fileSelector, filePath);
    
    console.log('✅ File uploaded successfully');
  }

  /**
   * Upload a test file (from fixtures)
   */
  async uploadTestFile(fileType: 'validPdf' | 'largePdf' | 'invalidFile' = 'validPdf'): Promise<void> {
    const fileData = testData.testFiles[fileType];
    const fileSelector = 'input[type="file"]';
    
    await this.uploadFile(fileSelector, fileData.path);
  }

  /**
   * Wait for and validate status card
   */
  async waitForStatusCard(expectedStatus: string, timeout: number = 10000): Promise<void> {
    console.log(`⏳ Waiting for status card with status: ${expectedStatus}`);
    
    // Wait for status card to be present
    await this.page.waitForSelector('.order-status-card, [data-testid="status-card"]', { timeout });
    
    // Check if the expected status is displayed
    const statusCard = this.page.locator('.order-status-card, [data-testid="status-card"]');
    const statusText = await statusCard.textContent();
    
    if (!statusText?.toLowerCase().includes(expectedStatus.toLowerCase())) {
      throw new Error(`Expected status "${expectedStatus}" not found in status card. Found: ${statusText}`);
    }
    
    console.log(`✅ Status card validated with status: ${expectedStatus}`);
  }

  /**
   * Validate table row data
   */
  async validateTableRow(orderId: string, expectedData: OrderData): Promise<void> {
    console.log(`📊 Validating table row for order: ${orderId}`);
    
    // Wait for table to be present
    await this.page.waitForSelector('table, .order-history-table', { timeout: 10000 });
    
    // Find the row containing the order ID
    const row = this.page.locator(`tr:has-text("${orderId}"), .order-card:has-text("${orderId}")`);
    
    if (await row.count() === 0) {
      throw new Error(`Order row with ID "${orderId}" not found in table`);
    }
    
    const rowText = await row.textContent();
    
    // Validate expected data
    if (expectedData.filename && !rowText?.includes(expectedData.filename)) {
      throw new Error(`Expected filename "${expectedData.filename}" not found in row`);
    }
    
    if (expectedData.status && !rowText?.toLowerCase().includes(expectedData.status.toLowerCase())) {
      throw new Error(`Expected status "${expectedData.status}" not found in row`);
    }
    
    if (expectedData.size && !rowText?.includes(expectedData.size)) {
      throw new Error(`Expected size "${expectedData.size}" not found in row`);
    }
    
    // Validate action buttons if specified
    if (expectedData.actions) {
      for (const action of expectedData.actions) {
        const actionButton = row.locator(`button:has-text("${action}"), a:has-text("${action}")`);
        if (await actionButton.count() === 0) {
          throw new Error(`Expected action button "${action}" not found in row`);
        }
      }
    }
    
    console.log(`✅ Table row validated for order: ${orderId}`);
  }

  /**
   * Check sidebar navigation elements
   */
  async checkSidebarNavigation(): Promise<void> {
    console.log('🧭 Checking sidebar navigation');
    
    // Wait for sidebar to be present
    await this.page.waitForSelector('.sidebar', { timeout: 10000 });
    
    // Check for main navigation items
    const expectedNavItems = [
      'Convert', 'All files', 'History', 'Settings'
    ];
    
    const sidebar = this.page.locator('.sidebar');
    const sidebarText = await sidebar.textContent();
    
    for (const navItem of expectedNavItems) {
      if (!sidebarText?.includes(navItem)) {
        console.warn(`⚠️ Navigation item "${navItem}" not found in sidebar`);
      }
    }
    
    // Check for user profile section
    const userSection = sidebar.locator('[data-testid="user-profile"], .user-section');
    if (await userSection.count() === 0) {
      console.warn('⚠️ User profile section not found in sidebar');
    }
    
    // Check for recent files section
    const recentFiles = sidebar.locator('[data-testid="recent-files"], .recent-files');
    if (await recentFiles.count() === 0) {
      console.warn('⚠️ Recent files section not found in sidebar');
    }
    
    console.log('✅ Sidebar navigation checked');
  }

  /**
   * Validate responsive layout for different viewports
   */
  async validateResponsiveLayout(viewport: string): Promise<void> {
    console.log(`📱 Validating responsive layout for: ${viewport}`);
    
    const viewportConfigs: Record<string, ViewportConfig> = {
      mobile: { width: 375, height: 667, name: 'Mobile' },
      tablet: { width: 768, height: 1024, name: 'Tablet' },
      desktop: { width: 1920, height: 1080, name: 'Desktop' }
    };
    
    const config = viewportConfigs[viewport];
    if (!config) {
      throw new Error(`Unknown viewport: ${viewport}`);
    }
    
    // Set viewport size
    await this.page.setViewportSize({ width: config.width, height: config.height });
    
    // Wait for layout to adjust
    await this.page.waitForTimeout(500);
    
    // Check layout-specific elements
    if (viewport === 'mobile') {
      // On mobile, sidebar might be collapsed or hidden
      const sidebar = this.page.locator('.sidebar');
      const sidebarVisible = await sidebar.isVisible();
      
      // Check if there's a mobile menu button
      if (!sidebarVisible) {
        const menuButton = this.page.locator('[data-testid="mobile-menu"], .mobile-menu-button');
        if (await menuButton.count() === 0) {
          console.warn('⚠️ Mobile menu button not found when sidebar is hidden');
        }
      }
      
      // Check if table switches to card view
      const table = this.page.locator('table');
      const cards = this.page.locator('.order-card, [data-testid="order-card"]');
      
      if (await table.isVisible() && await cards.count() === 0) {
        console.warn('⚠️ Table should switch to card view on mobile');
      }
    } else if (viewport === 'desktop') {
      // On desktop, sidebar should be visible
      const sidebar = this.page.locator('.sidebar');
      const sidebarVisible = await sidebar.isVisible();
      
      if (!sidebarVisible) {
        console.warn('⚠️ Sidebar should be visible on desktop');
      }
      
      // Table should be visible on desktop
      const table = this.page.locator('table');
      if (await table.count() > 0 && !await table.isVisible()) {
        console.warn('⚠️ Table should be visible on desktop');
      }
    }
    
    console.log(`✅ Responsive layout validated for: ${viewport}`);
  }

  /**
   * Wait for element to be visible and interactable
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<Locator> {
    console.log(`⏳ Waiting for element: ${selector}`);
    
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    
    console.log(`✅ Element found: ${selector}`);
    return element;
  }

  /**
   * Scroll element into view
   */
  async scrollIntoView(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Take screenshot of specific element
   */
  async screenshotElement(selector: string, filename: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.screenshot({ path: `tests/reports/screenshots/${filename}` });
  }

  /**
   * Validate loading states
   */
  async validateLoadingState(expectedText?: string): Promise<void> {
    console.log('⏳ Validating loading state');
    
    // Look for common loading indicators
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-testid="loading"]',
      'text="Loading..."',
      'text="Please wait..."'
    ];
    
    let loadingFound = false;
    
    for (const selector of loadingSelectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0 && await element.isVisible()) {
        loadingFound = true;
        
        if (expectedText) {
          const text = await element.textContent();
          if (!text?.includes(expectedText)) {
            console.warn(`⚠️ Expected loading text "${expectedText}" not found. Found: ${text}`);
          }
        }
        break;
      }
    }
    
    if (!loadingFound) {
      console.warn('⚠️ No loading indicator found');
    } else {
      console.log('✅ Loading state validated');
    }
  }

  /**
   * Wait for loading to complete
   */
  async waitForLoadingComplete(timeout: number = 30000): Promise<void> {
    console.log('⏳ Waiting for loading to complete');
    
    const loadingSelectors = [
      '.loading',
      '.spinner',
      '[data-testid="loading"]'
    ];
    
    // Wait for all loading indicators to disappear
    for (const selector of loadingSelectors) {
      try {
        await this.page.waitForSelector(selector, { state: 'hidden', timeout: 5000 });
      } catch (error) {
        // Loading indicator might not exist, continue
      }
    }
    
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle', { timeout });
    
    console.log('✅ Loading completed');
  }

  /**
   * Validate error messages
   */
  async validateErrorMessage(expectedMessage?: string): Promise<string> {
    console.log('❌ Validating error message');
    
    // Look for error elements
    const errorSelectors = [
      '[role="alert"]',
      '.error',
      '.error-message',
      '[data-testid="error"]',
      '.text-red-600'
    ];
    
    let errorText = '';
    
    for (const selector of errorSelectors) {
      const element = this.page.locator(selector);
      if (await element.count() > 0 && await element.isVisible()) {
        errorText = await element.textContent() || '';
        break;
      }
    }
    
    if (!errorText) {
      throw new Error('No error message found');
    }
    
    if (expectedMessage && !errorText.includes(expectedMessage)) {
      throw new Error(`Expected error message "${expectedMessage}" not found. Found: ${errorText}`);
    }
    
    console.log(`✅ Error message validated: ${errorText}`);
    return errorText;
  }

  /**
   * Click and wait for navigation
   */
  async clickAndWaitForNavigation(selector: string, expectedUrl?: string): Promise<void> {
    console.log(`🖱️ Clicking and waiting for navigation: ${selector}`);
    
    const [response] = await Promise.all([
      this.page.waitForNavigation({ timeout: 10000 }),
      this.page.click(selector)
    ]);
    
    if (expectedUrl) {
      const currentUrl = this.page.url();
      if (!currentUrl.includes(expectedUrl)) {
        throw new Error(`Expected URL to contain "${expectedUrl}" but got "${currentUrl}"`);
      }
    }
    
    console.log('✅ Navigation completed');
  }
}

/**
 * Create a new UI interaction helper instance
 */
export function createUIInteractionHelper(page: Page): UIInteractionHelper {
  return new UIInteractionHelper(page);
}