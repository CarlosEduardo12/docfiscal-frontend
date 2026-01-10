#!/usr/bin/env node

/**
 * Simple test to verify the orders endpoint
 * Run this with: node test-orders-endpoint.js
 */

async function testOrdersEndpoint() {
  const API_URL = 'https://responsible-balance-production.up.railway.app';
  const USER_ID = '88c9637e-75aa-4fd4-a5e8-16d67ae04ba6';
  
  console.log('🔍 Testing Orders Endpoint...');
  console.log(`API URL: ${API_URL}`);
  console.log(`User ID: ${USER_ID}`);
  
  try {
    // Test 1: Health check
    console.log('\n=== Health Check ===');
    const healthResponse = await fetch(`${API_URL}/health`);
    console.log(`Health Status: ${healthResponse.status}`);
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.text();
      console.log(`Health Response: ${healthData}`);
    }
    
    // Test 2: Check if the endpoint exists (without auth)
    console.log('\n=== Endpoint Check (No Auth) ===');
    const noAuthResponse = await fetch(`${API_URL}/api/users/${USER_ID}/orders`);
    console.log(`No Auth Status: ${noAuthResponse.status}`);
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Endpoint exists but requires authentication (expected)');
    } else if (noAuthResponse.status === 404) {
      console.log('❌ Endpoint not found - this might be the issue');
    } else {
      console.log(`ℹ️  Unexpected status: ${noAuthResponse.status}`);
    }
    
    // Test 3: Check available endpoints
    console.log('\n=== Available Endpoints Check ===');
    const endpoints = [
      '/api/orders',
      '/api/users',
      '/api/auth/me',
      '/api/health',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_URL}${endpoint}`);
        console.log(`${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`${endpoint}: ERROR - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testOrdersEndpoint();