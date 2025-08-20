import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

// AI-powered quote suggestions and line items
export async function POST(request) {
  try {
    const { 
      serviceType, 
      customerInfo, 
      location, 
      projectDescription,
      craftsmanId,
      requestType = 'line_items' // 'line_items', 'quote_text', 'optimization'
    } = await request.json();

    switch (requestType) {
      case 'line_items':
        return await generateLineItemSuggestions(serviceType, projectDescription, craftsmanId);
      
      case 'quote_text':
        return await generateQuoteText(serviceType, customerInfo, projectDescription);
      
      case 'optimization':
        return await optimizeQuote(serviceType, projectDescription, craftsmanId);
      
      default:
        return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('AI suggestions error:', error);
    return NextResponse.json({ error: 'Failed to generate AI suggestions' }, { status: 500 });
  }
}

async function generateLineItemSuggestions(serviceType, projectDescription, craftsmanId) {
  try {
    // Get historical data for this craftsman and service type
    const { data: historicalQuotes } = await supabase
      .from('quotes')
      .select('materials, notes, total_amount')
      .eq('craftsman_id', craftsmanId)
      .ilike('notes', `%${serviceType}%`)
      .limit(10);

    // Get available materials
    const { data: materials } = await supabase
      .from('materials')
      .select('*')
      .limit(50);

    // Create AI prompt with historical context
    const historicalContext = historicalQuotes?.map(q => ({
      materials: q.materials,
      description: q.notes,
      amount: q.total_amount
    })) || [];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für Handwerksangebote in Deutschland. Erstelle detaillierte Angebotspositionen mit realistischen Preisen im JSON-Format.

WICHTIG: Antworte NUR mit gültigem JSON, keine zusätzlichen Texte!

Preisrichtlinien:
- Fliesenarbeiten: 35-65 €/qm
- Sanitärarbeiten: 45-85 €/Std
- Elektroarbeiten: 50-90 €/Std
- Materialien: Marktübliche Preise verwenden
- Arbeitszeit: Deutsche Handwerkerstundensätze

Antwortformat:
{
  "suggestions": [
    {
      "category": "Arbeitsleistung",
      "description": "Fliesenverlegung Badezimmer",
      "quantity": 15,
      "unit": "qm",
      "unitPrice": 45.00,
      "totalPrice": 675.00,
      "confidence": 0.9,
      "reasoning": "Standardpreis für Fliesenverlegung"
    }
  ],
  "estimatedTotal": 675.00,
  "recommendations": ["Empfehlung"]
}`
        },
        {
          role: "user",
          content: `Service: ${serviceType}
Projekt: ${projectDescription}

Erstelle 3-5 Positionen als JSON.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const responseContent = completion.choices[0].message.content;
    console.log('Raw AI response:', responseContent);
    
    let aiResponse;
    try {
      aiResponse = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response content:', responseContent);
      
      // Fallback response if JSON parsing fails
      return NextResponse.json({
        success: true,
        suggestions: [
          { 
            description: "Handwerksleistung", 
            quantity: 1, 
            unit: "Std", 
            unitPrice: 65.00, 
            totalPrice: 65.00, 
            category: "Arbeitsleistung" 
          },
          { 
            description: "Material", 
            quantity: 1, 
            unit: "Stück", 
            unitPrice: 25.00, 
            totalPrice: 25.00, 
            category: "Material" 
          }
        ],
        estimatedTotal: 90.00,
        recommendations: ["Bitte Projektdetails für bessere Vorschläge hinzufügen"],
        confidence: 'low'
      });
    }
    
    return NextResponse.json({
      success: true,
      suggestions: aiResponse.suggestions || [],
      estimatedTotal: aiResponse.estimatedTotal || 0,
      recommendations: aiResponse.recommendations || [],
      confidence: 'high'
    });
    
  } catch (error) {
    console.error('Line item suggestions error:', error);
    return NextResponse.json({ error: 'Failed to generate line item suggestions' }, { status: 500 });
  }
}

async function generateQuoteText(serviceType, customerInfo, projectDescription) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Du bist ein professioneller deutscher Handwerker und erstellst Angebotstexte.

ANFORDERUNGEN:
- Professioneller, höflicher Ton
- Deutsche Rechtschreibung und Grammatik
- Strukturiert und übersichtlich
- Rechtlich korrekte Formulierungen
- Kundenorientiert

STRUKTUR:
1. Höfliche Begrüßung
2. Projektverständnis bestätigen
3. Leistungsumfang beschreiben
4. Besondere Hinweise/Bedingungen
5. Freundlicher Abschluss

Erstelle einen professionellen Angebotstext.`
        },
        {
          role: "user",
          content: `Kunde: ${customerInfo?.name || 'Sehr geehrte Damen und Herren'}
Service: ${serviceType}
Projektbeschreibung: ${projectDescription}

Bitte erstelle einen professionellen Angebotstext.`
        }
      ],
      max_tokens: 800,
      temperature: 0.4
    });

    return NextResponse.json({
      success: true,
      quoteText: completion.choices[0].message.content,
      suggestions: [
        'Text kann nach Bedarf angepasst werden',
        'Rechtliche Hinweise prüfen',
        'Preise und Termine ergänzen'
      ]
    });
    
  } catch (error) {
    console.error('Quote text generation error:', error);
    return NextResponse.json({ error: 'Failed to generate quote text' }, { status: 500 });
  }
}

async function optimizeQuote(serviceType, projectDescription, craftsmanId) {
  try {
    // Get market data and historical performance
    const { data: marketData } = await supabase
      .from('quotes')
      .select('total_amount, status')
      .ilike('notes', `%${serviceType}%`)
      .limit(20);

    const acceptanceRate = marketData?.length > 0 
      ? marketData.filter(q => q.status === 'accepted').length / marketData.length 
      : 0.5;

    const averageAmount = marketData?.length > 0
      ? marketData.reduce((sum, q) => sum + (q.total_amount || 0), 0) / marketData.length
      : 0;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Du bist ein Berater für Handwerker-Angebote. Analysiere und optimiere Angebote.

MARKTDATEN:
- Durchschnittlicher Angebotswert: €${averageAmount.toFixed(2)}
- Annahmequote: ${(acceptanceRate * 100).toFixed(1)}%

OPTIMIERUNGSBEREICHE:
1. Preisgestaltung
2. Leistungsumfang
3. Präsentation
4. Wettbewerbsfähigkeit
5. Kundenwert

Gib konkrete Verbesserungsvorschläge.`
        },
        {
          role: "user",
          content: `Service: ${serviceType}
Projekt: ${projectDescription}

Wie kann dieses Angebot optimiert werden?`
        }
      ],
      max_tokens: 600,
      temperature: 0.3
    });

    return NextResponse.json({
      success: true,
      optimization: completion.choices[0].message.content,
      marketInsights: {
        averageAmount: averageAmount.toFixed(2),
        acceptanceRate: (acceptanceRate * 100).toFixed(1) + '%',
        recommendation: averageAmount > 0 
          ? `Marktüblicher Preis liegt bei €${averageAmount.toFixed(2)}`
          : 'Keine Marktdaten verfügbar'
      }
    });
    
  } catch (error) {
    console.error('Quote optimization error:', error);
    return NextResponse.json({ error: 'Failed to optimize quote' }, { status: 500 });
  }
}
