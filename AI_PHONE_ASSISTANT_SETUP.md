# ZIMMR Phone Assistant - MVP Build Structure (Existing Number)

## **The Core Flow**
```
Customer calls craftsman's EXISTING number (+49 176 XXXXX)
    ↓
Craftsman's phone rings (20 seconds) - handled by carrier
    ↓
No answer? → Carrier forwards to Twilio number
    ↓
Twilio receives call with ForwardedFrom parameter
    ↓
Forward to Vapi.ai → AI conversation
    ↓
Creates: Callback task + Appointment (if requested)
```

---

## **3 Systems You Need**

### **1. Twilio (Call Receiver)**
- Receives forwarded calls from carrier
- Detects which user via `ForwardedFrom` parameter
- Forwards all calls to Vapi.ai (no filtering in MVP)
- Configuration: Webhook URL to your Next.js API

### **2. Vapi.ai (AI Brain)**
- Conducts German conversation with caller
- Extracts: Name, Phone, Service type, Date preference
- **Has 2 "tools":**
  - `check_calendar(user_id, date, time_range)` → Returns available slots
  - `book_appointment(user_id, name, phone, service, datetime)` → Creates appointment
- Returns conversation summary to your backend

### **3. Next.js Backend (Business Logic)**
- Receives calls from Twilio, identifies user by ForwardedFrom
- Receives Vapi results via webhook
- Creates callback task in ZIMMR
- Manages Google Calendar appointments
- Stores call records in Supabase

---

## **Database (3 Tables)**

**users** → personal_phone_number (their existing #), twilio_number (forwarding destination), assistant_enabled  
**calls** → user_id, caller_number, caller_name, call_reason, preferred_date, transcript  
**appointments** → call_id, user_id, customer_name, proposed_datetime, status (pending/confirmed)

---

## **Onboarding (5 Screens)**

1. **Welcome** → "Keep your existing number, get AI backup"
2. **Auto-provision** → System creates Twilio number in background
3. **Setup forwarding** → "Enter this code: `*61*+49XXXXXXXXX**20#`" with [Copy Code] and [Open Dialer] buttons
4. **Verify** → System detects ForwardedFrom to confirm it's working (or show troubleshooting)
5. **Done** → Show status and link to dashboard

**Key complexity:** User must manually enter MMI code in their phone's dialer

---

## **Call Flow Detail**

### **Customer calls craftsman's existing number:**
1. Carrier rings craftsman's phone (20 seconds)
2. If answered → Normal call, done
3. If no answer → Carrier forwards to Twilio number
4. Twilio receives webhook with:
   - `From` = Customer's number
   - `ForwardedFrom` = Craftsman's number ← **This identifies which user**
5. Lookup user by ForwardedFrom → Forward to their Vapi assistant
6. Vapi conversation → Extract info → Webhook to your backend
7. Create callback task + appointment if discussed

---

## **API Endpoints (5 Total)**

1. **POST /api/twilio/incoming**
   - Receives forwarded call
   - Identifies user by ForwardedFrom parameter
   - Forwards ALL calls to Vapi.ai (no whitelist/blacklist in MVP)

2. **POST /api/vapi/webhook**
   - Receives AI conversation results
   - Creates callback task
   - Creates appointment if discussed

3. **POST /api/vapi/check-calendar**
   - Called by Vapi during conversation
   - Queries user's Google Calendar
   - Returns available time slots

4. **POST /api/vapi/book-appointment**
   - Called by Vapi during conversation
   - Creates pending appointment in database
   - Creates tentative Google Calendar event
   - Creates task for craftsman to confirm

5. **POST /api/assistant/provision**
   - Auto-provisions Twilio number during onboarding
   - Stores twilio_number and user's personal_phone_number

---

## **Vapi.ai Configuration**

**Settings:**
- Model: GPT-4
- Voice: German male (ElevenLabs)
- Language: German
- First message: "Guten Tag! Der Handwerker kann gerade nicht ans Telefon. Wie kann ich Ihnen helfen?"

**System Prompt:**
"You're a friendly assistant for a German craftsman. Ask for: name, contact number, reason for call, and if they'd like to schedule an appointment. If they want an appointment, ask for their preferred date/time and use your tools to check availability and book."

**2 Functions:**
- `check_calendar(user_id, date, time_range)` → Your API returns available slots
- `book_appointment(user_id, name, phone, service, datetime)` → Your API creates pending appointment

---

## **Critical Technical Note**

**ForwardedFrom Detection:**
- Works with ~70% of German carriers reliably
- Format varies: E.164 (+49176...), national (0176...), or missing entirely
- **MVP approach:** If ForwardedFrom missing, match by Twilio number (each user has unique Twilio #)
- **Fallback:** Answer ALL calls to a Twilio number, log warning if can't identify user

---

## **Cost Model (Subscription)**

**Pricing:**
- Starter: €29/month (up to 100 calls)
- Pro: €79/month (up to 300 calls)

**Your costs per user:**
- Twilio number: €1.50/month
- Vapi usage: ~€4-6/month (avg 50-80 minutes)
- Total: ~€6-8/month

**Margin:** €21-71/month per user

---

## **MVP Timeline**

**Week 1:** Twilio setup, webhook handling, user identification by ForwardedFrom  
**Week 2:** Vapi integration, basic conversation flow, create callback tasks  
**Week 3:** Google Calendar integration, appointment booking functions  
**Week 4:** Onboarding flow with call forwarding setup and verification

**Total: 4 weeks to working MVP**

---

## **Key Differences vs "New Number" Approach**

**Added complexity:**
- ✅ User keeps their existing number (main benefit)
- ❌ Manual call forwarding setup (MMI code)
- ❌ Verification step (check if ForwardedFrom detected)
- ❌ Carrier compatibility issues (some don't send ForwardedFrom reliably)

**Trade-off:** Slightly more complex setup, but craftsman keeps the number customers already know

---

## **What You Still Eliminated from Original Spec**

- ❌ Whitelist/blacklist (answer ALL forwarded calls in MVP)
- ❌ Multiple ring duration options (hardcode 20 seconds in instructions)
- ❌ Minute tracking/caps (use subscription model)
- ❌ Block screens and overage billing
- ❌ Self-test feature (verify once during onboarding, that's it)

**Result:** 60% simpler than original spec, keeps core value

---

## **Success Criteria**

✅ User sets up call forwarding in 2 minutes  
✅ System detects forwarded calls via ForwardedFrom  
✅ AI handles ALL unanswered calls (no filtering needed)  
✅ Callback tasks appear in ZIMMR app  
✅ AI can check calendar and book appointments  
✅ Craftsman confirms appointments with 1 click  

---

**This is your build roadmap for the existing number approach. 4 weeks, working MVP.**