const axios = require('axios');

// Simple test to check if server is running
const BASE_URL = 'http://localhost:4000';

async function simpleTest() {
  console.log('🔍 Simple Connection Test...\n');

  try {
    // Test 1: Check if server is running
    console.log('1. Testing server connection...');
    const healthResponse = await axios.get(`${BASE_URL}/health`, {
      timeout: 5000 // 5 second timeout
    });
    console.log('✅ Server is running:', healthResponse.data);
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Server is not running. Please start the server with: npm start');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Cannot resolve localhost. Check your network connection.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('💡 Request timed out. Server might be slow to respond.');
    }
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure the server is running: npm start');
    console.log('2. Check if port 4000 is available');
    console.log('3. Verify your .env file exists with required variables');
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  simpleTest();
}

module.exports = { simpleTest }; 