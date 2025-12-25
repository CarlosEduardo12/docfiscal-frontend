import { test, expect } from '@playwright/test';
import * as fc from 'fast-check';
import playwrightConfig from '../../playwright.config';

/**
 * Property-Based Test for Playwright Configuration
 * Feature: e2e-flow-testing, Property 7: Test Execution Reporting
 * Validates: Requirements 10.2
 * 
 * Property 7: Test Execution Reporting
 * For any test run, the system should generate clear execution reports 
 * containing pass/fail status, execution time, and error summaries
 */

test.describe('Playwright Configuration Property Tests', () => {
  test('Property 7: Test execution reporting configuration completeness', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different test execution scenarios
        fc.record({
          testName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          testStatus: fc.constantFrom('passed', 'failed', 'skipped'),
          executionTime: fc.integer({ min: 1, max: 59000 }), // 1ms to 59 seconds (within timeout)
          errorCount: fc.integer({ min: 0, max: 10 }),
          browserName: fc.constantFrom('chromium', 'firefox', 'webkit')
        }),
        async (testScenario) => {
          // Validate that configuration supports comprehensive reporting
          const config = playwrightConfig;
          
          // Property: Configuration must have reporters configured
          expect(config.reporter).toBeDefined();
          expect(Array.isArray(config.reporter)).toBe(true);
          
          const reporters = config.reporter as Array<any>;
          
          // Property: Must include HTML reporter for visual reports
          const htmlReporter = reporters.find(r => 
            Array.isArray(r) && r[0] === 'html'
          );
          expect(htmlReporter).toBeDefined();
          expect(htmlReporter[1]).toHaveProperty('outputFolder');
          
          // Property: Must include JSON reporter for programmatic access
          const jsonReporter = reporters.find(r => 
            Array.isArray(r) && r[0] === 'json'
          );
          expect(jsonReporter).toBeDefined();
          expect(jsonReporter[1]).toHaveProperty('outputFile');
          
          // Property: Must include JUnit reporter for CI integration
          const junitReporter = reporters.find(r => 
            Array.isArray(r) && r[0] === 'junit'
          );
          expect(junitReporter).toBeDefined();
          expect(junitReporter[1]).toHaveProperty('outputFile');
          
          // Property: Configuration must support error capture
          expect(config.use?.screenshot).toBeDefined();
          expect(config.use?.video).toBeDefined();
          expect(config.use?.trace).toBeDefined();
          
          // Property: Configuration must have appropriate timeouts
          expect(config.timeout).toBeGreaterThan(0);
          expect(config.use?.actionTimeout).toBeGreaterThan(0);
          expect(config.use?.navigationTimeout).toBeGreaterThan(0);
          
          // Property: Configuration must support multiple browsers
          expect(config.projects).toBeDefined();
          expect(Array.isArray(config.projects)).toBe(true);
          expect(config.projects.length).toBeGreaterThan(0);
          
          // Property: Each project must have a name and browser configuration
          config.projects.forEach(project => {
            expect(project.name).toBeDefined();
            expect(typeof project.name).toBe('string');
            expect(project.use).toBeDefined();
          });
          
          // Property: Configuration must support test organization
          expect(config.testDir).toBeDefined();
          expect(typeof config.testDir).toBe('string');
          
          // Property: Configuration must support output directory
          expect(config.outputDir).toBeDefined();
          expect(typeof config.outputDir).toBe('string');
          
          // Property: Configuration must support web server for local testing
          expect(config.webServer).toBeDefined();
          expect(config.webServer.command).toBeDefined();
          expect(config.webServer.url).toBeDefined();
          
          // Property: Configuration must support global setup
          expect(config.globalSetup).toBeDefined();
          
          // Validate that the configuration can handle the test scenario
          // This ensures the configuration is robust across different test types
          const isValidTestName = typeof testScenario.testName === 'string' && 
                                 testScenario.testName.trim().length > 0;
          const isValidStatus = ['passed', 'failed', 'skipped'].includes(testScenario.testStatus);
          const isValidExecutionTime = testScenario.executionTime > 0 && 
                                      testScenario.executionTime < config.timeout!;
          const isValidBrowser = config.projects.some(p => 
            p.name.toLowerCase().includes(testScenario.browserName)
          );
          
          expect(isValidTestName).toBe(true);
          expect(isValidStatus).toBe(true);
          expect(isValidExecutionTime).toBe(true);
          expect(isValidBrowser).toBe(true);
        }
      ),
      { numRuns: 100 } // Run 100 iterations to test various scenarios
    );
  });

  test('Property 7: Report output paths are correctly configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different report types and paths
        fc.record({
          reportType: fc.constantFrom('html', 'json', 'junit'),
          testCount: fc.integer({ min: 1, max: 100 }),
          failureCount: fc.integer({ min: 0, max: 50 })
        }),
        async (reportScenario) => {
          const config = playwrightConfig;
          const reporters = config.reporter as Array<any>;
          
          // Property: All report paths must be within tests/reports directory
          reporters.forEach(reporter => {
            if (Array.isArray(reporter) && reporter[1]) {
              const reportConfig = reporter[1];
              
              if (reportConfig.outputFolder) {
                expect(reportConfig.outputFolder).toContain('tests/reports');
              }
              
              if (reportConfig.outputFile) {
                expect(reportConfig.outputFile).toContain('tests/reports');
              }
            }
          });
          
          // Property: Report configuration must support the scenario
          const reportType = reportScenario.reportType;
          const targetReporter = reporters.find(r => 
            Array.isArray(r) && r[0] === reportType
          );
          
          expect(targetReporter).toBeDefined();
          
          // Property: Report paths must be valid for file system
          if (targetReporter[1].outputFolder) {
            const path = targetReporter[1].outputFolder;
            expect(path).not.toContain('..');
            expect(path).not.toContain('//');
          }
          
          if (targetReporter[1].outputFile) {
            const path = targetReporter[1].outputFile;
            expect(path).not.toContain('..');
            expect(path).not.toContain('//');
            expect(path).toMatch(/\.(json|xml)$/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 7: Browser configuration supports comprehensive testing', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different browser and viewport scenarios
        fc.record({
          browserType: fc.constantFrom('chromium', 'firefox', 'webkit'),
          viewportWidth: fc.integer({ min: 320, max: 1920 }),
          viewportHeight: fc.integer({ min: 240, max: 1080 }),
          isMobile: fc.boolean()
        }),
        async (browserScenario) => {
          const config = playwrightConfig;
          
          // Property: Configuration must support the browser type
          const supportedBrowser = config.projects.find(project => 
            project.name.toLowerCase().includes(browserScenario.browserType)
          );
          expect(supportedBrowser).toBeDefined();
          
          // Property: Configuration must support mobile testing if required
          if (browserScenario.isMobile) {
            const mobileProjects = config.projects.filter(project => 
              project.name.toLowerCase().includes('mobile')
            );
            expect(mobileProjects.length).toBeGreaterThan(0);
          }
          
          // Property: Browser configuration must have required settings
          expect(supportedBrowser.use).toBeDefined();
          
          // Property: Global use settings must be inherited
          const globalUse = config.use;
          expect(globalUse?.baseURL).toBeDefined();
          expect(globalUse?.trace).toBeDefined();
          expect(globalUse?.screenshot).toBeDefined();
          expect(globalUse?.video).toBeDefined();
          
          // Property: Timeouts must be reasonable for the scenario
          const actionTimeout = globalUse?.actionTimeout || config.timeout || 30000;
          const navigationTimeout = globalUse?.navigationTimeout || config.timeout || 30000;
          
          expect(actionTimeout).toBeGreaterThanOrEqual(5000); // At least 5 seconds
          expect(navigationTimeout).toBeGreaterThanOrEqual(5000); // At least 5 seconds
          expect(actionTimeout).toBeLessThanOrEqual(300000); // At most 5 minutes
          expect(navigationTimeout).toBeLessThanOrEqual(300000); // At most 5 minutes
        }
      ),
      { numRuns: 100 }
    );
  });
});