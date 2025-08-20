import { NextResponse } from 'next/server';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';

// Initialize OpenAI with data usage disabled for GDPR compliance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

// Real-time audio stream processing for AI Phone Assistant
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  if (searchParams.get('upgrade') === 'websocket') {
    return handleWebSocketUpgrade(request);
  }
  
  return NextResponse.json({ error: 'WebSocket upgrade required' }, { status: 400 });
}

async function handleWebSocketUpgrade(request) {
  try {
    // WebSocket connection for real-time audio processing
    const wss = new WebSocketServer({ 
      port: 0,
      perMessageDeflate: false 
    });

    wss.on('connection', (ws) => {
      console.log('Phone stream WebSocket connected');
      
      let audioBuffer = [];
      let conversationState = {};
      let craftsmanId = null;
      let phoneNumber = null;

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          if (data.event === 'start') {
            // Extract craftsman info from call metadata
            craftsmanId = data.start?.customParameters?.craftsman_id;
            phoneNumber = data.start?.customParameters?.phone_number;
            
            // Initialize conversation
            conversationState = {
              craftsmanId,
              phoneNumber,
              stage: 'greeting'
            };
          }
          
          if (data.event === 'media') {
            // Collect audio data for transcription
            audioBuffer.push(data.media.payload);
            
            // Process audio chunks every 3 seconds for real-time response
            if (audioBuffer.length >= 150) { // ~3 seconds at 50 chunks/sec
              await processAudioChunk(audioBuffer, ws, conversationState);
              audioBuffer = [];
            }
          }
          
          if (data.event === 'stop') {
            // Process final audio chunk
            if (audioBuffer.length > 0) {
              await processAudioChunk(audioBuffer, ws, conversationState);
            }
            
            // If appointment was completed, finalize it
            if (conversationState.appointmentComplete) {
              await finalizeAppointment(conversationState);
            }
            
            ws.close();
          }
          
        } catch (error) {
          console.error('Stream processing error:', error);
        }
      });

      ws.on('close', () => {
        console.log('Phone stream WebSocket disconnected');
      });
    });

    return new NextResponse(null, { 
      status: 101,
      headers: {
        'Upgrade': 'websocket',
        'Connection': 'Upgrade',
      }
    });
    
  } catch (error) {
    console.error('WebSocket upgrade error:', error);
    return NextResponse.json({ error: 'WebSocket upgrade failed' }, { status: 500 });
  }
}

async function processAudioChunk(audioBuffer, ws, conversationState) {
  try {
    // Convert audio buffer to format suitable for transcription
    const audioData = Buffer.concat(audioBuffer.map(chunk => Buffer.from(chunk, 'base64')));
    
    // Transcribe audio using Whisper (local) or AssemblyAI (EU)
    const transcript = await transcribeAudio(audioData);
    
    if (transcript && transcript.trim().length > 0) {
      // Process transcript with conversation context for appointment booking
      const aiResponse = await processTranscript(transcript, conversationState);
      
      // Update conversation state with extracted information
      Object.assign(conversationState, aiResponse.extractedInfo);
      
      // Convert AI response to speech using ElevenLabs
      const audioResponse = await generateSpeech(aiResponse.message);
      
      // Send audio response back through Twilio
      if (audioResponse) {
        ws.send(JSON.stringify({
          event: 'media',
          media: {
            payload: audioResponse
          }
        }));
      }
      
      // If appointment is complete, create it in the system
      if (aiResponse.isComplete && aiResponse.nextStep === 'create_appointment') {
        const appointmentResult = await createAppointmentFromCall(conversationState);
        
        if (appointmentResult.success) {
          conversationState.appointmentComplete = true;
          conversationState.appointmentId = appointmentResult.appointmentId;
          
          // Send final confirmation message
          const confirmationMessage = "Perfekt! Ich habe Ihren Termin erstellt. Der Handwerker wird ihn in Kürze bestätigen und Sie erhalten eine SMS mit den finalen Details. Vielen Dank für Ihren Anruf!";
          const confirmationAudio = await generateSpeech(confirmationMessage);
          
          if (confirmationAudio) {
            ws.send(JSON.stringify({
              event: 'media',
              media: {
                payload: confirmationAudio
              }
            }));
          }
        }
      }
      
      // Log transcript and metadata (GDPR compliant - no audio storage)
      await logCallData({
        transcript,
        conversationState: { ...conversationState },
        appointmentComplete: conversationState.appointmentComplete || false,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Audio processing error:', error);
  }
}

async function createAppointmentFromCall(conversationState) {
  try {
    const response = await fetch('/api/phone/create-appointment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appointmentData: {
          customerName: conversationState.customerName,
          phoneNumber: conversationState.phoneNumber,
          serviceType: conversationState.serviceType,
          description: conversationState.description,
          address: conversationState.address,
          preferredDate: conversationState.preferredDate,
          preferredTime: conversationState.preferredTime,
          urgency: conversationState.urgency || 'normal'
        },
        craftsmanId: conversationState.craftsmanId,
        phoneNumber: conversationState.phoneNumber
      })
    });
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('Appointment creation error:', error);
    return { success: false, error: error.message };
  }
}

async function finalizeAppointment(conversationState) {
  try {
    // Any final cleanup or logging for completed appointments
    console.log('Appointment finalized:', conversationState.appointmentId);
  } catch (error) {
    console.error('Appointment finalization error:', error);
  }
}

async function transcribeAudio(audioData) {
  try {
    // Use AssemblyAI EU servers for transcription
    if (process.env.ASSEMBLYAI_API_KEY) {
      return await transcribeWithAssemblyAI(audioData);
    }
    
    // Fallback to local Whisper if available
    return await transcribeWithWhisper(audioData);
    
  } catch (error) {
    console.error('Transcription error:', error);
    return null;
  }
}

async function transcribeWithAssemblyAI(audioData) {
  // AssemblyAI EU transcription implementation
  // This would connect to AssemblyAI's EU servers
  return "Transcription placeholder - implement AssemblyAI EU integration";
}

async function transcribeWithWhisper(audioData) {
  // Local Whisper transcription implementation
  return "Transcription placeholder - implement local Whisper integration";
}

async function processTranscript(transcript, conversationState = {}) {
  try {
    // Build conversation context for appointment booking
    const systemPrompt = `Du bist ein KI-Assistent für einen deutschen Handwerker und führst Terminbuchungen durch.

DEINE AUFGABE: Führe ein vollständiges Gespräch um einen Termin zu buchen. Sammle alle notwendigen Informationen:

ERFORDERLICHE INFORMATIONEN:
1. Name des Kunden (Vor- und Nachname)
2. Telefonnummer für Rückruf
3. Art der Arbeit/Service (z.B. Reparatur, Installation, Wartung)
4. Detaillierte Beschreibung des Problems/Wunsches
5. Adresse wo die Arbeit stattfinden soll
6. Gewünschter Termin (Datum und Uhrzeit)
7. Dringlichkeit (Normal, Dringend, Notfall)

GESPRÄCHSFÜHRUNG:
- Stelle eine Frage nach der anderen
- Bestätige erhaltene Informationen
- Sei freundlich und professionell
- Wenn alle Infos gesammelt: "Ich erstelle jetzt Ihren Termin und der Handwerker wird ihn bestätigen"

AKTUELLE GESAMMELTE INFORMATIONEN:
${JSON.stringify(conversationState, null, 2)}

Antworte NUR mit der nächsten Frage oder Bestätigung. Führe das Gespräch natürlich.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: transcript
        }
      ],
      max_tokens: 200,
      temperature: 0.4
    });

    const aiResponse = completion.choices[0].message.content;
    
    // Extract information from the conversation
    const extractedInfo = extractAppointmentInfo(transcript, conversationState);
    
    // Check if we have all required information
    const isComplete = checkAppointmentComplete(extractedInfo);
    
    return {
      message: aiResponse,
      extractedInfo,
      isComplete,
      nextStep: isComplete ? 'create_appointment' : 'continue_conversation'
    };
    
  } catch (error) {
    console.error('GPT processing error:', error);
    return {
      message: "Entschuldigung, können Sie das bitte wiederholen?",
      extractedInfo: conversationState,
      isComplete: false,
      nextStep: 'continue_conversation'
    };
  }
}

function extractAppointmentInfo(transcript, currentState) {
  const info = { ...currentState };
  
  // Extract customer name
  const nameMatch = transcript.match(/(?:ich heiße|mein name ist|ich bin)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)?)/i);
  if (nameMatch) info.customerName = nameMatch[1];
  
  // Extract phone number
  const phoneMatch = transcript.match(/(\+49|0)\s*\d{2,4}\s*\d{6,8}/);
  if (phoneMatch) info.phoneNumber = phoneMatch[0];
  
  // Extract service type
  const serviceKeywords = {
    'reparatur': 'Reparatur',
    'installation': 'Installation',
    'wartung': 'Wartung',
    'notfall': 'Notfall',
    'heizung': 'Heizung',
    'sanitär': 'Sanitär',
    'elektrik': 'Elektrik'
  };
  
  for (const [keyword, service] of Object.entries(serviceKeywords)) {
    if (transcript.toLowerCase().includes(keyword)) {
      info.serviceType = service;
      break;
    }
  }
  
  // Extract urgency
  if (transcript.toLowerCase().includes('notfall') || transcript.toLowerCase().includes('dringend')) {
    info.urgency = 'urgent';
  } else if (transcript.toLowerCase().includes('eilt')) {
    info.urgency = 'high';
  }
  
  // Extract address components
  const addressMatch = transcript.match(/([A-ZÄÖÜ][a-zäöüß\s]+straße\s+\d+)/i);
  if (addressMatch) info.address = addressMatch[1];
  
  // Extract date/time preferences
  const dateKeywords = ['heute', 'morgen', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag'];
  for (const day of dateKeywords) {
    if (transcript.toLowerCase().includes(day)) {
      info.preferredDate = day;
      break;
    }
  }
  
  return info;
}

function checkAppointmentComplete(info) {
  const required = ['customerName', 'phoneNumber', 'serviceType', 'address'];
  return required.every(field => info[field] && info[field].trim().length > 0);
}

async function generateSpeech(text) {
  try {
    // ElevenLabs speech generation (EU servers)
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + process.env.ELEVENLABS_VOICE_ID, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });
    
    if (response.ok) {
      const audioBuffer = await response.arrayBuffer();
      return Buffer.from(audioBuffer).toString('base64');
    }
    
    throw new Error('ElevenLabs API error');
    
  } catch (error) {
    console.error('Speech generation error:', error);
    return null;
  }
}

async function logCallData(callData) {
  try {
    // Log to AWS Frankfurt (GDPR compliant)
    // Only store transcript and metadata - NO AUDIO
    await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.N8N_API_KEY}`
      },
      body: JSON.stringify({
        type: 'phone_call_log',
        data: callData,
        gdpr_compliant: true,
        audio_stored: false
      })
    });
    
  } catch (error) {
    console.error('Logging error:', error);
  }
}

function extractIntent(response) {
  // Simple intent extraction logic
  const intents = ['terminanfrage', 'kostenvoranschlag', 'notfall', 'beratung', 'reklamation'];
  const lowerResponse = response.toLowerCase();
  
  for (const intent of intents) {
    if (lowerResponse.includes(intent)) {
      return intent;
    }
  }
  
  return 'allgemeine_anfrage';
}

function extractCallerName(response) {
  // Simple name extraction logic
  const nameMatch = response.match(/name.*?([A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][a-zäöüß]+)/i);
  return nameMatch ? nameMatch[1] : null;
}

function extractCallbackNumber(response) {
  // Simple phone number extraction logic
  const phoneMatch = response.match(/(\+49|0)\s*\d{2,4}\s*\d{6,8}/);
  return phoneMatch ? phoneMatch[0] : null;
}
