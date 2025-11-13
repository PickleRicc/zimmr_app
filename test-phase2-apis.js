/**
 * Phase 2 API Testing Script
 * Tests all 4 phone assistant endpoints
 * Run: node test-phase2-apis.js
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const VAPI_API_KEY = process.env.VAPI_API_KEY || '32d7f2f3-c980-4196-a5cf-4cb7d712578f';

// Test data - Set your craftsman ID here
let testCraftsmanId = 'ff605232-b508-4941-82ea-d0b6307e7669'; // Hardcoded for testing
let testCallId = null;

// Helper function to make HTTP requests
function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const protocol = options.port === 443 ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: res.headers['content-type']?.includes('application/json') 
              ? JSON.parse(data) 
              : data
          };
          resolve(response);
        } catch (e) {
          resolve({ status: res.statusCode, body: data, raw: true });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Test 1: Twilio Incoming Handler
async function testTwilioIncoming() {
  console.log('\n📞 TEST 1: Twilio Incoming Handler');
  console.log('=' .repeat(50));

  try {
    const formData = 'From=%2B4915198765432&ForwardedFrom=%2B4917612345678';
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/twilio/incoming',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData)
      }
    };

    const response = await makeRequest(options, formData);
    
    if (response.status === 200) {
      console.log('✅ Status: 200 OK');
      console.log('✅ TwiML Response received');
      
      if (response.raw) {
        const hasStream = response.body.includes('<Stream');
        const hasVapi = response.body.includes('vapi.ai');
        console.log(hasStream ? '✅ Contains <Stream> element' : '❌ Missing <Stream> element');
        console.log(hasVapi ? '✅ Routes to Vapi.ai' : '❌ Missing Vapi.ai routing');
      }
    } else {
      console.log(`❌ Failed with status: ${response.status}`);
      console.log('Response:', response.body);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Test 2: Calendar Availability Check
async function testCheckCalendar() {
  console.log('\n📅 TEST 2: Calendar Availability Check');
  console.log('=' .repeat(50));

  try {
    // Get a craftsman ID from database first
    if (!testCraftsmanId) {
      console.log('⚠️  Need craftsman ID - please set testCraftsmanId variable');
      console.log('Run this SQL: SELECT id FROM craftsmen LIMIT 1;');
      return;
    }

    const body = JSON.stringify({
      craftsmanId: testCraftsmanId,
      date: '2025-01-15'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/vapi/check-calendar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': VAPI_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const response = await makeRequest(options, body);
    
    if (response.status === 200) {
      console.log('✅ Status: 200 OK');
      console.log('✅ Available slots returned:', response.body.data?.availableSlots?.length || 0);
      console.log('📊 Booked appointments:', response.body.data?.bookedCount || 0);
      console.log('📊 Total slots:', response.body.data?.totalSlots || 0);
    } else {
      console.log(`❌ Failed with status: ${response.status}`);
      console.log('Response:', response.body);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Test 3: Book Appointment
async function testBookAppointment() {
  console.log('\n📝 TEST 3: Book Appointment');
  console.log('=' .repeat(50));

  try {
    if (!testCraftsmanId) {
      console.log('⚠️  Need craftsman ID - skipping test');
      return;
    }

    const body = JSON.stringify({
      craftsmanId: testCraftsmanId,
      customerPhone: '+4915111222333',
      customerName: 'Test Customer API',
      preferredDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      callId: testCallId,
      notes: 'API Test Appointment'
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/vapi/book-appointment',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': VAPI_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const response = await makeRequest(options, body);
    
    if (response.status === 201 || response.status === 200) {
      console.log('✅ Status:', response.status, 'OK');
      console.log('✅ Appointment ID:', response.body.data?.appointmentId);
      console.log('✅ Customer ID:', response.body.data?.customerId);
      console.log('✅ Status:', response.body.data?.status);
      
      if (response.body.data?.status === 'pending_approval') {
        console.log('✅ Correctly set to pending approval');
      }
    } else {
      console.log(`❌ Failed with status: ${response.status}`);
      console.log('Response:', response.body);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Test 4: Vapi Webhook (Full Flow)
async function testVapiWebhook() {
  console.log('\n🔔 TEST 4: Vapi Webhook (Full Flow)');
  console.log('=' .repeat(50));

  try {
    if (!testCraftsmanId) {
      console.log('⚠️  Need craftsman ID - skipping test');
      return;
    }

    const body = JSON.stringify({
      type: 'call_completed',
      craftsmanId: testCraftsmanId,
      customerPhone: '+4915199988877',
      customerName: 'Webhook Test Customer',
      callReason: 'API Test - Full webhook flow',
      preferredDate: new Date(Date.now() + 172800000).toISOString(), // 2 days from now
      transcript: 'AI: Guten Tag!\nCustomer: Ich brauche einen Klempner.\nAI: Verstanden...',
      shouldBookAppointment: true
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/vapi/webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': VAPI_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const response = await makeRequest(options, body);
    
    if (response.status === 200) {
      console.log('✅ Status: 200 OK');
      console.log('✅ Call ID:', response.body.data?.callId);
      console.log('✅ Appointment ID:', response.body.data?.appointmentId);
      
      testCallId = response.body.data?.callId;
      
      if (response.body.data?.callId && response.body.data?.appointmentId) {
        console.log('✅ Successfully created call record AND appointment');
      } else if (response.body.data?.callId) {
        console.log('✅ Successfully created call record');
        console.log('⚠️  Appointment not created (might be by design)');
      }
    } else {
      console.log(`❌ Failed with status: ${response.status}`);
      console.log('Response:', response.body);
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Test Security
async function testSecurity() {
  console.log('\n🔒 TEST 5: Security (Unauthorized Access)');
  console.log('=' .repeat(50));

  try {
    const body = JSON.stringify({
      craftsmanId: 'test',
      date: '2025-01-15'
    });

    // Test with wrong API key
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/vapi/check-calendar',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vapi-secret': 'wrong-api-key-12345',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const response = await makeRequest(options, body);
    
    if (response.status === 401) {
      console.log('✅ Correctly rejected with 401 Unauthorized');
      console.log('✅ Security validation working');
    } else {
      console.log(`❌ Expected 401, got: ${response.status}`);
      console.log('⚠️  Security issue: Invalid API key accepted!');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Phase 2 API Testing Suite                      ║');
  console.log('║   Testing Phone Assistant Endpoints              ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  // Check if server is running
  console.log('\n🔍 Checking if dev server is running...');
  try {
    await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET'
    });
    console.log('✅ Server is running on http://localhost:3000');
  } catch (error) {
    console.log('❌ Server is not running!');
    console.log('Please run: npm run dev');
    process.exit(1);
  }

  // Craftsman ID is hardcoded at the top of the file
  if (!testCraftsmanId) {
    console.log('\n⚠️  testCraftsmanId is not set!');
    console.log('Please edit line 15 of this file and add your craftsman ID\n');
  } else {
    console.log('\n✅ Using Craftsman ID:', testCraftsmanId);
  }

  // Run all tests
  await testTwilioIncoming();
  await testCheckCalendar();
  await testBookAppointment();
  await testVapiWebhook();
  await testSecurity();

  // Summary
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Testing Complete                                ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log('\n✨ Check results above for any ❌ failures');
  console.log('💡 Tip: Check database to verify data was created');
  console.log('\n');
}

// Run tests
runAllTests().catch(console.error);
