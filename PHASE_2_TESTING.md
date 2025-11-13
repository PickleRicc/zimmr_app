# Phase 2: Core API Endpoints - Testing Guide

## Endpoints Created

✅ **1. POST /api/twilio/incoming** - Call routing  
✅ **2. POST /api/vapi/webhook** - Conversation results handler  
✅ **3. POST /api/vapi/check-calendar** - Availability checker  
✅ **4. POST /api/vapi/book-appointment** - Appointment creator  
✅ **Helper:** `getCraftsmanByPhone()` in api-utils.js

---

## Environment Variables Required

Add these to your `.env.local`:

```env
# Existing (should already have)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_sms_sender_number

# New for Phase 2
VAPI_API_KEY=your_vapi_api_key
VAPI_ASSISTANT_ID=your_default_assistant_id
NEXT_PUBLIC_APP_URL=https://your-app-url.com
```

---

## Test 1: Twilio Incoming Handler

### Setup Test Craftsman
```sql
-- Create test craftsman with phone assistant enabled
INSERT INTO craftsmen (name, personal_phone_number, assistant_enabled, vapi_assistant_id)
VALUES ('Test Craftsman', '+4917612345678', true, 'test-vapi-id')
RETURNING id;
```

### Test with cURL
```bash
curl -X POST http://localhost:3000/api/twilio/incoming \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+4915198765432&ForwardedFrom=+4917612345678"
```

**Expected Response:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai">
      <Parameter name="assistantId" value="test-vapi-id"/>
      <Parameter name="craftsmanId" value="[uuid]"/>
      <Parameter name="craftsmanName" value="Test Craftsman"/>
      <Parameter name="customerPhone" value="+4915198765432"/>
    </Stream>
  </Connect>
</Response>
```

---

## Test 2: Calendar Availability Check

### Test Data Setup
```sql
-- Add some appointments to block slots
INSERT INTO appointments (craftsman_id, customer_id, scheduled_at, duration, status)
VALUES 
  ('[craftsman_id]', '[customer_id]', '2025-01-15 10:00:00', 60, 'scheduled'),
  ('[craftsman_id]', '[customer_id]', '2025-01-15 14:00:00', 60, 'scheduled');
```

### Test Request
```bash
curl -X POST http://localhost:3000/api/vapi/check-calendar \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: your_vapi_api_key" \
  -d '{
    "craftsmanId": "[craftsman_id]",
    "date": "2025-01-15"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "date": "2025-01-15",
    "availableSlots": [
      {
        "start": "2025-01-15T08:00:00.000Z",
        "end": "2025-01-15T09:00:00.000Z",
        "displayTime": "8:00"
      },
      {
        "start": "2025-01-15T09:00:00.000Z",
        "end": "2025-01-15T10:00:00.000Z",
        "displayTime": "9:00"
      }
      // ... slots 10:00 and 14:00 should be missing (booked)
    ],
    "bookedCount": 2,
    "totalSlots": 9
  },
  "message": "Availability retrieved",
  "status": "success"
}
```

---

## Test 3: Book Appointment

### Test Request
```bash
curl -X POST http://localhost:3000/api/vapi/book-appointment \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: your_vapi_api_key" \
  -d '{
    "craftsmanId": "[craftsman_id]",
    "customerPhone": "+4915198765432",
    "customerName": "Test Customer",
    "preferredDate": "2025-01-15T11:00:00Z",
    "callId": null,
    "notes": "Leaky faucet repair"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "appointmentId": "[uuid]",
    "customerId": "[uuid]",
    "status": "pending_approval"
  },
  "message": "Appointment created successfully",
  "status": "success"
}
```

### Verify in Database
```sql
-- Check appointment was created
SELECT 
  a.id,
  a.scheduled_at,
  a.approval_status,
  c.name as customer_name,
  c.phone
FROM appointments a
JOIN customers c ON a.customer_id = c.id
WHERE a.notes = 'Leaky faucet repair';
```

---

## Test 4: Vapi Webhook (Full Flow)

### Simulate Vapi Callback
```bash
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: your_vapi_api_key" \
  -d '{
    "type": "call_completed",
    "craftsmanId": "[craftsman_id]",
    "customerPhone": "+4915198765432",
    "customerName": "Frau Schmidt",
    "callReason": "Wasserhahn tropft",
    "preferredDate": "2025-01-16T10:00:00Z",
    "transcript": "AI: Guten Tag...\nCustomer: Mein Wasserhahn...",
    "shouldBookAppointment": true
  }'
```

**Expected Response:**
```json
{
  "data": {
    "callId": "[uuid]",
    "appointmentId": "[uuid]",
    "message": "Call processed successfully"
  },
  "message": "Success",
  "status": "success"
}
```

### Verify Database
```sql
-- Check call record
SELECT * FROM calls WHERE caller_name = 'Frau Schmidt';

-- Check appointment linked to call
SELECT 
  a.*,
  c.caller_name,
  c.transcript
FROM appointments a
JOIN calls c ON a.call_id = c.id
WHERE c.caller_name = 'Frau Schmidt';
```

---

## Security Tests

### Test 1: Unauthorized Vapi Request
```bash
# Missing API key
curl -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -d '{"craftsmanId": "test"}'
```
**Expected:** 401 Unauthorized

### Test 2: Invalid API Key
```bash
curl -X POST http://localhost:3000/api/vapi/check-calendar \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: wrong-key" \
  -d '{"craftsmanId": "test", "date": "2025-01-15"}'
```
**Expected:** 401 Unauthorized

---

## Integration Test (End-to-End)

This simulates the full flow without Vapi.ai:

```bash
# 1. Create call record via webhook
CALL_RESPONSE=$(curl -s -X POST http://localhost:3000/api/vapi/webhook \
  -H "Content-Type: application/json" \
  -H "x-vapi-secret: $VAPI_API_KEY" \
  -d '{
    "craftsmanId": "'$CRAFTSMAN_ID'",
    "customerPhone": "+4915111111111",
    "customerName": "Integration Test",
    "callReason": "Integration test call",
    "preferredDate": "2025-01-20T09:00:00Z",
    "transcript": "Test transcript",
    "shouldBookAppointment": true
  }')

echo "Call created: $CALL_RESPONSE"

# 2. Verify in database
psql -d zimmr_dev -c "SELECT c.id, c.caller_name, a.approval_status 
FROM calls c 
LEFT JOIN appointments a ON a.call_id = c.id 
WHERE c.caller_name = 'Integration Test';"
```

**Expected:** Shows call record and linked pending appointment

---

## Common Issues & Solutions

### Issue: "Invalid API key"
**Solution:** Ensure `VAPI_API_KEY` is set in `.env.local` and matches webhook header

### Issue: "Craftsman not found"
**Solution:** Verify `personal_phone_number` and `assistant_enabled=true` in database

### Issue: "Failed to create appointment"
**Solution:** Check customer table has `craftsman_id` and `source` columns

### Issue: SMS not sending
**Solution:** Verify Twilio credentials and `TWILIO_PHONE_NUMBER` in env

---

## Success Criteria

✅ Twilio webhook identifies craftsman correctly  
✅ Calendar check returns accurate availability  
✅ Appointments created with correct foreign keys  
✅ Call records stored with transcript  
✅ Security: Unauthorized requests rejected  
✅ SMS notifications sent (optional)  

---

## Next Steps

Once all tests pass:
- [ ] Mark Phase 2 complete in main plan
- [ ] Proceed to Phase 3: Twilio Number Provisioning
- [ ] Configure Vapi.ai assistant with function definitions
