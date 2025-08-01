const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Simple security test script
// Run with: node test/security-test.js

const BASE_URL = 'http://localhost:4000';

async function testSecurityFeatures() {
  console.log('🔒 Testing Security Features...\n');

  try {
    // Test 1: Health check (should work)
    console.log('1. Testing health check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);

    // Test 2: Try to access protected endpoint without auth
    console.log('\n2. Testing authentication requirement...');
    try {
      await axios.post(`${BASE_URL}/upload`, {});
      console.log('❌ Should have failed - no authentication required');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Authentication required correctly');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    // Test 3: Test login
    console.log('\n3. Testing login...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      username: 'testuser',
      password: 'testpass'
    });
    console.log('✅ Login successful:', loginResponse.data);

    // Get session cookie
    const cookies = loginResponse.headers['set-cookie'];
    const sessionCookie = cookies?.find(cookie => cookie.startsWith('connect.sid'));

    // Test 4: Access protected endpoint with auth
    console.log('\n4. Testing authenticated access...');
    try {
      const profileResponse = await axios.get(`${BASE_URL}/auth/profile`, {
        headers: {
          Cookie: sessionCookie
        }
      });
      console.log('✅ Authenticated access successful:', profileResponse.data);
    } catch (error) {
      console.log('❌ Authenticated access failed:', error.response?.data);
    }

    // Test 5: Test rate limiting
    console.log('\n5. Testing rate limiting...');
    const rateLimitPromises = [];
    for (let i = 0; i < 15; i++) {
      rateLimitPromises.push(
        axios.post(`${BASE_URL}/auth/login`, {
          username: `user${i}`,
          password: 'testpass'
        }).catch(error => error.response)
      );
    }
    
    const rateLimitResults = await Promise.all(rateLimitPromises);
    const rateLimited = rateLimitResults.some(result => result?.status === 429);
    console.log(rateLimited ? '✅ Rate limiting working' : '❌ Rate limiting not working');

    // Test 6: Test file upload validation
    console.log('\n6. Testing file upload validation...');
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from('fake file content'), {
        filename: 'test.txt',
        contentType: 'text/plain'
      });

      await axios.post(`${BASE_URL}/upload`, formData, {
        headers: {
          ...formData.getHeaders(),
          Cookie: sessionCookie
        }
      });
      console.log('❌ Should have failed - invalid file type');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ File type validation working');
      } else {
        console.log('❌ Unexpected error:', error.response?.status);
      }
    }

    console.log('\n🎉 Security tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testSecurityFeatures();
}

module.exports = { testSecurityFeatures }; 