import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get call logs (GDPR compliant - transcripts only, no audio)
export async function GET(request) {
  try {
    const { data: callLogs, error } = await supabase
      .from('phone_call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch call logs' }, { status: 500 });
    }

    // Return sanitized call logs (ensure no audio data)
    const sanitizedLogs = callLogs?.map(log => ({
      id: log.id,
      transcript: log.transcript,
      intent: log.intent,
      callerName: log.caller_name,
      callbackNumber: log.callback_number,
      timestamp: log.created_at,
      processed: log.processed || false
    })) || [];

    return NextResponse.json(sanitizedLogs);
  } catch (error) {
    console.error('Call logs fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create new call log entry (from n8n webhook)
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Validate GDPR compliance
    if (body.audio_stored === true) {
      return NextResponse.json({ 
        error: 'GDPR violation: Audio storage not permitted' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('phone_call_logs')
      .insert([
        {
          transcript: body.data.transcript,
          intent: body.data.intent,
          caller_name: body.data.callerName,
          callback_number: body.data.callbackNumber,
          gdpr_compliant: body.gdpr_compliant || true,
          audio_stored: false, // Always false for GDPR compliance
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('Database insert error:', error);
      return NextResponse.json({ error: 'Failed to save call log' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data[0] });
  } catch (error) {
    console.error('Call log creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
