#!/usr/bin/env node

/**
 * Debug script to test the orders API endpoint directly
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = 'https://responsible-balance-production.up.railway.app';
const USER_ID = '88c9637e-75aa-4fd4-a5e8-16d67ae04ba6';

// Test token from the logs (truncated for security)
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4O...'; // You'll need to get the full token

async function testOrdersEndpoint() {
  console.log('🔍 Testing Orders API Endpoint...\n');
  
  const endpoints = [
    `/api/users/${USER_ID}/orders?page=1&limit=5&sort=created_at&order=desc`,
    `/api/users/${USER_ID}/orders`,
    `/api/orders`, // Alternative endpoint
    `/health`, // Health check
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing: ${API_BASE_URL}${endpoint}`);
    
    try {
      const response = await makeRequest(endpoint);
      console.log(`✅ Status: ${response.statusCode}`);
      console.log(`📄 Response: ${response.data.substring(0, 200)}...`);
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DocFiscal-Debug/1.0',
      },
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// Test different scenarios
async function runDiagnostics() {
  console.log('🚀 Starting API Diagnostics...\n');
  
  // Test 1: Basic connectivity
  console.log('=== Test 1: Basic Connectivity ===');
  await testOrdersEndpoint();
  
  // Test 2: Check if it's a CORS issue
  console.log('\n=== Test 2: CORS Headers ===');
  try {
    const response = await makeRequest('/health');
    console.log('CORS Headers:', {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers'],
    });
  } catch (error) {
    console.log('❌ CORS test failed:', error.message);
  }
  
  // Test 3: Check authentication
  console.log('\n=== Test 3: Authentication Test ===');
  try {
    const response = await makeRequest('/api/auth/me');
    console.log(`Auth check status: ${response.statusCode}`);
    if (response.statusCode === 200) {
      console.log('✅ Authentication is working');
    } else {
      console.log('❌ Authentication issue detected');
    }
  } catch (error) {
    console.log('❌ Auth test failed:', error.message);
  }
}

if (require.main === module) {
  runDiagnostics().catch(console.error);
}

module.exports = { testOrdersEndpoint, makeRequest };