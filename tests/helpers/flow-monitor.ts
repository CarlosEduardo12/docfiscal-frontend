import { Page, Response, expect } from '@playwright/test';
import { NetworkError, NetworkLogger } from './network-logger';
import { Evidence, FlowResult, StepResult } from './error-reporter';

/**
 * UI Action interface for flow step actions
 */
export interface UIAction {
  type: 'click' | 'fill' | 'select' | 'upload' | 'wait' | 'navigate' | 'screenshot';
  selector?: string;
  value?: string;
  file?: string;
  url?: string;
  timeout?: number;
  description?: string;
}

/**
 * Flow Step interface for defining test steps
 */
export interface FlowStep {
  name: string;
  description: string;
  url?: string;
  expectedElements: string[];
  apiCalls: string[];
  timeout: number;
  actions: UIAction[];
  validationRules?: ValidationRule[];
}

/**
 * Validation Rule interface for step validation
 */
export interface ValidationRule {
  type: 'element_visible' | 'element_text' | 'url_contains' | 'api_response' | 'custom';
  selector?: string;
  expectedText?: string;
  expectedUrl?: string;
  apiEndpoint?: string;
  expectedStatus?: number;
  customValidator?: (page: Page) => Promise<boolean>;
  description: string;
}

/**
 * Flow Monitor class for executing and monitoring test flows
 */
export class FlowMonitor {
  private networkLogger: NetworkLogger;
  private evidence: Evidence[] = [];
  private currentFlow: string = '';

  constructor(networkLogger?: NetworkLogger) {
    this.networkLogger = networkLogger || new NetworkLogger();
  }

  /**
   * Execute a complete flow with multiple steps
   */
  async executeFlow(page: Page, flowName: string, steps: FlowStep[]): Promise<FlowResult> {
    this.currentFlow = flowName;
    this.networkLogger.setFlowContext(flowName);
    
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    const flowErrors: NetworkError[] = [];
    let flowStatus: 'passed' | 'failed' | 'skipped' = 'passed';

    console.log(`🚀 Starting flow: ${flowName}`);

    // Set up network error monitoring
    await this.networkLogger.captureBackendErrors(page);

    try {
      // Execute each step in sequence
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        console.log(`📋 Executing step ${i + 1}/${steps.length}: ${step.name}`);
        
        this.networkLogger.setFlowContext(flowName, step.name);
        
        const stepResult = await this.executeStep(page, step);
        stepResults.push(stepResult);
        
        if (stepResult.status === 'failed') {
          flowStatus = 'failed';
          console.error(`❌ Step failed: ${step.name} - ${stepResult.error}`);
          
          // Capture evidence on failure
          await this.captureFailureEvidence(page, `${flowName}-${step.name}-failure`);
          
          // Stop execution on critical failures
          break;
        }
        
        console.log(`✅ Step completed: ${step.name} (${stepResult.duration}ms)`);
      }
      
      // Collect any network errors that occurred during flow
      const networkErrors = this.networkLogger.getErrors();
      flowErrors.push(...networkErrors);
      
      if (networkErrors.length > 0) {
        flowStatus = 'failed';
        console.warn(`⚠️  Flow ${flowName} had ${networkErrors.length} network errors`);
      }
      
    } catch (error) {
      flowStatus = 'failed';
      console.error(`💥 Flow execution failed: ${error}`);
      
      // Add final step result for the error
      stepResults.push({
        name: 'Flow Execution Error',
        status: 'failed',
        duration: 0,
        error: error instanceof Error ? error.message : String(error)
      });
      
      await this.captureFailureEvidence(page, `${flowName}-execution-error`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result: FlowResult = {
      flowName,
      status: flowStatus,
      duration,
      steps: stepResults,
      errors: flowErrors,
      evidence: [...this.evidence],
      metadata: {
        browser: page.context().browser()?.browserType().name() || 'unknown',
        viewport: page.viewportSize()?.width + 'x' + page.viewportSize()?.height || 'unknown',
        timestamp: new Date()
      }
    };

    console.log(`🏁 Flow ${flowName} completed: ${flowStatus} (${duration}ms)`);
    
    // Clear evidence for next flow
    this.evidence = [];
    this.networkLogger.clearErrors();
    
    return result;
  }

  /**
   * Execute a single flow step
   */
  async executeStep(page: Page, step: FlowStep): Promise<StepResult> {
    const startTime = Date.now();
    
    try {
      // Navigate to URL if specified
      if (step.url) {
        console.log(`🌐 Navigating to: ${step.url}`);
        await page.goto(step.url, { waitUntil: 'networkidle', timeout: step.timeout });
      }

      // Execute actions in sequence
      for (const action of step.actions) {
        await this.executeUIAction(page, action);
      }

      // Wait for expected elements
      for (const selector of step.expectedElements) {
        await this.waitForElement(page, selector, step.timeout);
      }

      // Wait for expected API calls
      for (const apiPattern of step.apiCalls) {
        await this.waitForApiCall(page, apiPattern, step.timeout);
      }

      // Run validation rules
      if (step.validationRules) {
        for (const rule of step.validationRules) {
          await this.validateRule(page, rule);
        }
      }

      const endTime = Date.now();
      return {
        name: step.name,
        status: 'passed',
        duration: endTime - startTime
      };

    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Capture screenshot on step failure
      const screenshot = await this.captureScreenshot(page, `${step.name}-error`);
      
      return {
        name: step.name,
        status: 'failed',
        duration: endTime - startTime,
        error: errorMessage,
        screenshot
      };
    }
  }

  /**
   * Execute a UI action
   */
  private async executeUIAction(page: Page, action: UIAction): Promise<void> {
    const timeout = action.timeout || 10000;
    
    console.log(`🎯 Executing action: ${action.type} ${action.selector || action.url || ''}`);
    
    switch (action.type) {
      case 'click':
        if (!action.selector) throw new Error('Click action requires selector');
        await page.click(action.selector, { timeout });
        break;
        
      case 'fill':
        if (!action.selector || !action.value) throw new Error('Fill action requires selector and value');
        await page.fill(action.selector, action.value, { timeout });
        break;
        
      case 'select':
        if (!action.selector || !action.value) throw new Error('Select action requires selector and value');
        await page.selectOption(action.selector, action.value, { timeout });
        break;
        
      case 'upload':
        if (!action.selector || !action.file) throw new Error('Upload action requires selector and file');
        await page.setInputFiles(action.selector, action.file, { timeout });
        break;
        
      case 'wait':
        const waitTime = action.timeout || 1000;
        await page.waitForTimeout(waitTime);
        break;
        
      case 'navigate':
        if (!action.url) throw new Error('Navigate action requires URL');
        await page.goto(action.url, { waitUntil: 'networkidle', timeout });
        break;
        
      case 'screenshot':
        const filename = action.value || `screenshot-${Date.now()}`;
        await this.captureScreenshot(page, filename);
        break;
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
    
    // Small delay between actions for stability
    await page.waitForTimeout(100);
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(page: Page, selector: string, timeout: number = 10000): Promise<void> {
    console.log(`⏳ Waiting for element: ${selector}`);
    
    try {
      await page.waitForSelector(selector, { 
        state: 'visible', 
        timeout 
      });
      console.log(`✅ Element found: ${selector}`);
    } catch (error) {
      console.error(`❌ Element not found: ${selector}`);
      throw new Error(`Element not found within ${timeout}ms: ${selector}`);
    }
  }

  /**
   * Wait for an API call matching the pattern
   */
  async waitForApiCall(page: Page, urlPattern: string, timeout: number = 10000): Promise<Response> {
    console.log(`⏳ Waiting for API call: ${urlPattern}`);
    
    try {
      const response = await page.waitForResponse(
        (response) => response.url().includes(urlPattern),
        { timeout }
      );
      
      console.log(`✅ API call detected: ${response.url()} (${response.status()})`);
      return response;
    } catch (error) {
      console.error(`❌ API call not detected: ${urlPattern}`);
      throw new Error(`API call not detected within ${timeout}ms: ${urlPattern}`);
    }
  }

  /**
   * Validate a rule against the current page state
   */
  private async validateRule(page: Page, rule: ValidationRule): Promise<void> {
    console.log(`🔍 Validating rule: ${rule.description}`);
    
    try {
      switch (rule.type) {
        case 'element_visible':
          if (!rule.selector) throw new Error('element_visible rule requires selector');
          await expect(page.locator(rule.selector)).toBeVisible();
          break;
          
        case 'element_text':
          if (!rule.selector || !rule.expectedText) throw new Error('element_text rule requires selector and expectedText');
          await expect(page.locator(rule.selector)).toContainText(rule.expectedText);
          break;
          
        case 'url_contains':
          if (!rule.expectedUrl) throw new Error('url_contains rule requires expectedUrl');
          expect(page.url()).toContain(rule.expectedUrl);
          break;
          
        case 'api_response':
          if (!rule.apiEndpoint) throw new Error('api_response rule requires apiEndpoint');
          // This would need to be implemented based on captured network responses
          console.warn('API response validation not yet implemented');
          break;
          
        case 'custom':
          if (!rule.customValidator) throw new Error('custom rule requires customValidator');
          const isValid = await rule.customValidator(page);
          expect(isValid).toBe(true);
          break;
          
        default:
          throw new Error(`Unknown validation rule type: ${rule.type}`);
      }
      
      console.log(`✅ Rule passed: ${rule.description}`);
    } catch (error) {
      console.error(`❌ Rule failed: ${rule.description}`);
      throw error;
    }
  }

  /**
   * Capture screenshot evidence
   */
  private async captureScreenshot(page: Page, filename: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `tests/reports/screenshots/${filename}-${timestamp}.png`;
    
    try {
      await page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      
      console.log(`📸 Screenshot captured: ${screenshotPath}`);
      return screenshotPath;
    } catch (error) {
      console.error(`Failed to capture screenshot: ${error}`);
      return '';
    }
  }

  /**
   * Capture comprehensive failure evidence
   */
  async captureFailureEvidence(page: Page, context: string): Promise<void> {
    const timestamp = new Date();
    
    try {
      // Capture screenshot
      const screenshotPath = await this.captureScreenshot(page, `failure-${context}`);
      if (screenshotPath) {
        this.evidence.push({
          type: 'screenshot',
          data: screenshotPath,
          timestamp,
          description: `Failure screenshot for ${context}`
        });
      }

      // Capture page source
      const pageSource = await page.content();
      this.evidence.push({
        type: 'page_source',
        data: pageSource,
        timestamp,
        description: `Page source at failure for ${context}`
      });

      // Capture console logs
      const consoleLogs = await page.evaluate(() => {
        // Get recent console messages if available
        return (window as any).consoleMessages || [];
      });
      
      if (consoleLogs.length > 0) {
        this.evidence.push({
          type: 'console_log',
          data: JSON.stringify(consoleLogs),
          timestamp,
          description: `Console logs at failure for ${context}`
        });
      }

      // Capture network logs (from network logger)
      const networkErrors = this.networkLogger.getErrors();
      if (networkErrors.length > 0) {
        this.evidence.push({
          type: 'network_log',
          data: JSON.stringify(networkErrors),
          timestamp,
          description: `Network errors for ${context}`
        });
      }

      console.log(`🔍 Evidence captured for ${context}`);
    } catch (error) {
      console.error(`Failed to capture evidence: ${error}`);
    }
  }

  /**
   * Get collected evidence
   */
  getEvidence(): Evidence[] {
    return [...this.evidence];
  }

  /**
   * Clear collected evidence
   */
  clearEvidence(): void {
    this.evidence = [];
  }

  /**
   * Create a flow step builder for easier step creation
   */
  static createStep(name: string): FlowStepBuilder {
    return new FlowStepBuilder(name);
  }
}

/**
 * Flow Step Builder for easier step creation
 */
export class FlowStepBuilder {
  private step: FlowStep;

  constructor(name: string) {
    this.step = {
      name,
      description: '',
      expectedElements: [],
      apiCalls: [],
      timeout: 10000,
      actions: []
    };
  }

  description(desc: string): FlowStepBuilder {
    this.step.description = desc;
    return this;
  }

  url(url: string): FlowStepBuilder {
    this.step.url = url;
    return this;
  }

  expectElement(selector: string): FlowStepBuilder {
    this.step.expectedElements.push(selector);
    return this;
  }

  expectApiCall(pattern: string): FlowStepBuilder {
    this.step.apiCalls.push(pattern);
    return this;
  }

  timeout(ms: number): FlowStepBuilder {
    this.step.timeout = ms;
    return this;
  }

  click(selector: string): FlowStepBuilder {
    this.step.actions.push({ type: 'click', selector });
    return this;
  }

  fill(selector: string, value: string): FlowStepBuilder {
    this.step.actions.push({ type: 'fill', selector, value });
    return this;
  }

  upload(selector: string, file: string): FlowStepBuilder {
    this.step.actions.push({ type: 'upload', selector, file });
    return this;
  }

  wait(ms: number): FlowStepBuilder {
    this.step.actions.push({ type: 'wait', timeout: ms });
    return this;
  }

  screenshot(filename?: string): FlowStepBuilder {
    this.step.actions.push({ type: 'screenshot', value: filename });
    return this;
  }

  validate(rule: ValidationRule): FlowStepBuilder {
    if (!this.step.validationRules) {
      this.step.validationRules = [];
    }
    this.step.validationRules.push(rule);
    return this;
  }

  build(): FlowStep {
    return { ...this.step };
  }
}

/**
 * Create a new flow monitor instance
 */
export function createFlowMonitor(networkLogger?: NetworkLogger): FlowMonitor {
  return new FlowMonitor(networkLogger);
}