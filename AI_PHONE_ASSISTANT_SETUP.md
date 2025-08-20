# AI Phone Assistant Setup Guide

## Complete Flow Overview

1. **Customer calls craftsman's personal number** (linked to Twilio for separation)
2. **AI assistant conducts full conversation** to gather appointment booking info
3. **AI collects**: customer details, service needed, preferred date/time, location, urgency
4. **System automatically creates appointment** in backend/frontend for specific craftsman
5. **Craftsman receives notification** and can approve/modify appointment
6. **Upon approval, SMS sent to customer** with confirmed appointment details

## Files Created

### API Routes
- `app/api/phone/webhook/route.js` - Twilio webhook handler with GDPR disclaimer
- `app/api/phone/stream/route.js` - Real-time conversational AI processing
- `app/api/phone/logs/route.js` - Call logs management (transcripts only)
- `app/api/phone/create-appointment/route.js` - Creates appointments from AI calls
- `app/api/phone/approve-appointment/route.js` - Craftsman approval & SMS confirmation

### UI Components
- `app/phone/page.js` - Enhanced AI Phone Assistant dashboard

### Configuration
- `env.template` - Complete environment variables template

## Required Environment Variables

Copy `env.template` to `.env` and configure:

```bash
# Twilio Configuration (EU Region)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# OpenAI Configuration (Data Usage OFF)
OPENAI_API_KEY=your_openai_api_key
OPENAI_ORG_ID=your_openai_org_id

# ElevenLabs Configuration (EU Servers)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id

# AssemblyAI Configuration (EU Servers Only)
ASSEMBLYAI_API_KEY=your_assemblyai_api_key

# n8n Webhook Configuration
N8N_WEBHOOK_URL=your_n8n_webhook_url
N8N_API_KEY=your_n8n_api_key

# AWS Configuration (Frankfurt Region Only)
AWS_REGION=eu-central-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
```

## Database Schema Updates Needed

You'll need to add these tables to your Supabase database:

### 1. Phone Call Logs Table
```sql
CREATE TABLE phone_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transcript TEXT,
  intent TEXT,
  caller_name TEXT,
  callback_number TEXT,
  gdpr_compliant BOOLEAN DEFAULT true,
  audio_stored BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. Phone Appointment Logs Table
```sql
CREATE TABLE phone_appointment_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id),
  customer_id UUID REFERENCES customers(id),
  craftsman_id UUID REFERENCES users(id),
  phone_number TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. Appointment Approval Logs Table
```sql
CREATE TABLE appointment_approval_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES appointments(id),
  craftsman_id UUID REFERENCES users(id),
  action TEXT, -- 'approved' or 'rejected'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4. Update Appointments Table
```sql
-- Add new columns to existing appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS phone_booking_data JSONB;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS scheduled_time TIME;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS craftsman_notes TEXT;
```

### 5. Update Customers Table
```sql
-- Add source tracking to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
```

## Twilio Configuration

### 1. Set up Twilio Phone Numbers
- Purchase phone numbers in EU region
- Configure each number for a specific craftsman
- Set webhook URL: `https://your-domain.com/api/phone/webhook`

### 2. Webhook Configuration
In Twilio Console, set:
- **Webhook URL**: `https://your-domain.com/api/phone/webhook`
- **HTTP Method**: POST
- **Voice**: Configure for incoming calls

### 3. Multi-Craftsman Setup
Pass craftsman ID in webhook parameters:
```
https://your-domain.com/api/phone/webhook?craftsman_id=uuid&phone_number=+49123456789
```

## AI Configuration

### 1. OpenAI Setup
- Create API key with data usage disabled
- Set organization ID for billing tracking
- Model: GPT-3.5 Turbo (cost-effective for conversations)

### 2. ElevenLabs Setup
- Create account with EU server access
- Generate API key
- Select German voice ID
- Configure for real-time streaming

### 3. AssemblyAI Setup (EU Servers)
- Create account with EU data processing
- Generate API key
- Configure for real-time transcription

## GDPR Compliance Features

✅ **No Audio Storage**: Only transcripts are saved
✅ **EU Servers Only**: All processing in Frankfurt region
✅ **Spoken Disclaimer**: GDPR notice at call start
✅ **Data Minimization**: Only necessary data collected
✅ **Retention Limits**: 90-day default retention
✅ **Audit Trail**: All actions logged

## Testing the System

### 1. Local Development
```bash
npm install
npm run dev
```

### 2. Test Call Flow
1. Call your Twilio number
2. Listen for GDPR disclaimer
3. Provide appointment information
4. Check dashboard for created appointment
5. Approve/reject as craftsman
6. Verify SMS confirmation sent

### 3. Monitor Logs
- Check `/phone` dashboard for call logs
- Monitor Supabase for appointment creation
- Verify SMS delivery in Twilio console

## Production Deployment

### 1. Environment Setup
- Deploy to EU region (Frankfurt recommended)
- Configure all environment variables
- Set up SSL certificates

### 2. Monitoring
- Set up logging for all API endpoints
- Monitor Twilio webhook delivery
- Track AI response times
- Monitor SMS delivery rates

### 3. Scaling Considerations
- WebSocket connection limits
- Concurrent call handling
- Database connection pooling
- API rate limits (OpenAI, ElevenLabs)

## Troubleshooting

### Common Issues
1. **Webhook not receiving calls**: Check Twilio configuration
2. **AI not responding**: Verify OpenAI API key and credits
3. **No SMS sent**: Check Twilio SMS configuration
4. **Transcription failing**: Verify AssemblyAI setup
5. **Database errors**: Check Supabase connection and schema

### Debug Mode
Enable detailed logging by setting:
```
NODE_ENV=development
```

## Next Steps

1. **Install dependencies**: `npm install`
2. **Configure environment variables**
3. **Update database schema**
4. **Set up Twilio webhooks**
5. **Configure AI services**
6. **Test with sample calls**
7. **Deploy to production**

## Support

For issues with this implementation, check:
- Twilio webhook logs
- Next.js API route logs
- Supabase database logs
- OpenAI API usage dashboard
- ElevenLabs usage dashboard
