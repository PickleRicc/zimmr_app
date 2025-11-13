/**
 * Twilio Incoming Call Handler
 * Receives forwarded calls, identifies craftsman via ForwardedFrom parameter,
 * and routes the call to Vapi.ai assistant
 */

import { createSupabaseClient, getCraftsmanByPhone } from '@/app/lib/api-utils';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request) {
  const supabase = createSupabaseClient('Twilio Incoming');
  
  try {
    // Parse Twilio webhook parameters
    const formData = await request.formData();
    const from = formData.get('From'); // Customer's number
    const forwardedFrom = formData.get('ForwardedFrom'); // Craftsman's number (carrier forwarding)
    
    console.log('Twilio Incoming - Call received:', {
      from,
      forwardedFrom,
      hasForwarding: !!forwardedFrom
    });

    // Identify craftsman by ForwardedFrom parameter
    let craftsman = null;
    if (forwardedFrom) {
      craftsman = await getCraftsmanByPhone(forwardedFrom, supabase, 'Twilio Incoming');
    }

    // If no ForwardedFrom, try matching by From (direct calls to Twilio number)
    if (!craftsman && from) {
      console.log('Twilio Incoming - No ForwardedFrom, checking if From is a craftsman');
      craftsman = await getCraftsmanByPhone(from, supabase, 'Twilio Incoming');
    }

    // If craftsman not found, log and play error message
    if (!craftsman) {
      console.error('Twilio Incoming - Unable to identify craftsman');
      
      const twiml = new VoiceResponse();
      twiml.say({
        voice: 'Polly.Vicki',
        language: 'de-DE'
      }, 'Entschuldigung, dieser Service ist nicht verfügbar.');
      
      // Log unidentified call for debugging
      await supabase.from('calls').insert({
        user_id: null,
        caller_number: from,
        call_reason: 'Unidentified craftsman',
        transcript: `Unidentified call from ${from} forwarded from ${forwardedFrom || 'unknown'}`
      });

      return new Response(twiml.toString(), {
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    console.log('Twilio Incoming - Routing to Vapi.ai for craftsman:', craftsman.id);

    // Create TwiML to forward call to Vapi.ai
    const twiml = new VoiceResponse();
    
    // Forward call to Vapi.ai with craftsman context
    twiml.connect().stream({
      url: `wss://api.vapi.ai`,
      parameters: {
        assistantId: craftsman.vapi_assistant_id || process.env.VAPI_ASSISTANT_ID,
        craftsmanId: craftsman.id,
        craftsmanName: craftsman.name,
        customerPhone: from
      }
    });

    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Twilio Incoming - Error:', error);
    
    // Return error TwiML response
    const twiml = new VoiceResponse();
    twiml.say({
      voice: 'Polly.Vicki',
      language: 'de-DE'
    }, 'Es ist ein technischer Fehler aufgetreten. Bitte versuchen Sie es später erneut.');
    
    return new Response(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    });
  }
}
