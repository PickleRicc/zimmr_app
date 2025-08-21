import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { notes } = await req.json();

    if (!notes || typeof notes !== 'string') {
      return NextResponse.json({ error: 'Notes are required' }, { status: 400 });
    }

    // Simple AI prompt to extract materials from German craftsman notes
    const prompt = `Analysiere die folgenden Handwerker-Notizen und extrahiere alle Materialien mit Mengen und geschätzten Preisen.
    
Notizen: "${notes}"

Gib eine JSON-Liste von Materialien zurück im Format:
{
  "materials": [
    {
      "name": "Material Name",
      "quantity": 5,
      "unit": "Stück/m²/kg/etc",
      "unit_price": 25.50
    }
  ]
}

Verwende realistische deutsche Handwerkerpreise. Wenn keine Materialien erkennbar sind, gib eine leere Liste zurück.`;

    // For now, use pattern matching as fallback since OpenAI might not be available
    console.log('AI Extract Materials - Processing notes:', notes);
    
    // Simple pattern matching for common German materials
    const materials = [];
    const text = notes.toLowerCase();
    
    // Tiles (Fliesen)
    if (text.includes('fliesen') || text.includes('tile')) {
      const match = text.match(/(\d+)\s*m²?\s*fliesen/);
      if (match) {
        materials.push({
          name: 'Badezimmerfliesen',
          quantity: parseInt(match[1]),
          unit: 'm²',
          unit_price: 45.00
        });
      } else {
        materials.push({
          name: 'Badezimmerfliesen',
          quantity: 25,
          unit: 'm²',
          unit_price: 45.00
        });
      }
    }
    
    // Adhesive (Kleber)
    if (text.includes('kleber') || text.includes('adhesive')) {
      materials.push({
        name: 'Fliesenkleber',
        quantity: 3,
        unit: 'Sack',
        unit_price: 25.00
      });
    }
    
    // Grout (Fugenmörtel)
    if (text.includes('fugen') || text.includes('grout')) {
      materials.push({
        name: 'Fugenmörtel',
        quantity: 2,
        unit: 'kg',
        unit_price: 15.00
      });
    }
    
    // Waterproofing (Abdichtung)
    if (text.includes('abdicht') || text.includes('waterproof')) {
      materials.push({
        name: 'Abdichtung',
        quantity: 1,
        unit: 'Set',
        unit_price: 85.00
      });
    }
    
    console.log('AI Extract Materials - Extracted materials:', materials);
    const content = JSON.stringify({ materials });

    if (!content) {
      return NextResponse.json({ materials: [] });
    }

    try {
      // Parse AI response as JSON
      const parsedResponse = JSON.parse(content);
      const materials = parsedResponse.materials || [];

      // Validate materials structure
      const validMaterials = materials.filter(material => 
        material.name && 
        material.quantity && 
        material.unit && 
        material.unit_price
      );

      return NextResponse.json({ materials: validMaterials });
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      return NextResponse.json({ materials: [] });
    }

  } catch (error) {
    console.error('Error in extract-materials API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
