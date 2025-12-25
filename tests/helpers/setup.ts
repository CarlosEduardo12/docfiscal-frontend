import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * This runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright E2E Flow Testing Setup');
  
  // Environment validation
  const baseURL = process.env.BASE_URL || config.use?.baseURL || 'http://localhost:3000';
  const backendURL = process.env.BACKEND_URL || 'http://localhost:8000';
  
  console.log(`📍 Frontend URL: ${baseURL}`);
  console.log(`📍 Backend URL: ${backendURL}`);
  
  // Validate environment variables
  if (!process.env.TEST_USER_EMAIL) {
    console.warn('⚠️  TEST_USER_EMAIL not set - some tests may fail');
  }
  
  if (!process.env.TEST_USER_PASSWORD) {
    console.warn('⚠️  TEST_USER_PASSWORD not set - some tests may fail');
  }
  
  // Create reports directories if they don't exist
  const fs = require('fs');
  const path = require('path');
  
  const reportDirs = [
    'tests/reports/error-reports',
    'tests/reports/flow-reports',
    'tests/reports/screenshots',
    'tests/reports/html',
    'tests/reports/json',
    'tests/reports/junit'
  ];
  
  reportDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('✅ Playwright setup completed successfully');
}

export default globalSetup;