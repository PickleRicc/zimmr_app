import { NextResponse } from 'next/server';
import twilio from 'twilio';

// GDPR-compliant AI Phone Assistant Webhook
// Processes incoming calls without storing audio
export async function POST(request) {
  try {
    const body = await request.text();
    const twiml = new twilio.twiml.VoiceResponse();

    // GDPR Notice - Spoken at beginning of every call
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, 'Dieser Anruf wird automatisch verarbeitet. Es werden keine Audiodaten gespeichert.');

    // Start real-time transcription and AI processing
    twiml.start().stream({
      url: `wss://${process.env.NEXT_PUBLIC_APP_URL}/api/phone/stream`,
      track: 'inbound_track'
    });

    // Keep the call alive for processing
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, 'Bitte sprechen Sie nach dem Ton.');

    twiml.pause({ length: 10 });

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Phone webhook error:', error);
    
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({
      voice: 'alice',
      language: 'de-DE'
    }, 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
    
    return new NextResponse(twiml.toString(), {
      status: 500,
      headers: {
        'Content-Type': 'text/xml',
      },
    });
  }
}
