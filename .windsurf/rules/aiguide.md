---
trigger: always_on
---

✅ WEEK 1 – AI Phone Assistant + GDPR Setup
📞 AI Phone Assistant – Real-Time Call Handling (GDPR-Compliant)

Flow:

Incoming call routed via Twilio (EU Region) to n8n webhook

Real-time transcription via:

Whisper (local server) OR

AssemblyAI (EU servers only)

Transcript sent to GPT-3.5 Turbo API to extract:

Intent

Caller name

Callback number

GPT response converted to voice using ElevenLabs

Transcripts + metadata are securely logged in n8n + AWS Frankfurt

No audio storage

No sensitive data

Spoken GDPR notice at beginning of every call:

“This call is processed automatically. No audio is stored.”

Deliverables:

 Twilio call routing setup (EU)

 n8n webhook & flow logic

 Transcription module with EU-only fallback

 GPT-3.5 logic: extract intent, name, number

 ElevenLabs voice reply

 Logging with transcript only in AWS Frankfurt

 Spoken GDPR disclaimer implementation

 Use only GDPR-compliant tools (with DPA)

✅ WEEK 2 – Invoicing, Quoting & Time Tracking Modules
🧾 Invoicing Module

Workflow:

Trigger: Manual or after job marked “complete”

Types:

Final invoice (default)

Partial/down payment invoice

Auto-filled required fields (per German law)

Dunning/reminder system with escalating fees

Export: ZIP of PDFs + CSV for accountant

No AI or OpenAI usage in this feature

Deliverables:

 “Create Invoice” flow with all fields

 Dynamic invoice number & date

 Line item & VAT logic (with small business exemption)

 Manual dispatch (email/WhatsApp/PDF)

 Dunning system with 3 reminder templates

 Interest/fee calculation based on §288 BGB

 Export section for monthly/yearly ZIP & CSV

 Store securely in AWS Frankfurt, 10-year retention (GoBD)

📐 Quoting Module (AI-Supported)

Workflow:

Triggered when on-site appointment begins

Pre-filled customer/project info from CRM

Manual + AI-assisted quote builder

Smart line item suggestions (autocomplete)

AI generates professional quote text

Legal template used with editable placeholders

Deliverables:

 Geofencing or time-based quote trigger

 Structured quote form with:

Work area

Tasks

Unit, price, materials

Special conditions

Notes, uploads (photos, sketches)

 Smart suggestions based on past quotes

 Dynamic empty row logic in UI

 Auto-calculated totals (Net, VAT, Gross)

 GPT-based quote text generator

 Manual “Send Now” or “Save as Draft” options

 All data stored in AWS Frankfurt

⏱️ Time Tracking Module

Workflow:

Start/Stop + manual entry

Project auto-selected by location/time

Editable logs with daily summaries

Data reused in invoice and quote modules

Deliverables:

 UI with Start, Pause, Stop, Manual entry

 Daily log view with editable fields

 Pre-fill invoice & quote line items

 Data retention for 2 years minimum

 Storage in GDPR-compliant AWS (Germany)

✅ WEEK 3 – Dashboard, Chatbot, DMS
📊 Dashboard View

Functionality:

Mobile-first panel UI

Live data from quotes, invoices, appointments, time tracking

Deliverables:

 Revenue graph:

Paid (green), Unpaid (yellow), Target (gray)

 Calendar widget with click-to-details

 Upcoming tasks (e.g., “Quote not sent”)

 Metrics: quote acceptance, payment rate, monthly comparison

 Hosted in EU, no 3rd-party integrations

🤖 AI Support Chatbot

Flow & Rules:

Embedded in app (bottom right)

Handles FAQ: invoices, quotes, time tracking, phone assistant, etc.

No chat history or user data stored

Escalation option → WhatsApp/email

Feedback: thumbs up/down per response

Admins receive weekly usage summary

Deliverables:

 GPT-4 API (data usage off) OR Mistral (EU)

 Embedded frontend widget (mobile/desktop)

 Structured knowledge base

 Weekly usage report for admin

 “Was this helpful?” feedback option

 “Talk to human” fallback

 No personal data stored

📂 Document Management System (DMS)

Storage Logic:

Free users: 90-day retention max

Storage upgrade upsell (e.g. €4.99/month for 50GB)

Client-specific folders

Deliverables:

 Folder structure: /Clients /Quotes /Invoices /Uploads /Notes /Comms

 Auto-deletion logic after 90 days (with warning at day 80)

 Optional storage upgrade system

 PDF generation for quote/invoice

 Notes, version history, comments

 Search & filter (by type, project, status)

✅ WEEK 4 – QA, Final Review & GDPR Compliance
🛠️ Integration & Testing

Tasks:

 QA test all modules (end-to-end user flow)

 Verify data flows (no audio, no sensitive data)

 Confirm GDPR compliance:

DPA signed for all tools

Data usage disabled for AI

All infra in EU (AWS Frankfurt)

 Manual transcript review logic for AI assistant learning

No autonomous training

Admin-curated knowledge base

 Prepare client SOPs:

Admin transcript review

GDPR guide

AI usage policy

Feature manuals

🔒 Summary: AI Feature Behavior (All Flows)
Feature	AI Role	AI Behavior
Phone Assistant	Realtime transcription, intent recognition, reply generation	GPT-3.5 extracts purpose, name, number → ElevenLabs speaks reply. NO training, NO audio storage
Quote Generator	Suggest items, write summary	Suggests tasks from material list, generates professional text using placeholders
Chatbot	Respond to user FAQs	GPT or local model responds via static knowledge base. No logging. Feedback loop included
Learning/Improvement	Curated transcript review	Admin approves transcripts → updates knowledge base manually. No autonomous training