import { Page, expect } from '@playwright/test';

/**
 * Polling configuration interface
 */
export interface PollingConfig {
  interval: number;
  timeout: number;
  maxAttempts?: number;
}

/**
 * Status change event interface
 */
export interface StatusChangeEvent {
  timestamp: Date;
  oldStatus: string;
  newStatus: string;
  element: string;
}

/**
 * Order status types
 */
export type OrderStatus = 
  | 'pending_upload'
  | 'uploaded'
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Payment status types
 */
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'expired';

/**
 * Status polling helper for E2E tests
 * Provides utilities for monitoring order and payment status changes
 */
export class StatusPollingHelper {
  private page: Page;
  private defaultConfig: PollingConfig = {
    interval: 2000, // 2 seconds
    timeout: 60000, // 60 seconds
    maxAttempts: 30
  };

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Poll order status until it reaches expected status
   */
  async pollOrderStatus(
    orderId: string, 
    expectedStatus: OrderStatus, 
    config?: Partial<PollingConfig>
  ): Promise<void> {
    const pollingConfig = { ...this.defaultConfig, ...config };
    
    console.log(`🔄 Polling order ${orderId} for status: ${expectedStatus}`);
    console.log(`⚙️ Config: interval=${pollingConfig.interval}ms, timeout=${pollingConfig.timeout}ms`);
    
    const startTime = Date.now();
    let attempts = 0;
    let currentStatus = '';
    
    while (Date.now() - startTime < pollingConfig.timeout) {
      attempts++;
      
      if (pollingConfig.maxAttempts && attempts > pollingConfig.maxAttempts) {
        throw new Error(`Max attempts (${pollingConfig.maxAttempts}) reached while polling order ${orderId}`);
      }
      
      try {
        // Navigate to order status page if not already there
        const currentUrl = this.page.url();
        if (!currentUrl.includes(`/pedido/${orderId}`)) {
          await this.page.goto(`/pedido/${orderId}`);
          await this.page.waitForLoadState('networkidle', { timeout: 5000 });
        }
        
        // Get current status from the page
        currentStatus = await this.getCurrentOrderStatus();
        
        console.log(`📊 Attempt ${attempts}: Current status = ${currentStatus}, Expected = ${expectedStatus}`);
        
        if (currentStatus.toLowerCase() === expectedStatus.toLowerCase()) {
          console.log(`✅ Order ${orderId} reached expected status: ${expectedStatus} (${attempts} attempts)`);
          return;
        }
        
        // Check for error states
        if (currentStatus.toLowerCase() === 'failed') {
          throw new Error(`Order ${orderId} failed during processing`);
        }
        
        // Wait before next poll
        await this.page.waitForTimeout(pollingConfig.interval);
        
      } catch (error) {
        console.error(`❌ Error during polling attempt ${attempts}:`, error);
        
        // If it's a navigation or network error, retry
        if (error.message.includes('navigation') || error.message.includes('timeout')) {
          await this.page.waitForTimeout(pollingConfig.interval);
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error(
      `Timeout: Order ${orderId} did not reach status ${expectedStatus} within ${pollingConfig.timeout}ms. ` +
      `Last status: ${currentStatus} (${attempts} attempts)`
    );
  }

  /**
   * Poll payment status until it reaches expected status
   */
  async pollPaymentStatus(
    paymentId: string, 
    expectedStatus: PaymentStatus, 
    config?: Partial<PollingConfig>
  ): Promise<void> {
    const pollingConfig = { ...this.defaultConfig, ...config };
    
    console.log(`💳 Polling payment ${paymentId} for status: ${expectedStatus}`);
    
    const startTime = Date.now();
    let attempts = 0;
    let currentStatus = '';
    
    while (Date.now() - startTime < pollingConfig.timeout) {
      attempts++;
      
      if (pollingConfig.maxAttempts && attempts > pollingConfig.maxAttempts) {
        throw new Error(`Max attempts (${pollingConfig.maxAttempts}) reached while polling payment ${paymentId}`);
      }
      
      try {
        // Check payment status via API call or page inspection
        currentStatus = await this.getCurrentPaymentStatus(paymentId);
        
        console.log(`💳 Attempt ${attempts}: Payment status = ${currentStatus}, Expected = ${expectedStatus}`);
        
        if (currentStatus.toLowerCase() === expectedStatus.toLowerCase()) {
          console.log(`✅ Payment ${paymentId} reached expected status: ${expectedStatus} (${attempts} attempts)`);
          return;
        }
        
        // Check for terminal states
        if (['failed', 'cancelled', 'expired'].includes(currentStatus.toLowerCase())) {
          throw new Error(`Payment ${paymentId} reached terminal state: ${currentStatus}`);
        }
        
        // Wait before next poll
        await this.page.waitForTimeout(pollingConfig.interval);
        
      } catch (error) {
        console.error(`❌ Error during payment polling attempt ${attempts}:`, error);
        
        // Retry on network errors
        if (error.message.includes('network') || error.message.includes('timeout')) {
          await this.page.waitForTimeout(pollingConfig.interval);
          continue;
        }
        
        throw error;
      }
    }
    
    throw new Error(
      `Timeout: Payment ${paymentId} did not reach status ${expectedStatus} within ${pollingConfig.timeout}ms. ` +
      `Last status: ${currentStatus} (${attempts} attempts)`
    );
  }

  /**
   * Monitor real-time updates on a page element
   */
  async monitorRealTimeUpdates(
    elementSelector: string, 
    expectedChange: string,
    config?: Partial<PollingConfig>
  ): Promise<StatusChangeEvent> {
    const pollingConfig = { ...this.defaultConfig, ...config };
    
    console.log(`👀 Monitoring real-time updates on: ${elementSelector}`);
    
    // Get initial state
    await this.page.waitForSelector(elementSelector, { timeout: 10000 });
    let previousContent = await this.page.textContent(elementSelector) || '';
    
    const startTime = Date.now();
    let attempts = 0;
    
    while (Date.now() - startTime < pollingConfig.timeout) {
      attempts++;
      
      try {
        // Check current content
        const currentContent = await this.page.textContent(elementSelector) || '';
        
        if (currentContent !== previousContent) {
          console.log(`🔄 Content changed from "${previousContent}" to "${currentContent}"`);
          
          // Check if this is the expected change
          if (currentContent.includes(expectedChange)) {
            const changeEvent: StatusChangeEvent = {
              timestamp: new Date(),
              oldStatus: previousContent,
              newStatus: currentContent,
              element: elementSelector
            };
            
            console.log(`✅ Expected change detected: ${expectedChange}`);
            return changeEvent;
          }
          
          previousContent = currentContent;
        }
        
        // Wait before next check
        await this.page.waitForTimeout(pollingConfig.interval);
        
      } catch (error) {
        console.error(`❌ Error monitoring updates attempt ${attempts}:`, error);
        await this.page.waitForTimeout(pollingConfig.interval);
      }
    }
    
    throw new Error(
      `Timeout: Expected change "${expectedChange}" not detected in ${pollingConfig.timeout}ms ` +
      `(${attempts} attempts)`
    );
  }

  /**
   * Validate auto-refresh functionality
   */
  async validateAutoRefresh(refreshInterval: number): Promise<void> {
    console.log(`🔄 Validating auto-refresh with interval: ${refreshInterval}ms`);
    
    // Monitor network requests to detect refresh calls
    const refreshRequests: string[] = [];
    
    this.page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/orders') || url.includes('/api/payments')) {
        refreshRequests.push(`${new Date().toISOString()}: ${request.method()} ${url}`);
      }
    });
    
    // Wait for at least 2 refresh cycles
    const waitTime = refreshInterval * 2.5;
    await this.page.waitForTimeout(waitTime);
    
    // Validate that refresh requests were made
    if (refreshRequests.length < 2) {
      throw new Error(
        `Auto-refresh not working. Expected at least 2 requests in ${waitTime}ms, got ${refreshRequests.length}`
      );
    }
    
    console.log(`✅ Auto-refresh validated. Detected ${refreshRequests.length} refresh requests`);
    console.log('📋 Refresh requests:', refreshRequests);
  }

  /**
   * Wait for status change with timeout
   */
  async waitForStatusChange(
    statusSelector: string,
    fromStatus: string,
    toStatus: string,
    timeout: number = 30000
  ): Promise<void> {
    console.log(`⏳ Waiting for status change from "${fromStatus}" to "${toStatus}"`);
    
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const currentStatus = await this.page.textContent(statusSelector) || '';
        
        if (currentStatus.toLowerCase().includes(toStatus.toLowerCase())) {
          console.log(`✅ Status changed to: ${toStatus}`);
          return;
        }
        
        await this.page.waitForTimeout(1000);
      } catch (error) {
        console.error('Error checking status:', error);
        await this.page.waitForTimeout(1000);
      }
    }
    
    throw new Error(`Timeout: Status did not change from "${fromStatus}" to "${toStatus}" within ${timeout}ms`);
  }

  /**
   * Get current order status from the page
   */
  private async getCurrentOrderStatus(): Promise<string> {
    // Try different selectors for order status
    const statusSelectors = [
      '.order-status-card .status',
      '[data-testid="order-status"]',
      '.status-indicator',
      '.order-status',
      '.badge'
    ];
    
    for (const selector of statusSelectors) {
      try {
        const element = this.page.locator(selector);
        if (await element.count() > 0) {
          const text = await element.textContent();
          if (text && text.trim()) {
            return text.trim().toLowerCase();
          }
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    
    // Fallback: look for status in page text
    const pageText = await this.page.textContent('body') || '';
    const statusKeywords = ['pending', 'processing', 'completed', 'failed', 'paid', 'uploaded'];
    
    for (const keyword of statusKeywords) {
      if (pageText.toLowerCase().includes(keyword)) {
        return keyword;
      }
    }
    
    throw new Error('Could not determine current order status from page');
  }

  /**
   * Get current payment status
   */
  private async getCurrentPaymentStatus(paymentId: string): Promise<string> {
    try {
      // Try to get payment status via API call
      const response = await this.page.evaluate(async (id) => {
        const response = await fetch(`/api/payments/${id}/status`);
        if (response.ok) {
          const data = await response.json();
          return data.status || data.data?.status;
        }
        return null;
      }, paymentId);
      
      if (response) {
        return response.toLowerCase();
      }
    } catch (error) {
      console.warn('Could not get payment status via API:', error);
    }
    
    // Fallback: look for payment status in page
    const pageText = await this.page.textContent('body') || '';
    const paymentStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'];
    
    for (const status of paymentStatuses) {
      if (pageText.toLowerCase().includes(status)) {
        return status;
      }
    }
    
    throw new Error(`Could not determine payment status for ${paymentId}`);
  }

  /**
   * Monitor multiple elements for changes simultaneously
   */
  async monitorMultipleElements(
    elements: { selector: string; expectedChange: string }[],
    config?: Partial<PollingConfig>
  ): Promise<StatusChangeEvent[]> {
    const pollingConfig = { ...this.defaultConfig, ...config };
    const changes: StatusChangeEvent[] = [];
    
    console.log(`👀 Monitoring ${elements.length} elements for changes`);
    
    const startTime = Date.now();
    const initialStates = new Map<string, string>();
    
    // Get initial states
    for (const element of elements) {
      try {
        await this.page.waitForSelector(element.selector, { timeout: 5000 });
        const content = await this.page.textContent(element.selector) || '';
        initialStates.set(element.selector, content);
      } catch (error) {
        console.warn(`Could not get initial state for ${element.selector}:`, error);
        initialStates.set(element.selector, '');
      }
    }
    
    while (Date.now() - startTime < pollingConfig.timeout) {
      for (const element of elements) {
        try {
          const currentContent = await this.page.textContent(element.selector) || '';
          const previousContent = initialStates.get(element.selector) || '';
          
          if (currentContent !== previousContent && currentContent.includes(element.expectedChange)) {
            const changeEvent: StatusChangeEvent = {
              timestamp: new Date(),
              oldStatus: previousContent,
              newStatus: currentContent,
              element: element.selector
            };
            
            changes.push(changeEvent);
            console.log(`✅ Change detected in ${element.selector}: ${element.expectedChange}`);
          }
        } catch (error) {
          console.warn(`Error monitoring ${element.selector}:`, error);
        }
      }
      
      // If all expected changes detected, return
      if (changes.length === elements.length) {
        console.log(`✅ All ${elements.length} expected changes detected`);
        return changes;
      }
      
      await this.page.waitForTimeout(pollingConfig.interval);
    }
    
    console.log(`⏰ Monitoring timeout. Detected ${changes.length}/${elements.length} changes`);
    return changes;
  }
}

/**
 * Create a new status polling helper instance
 */
export function createStatusPollingHelper(page: Page): StatusPollingHelper {
  return new StatusPollingHelper(page);
}