import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Smart material suggestions based on historical data and project type
export async function POST(request) {
  try {
    const { serviceType, projectDescription, craftsmanId } = await request.json();

    // Get historical quotes for this craftsman and service type
    const { data: historicalQuotes } = await supabase
      .from('quotes')
      .select('materials, notes, total_amount')
      .eq('craftsman_id', craftsmanId)
      .ilike('notes', `%${serviceType}%`)
      .limit(20);

    // Get all materials
    const { data: allMaterials } = await supabase
      .from('materials')
      .select('*');

    if (!allMaterials) {
      return NextResponse.json({ success: false, error: 'No materials found' });
    }

    // Analyze material usage patterns
    const materialUsage = {};
    let totalProjects = 0;

    if (historicalQuotes && historicalQuotes.length > 0) {
      historicalQuotes.forEach(quote => {
        if (quote.materials && Array.isArray(quote.materials)) {
          totalProjects++;
          quote.materials.forEach(material => {
            const materialId = material.id || material.material_id;
            if (materialId) {
              if (!materialUsage[materialId]) {
                materialUsage[materialId] = {
                  count: 0,
                  totalQuantity: 0,
                  averageQuantity: 0
                };
              }
              materialUsage[materialId].count++;
              materialUsage[materialId].totalQuantity += material.quantity || 1;
            }
          });
        }
      });

      // Calculate averages
      Object.keys(materialUsage).forEach(materialId => {
        const usage = materialUsage[materialId];
        usage.averageQuantity = usage.totalQuantity / usage.count;
        usage.usageFrequency = (usage.count / totalProjects) * 100;
      });
    }

    // Create smart suggestions
    const suggestions = [];

    // Add frequently used materials for this service type
    Object.keys(materialUsage).forEach(materialId => {
      const material = allMaterials.find(m => m.id === parseInt(materialId));
      const usage = materialUsage[materialId];
      
      if (material && usage.usageFrequency >= 30) { // Used in 30%+ of similar projects
        suggestions.push({
          ...material,
          suggested_quantity: Math.ceil(usage.averageQuantity),
          usage_frequency: Math.round(usage.usageFrequency),
          reasoning: `Wird in ${Math.round(usage.usageFrequency)}% ähnlicher ${serviceType}-Projekte verwendet`,
          confidence: Math.min(usage.usageFrequency / 100, 0.9)
        });
      }
    });

    // Add common materials for service type if no historical data
    if (suggestions.length === 0) {
      const commonMaterialsByService = {
        'Sanitär': ['Rohre', 'Dichtungen', 'Ventile', 'Armaturen'],
        'Elektrik': ['Kabel', 'Schalter', 'Steckdosen', 'Sicherungen'],
        'Heizung': ['Heizkörper', 'Thermostate', 'Rohrisolierung', 'Ventile'],
        'Installation': ['Schrauben', 'Dübel', 'Dichtmittel', 'Werkzeug'],
        'Reparatur': ['Ersatzteile', 'Dichtungen', 'Kleber', 'Reiniger']
      };

      const commonMaterials = commonMaterialsByService[serviceType] || [];
      
      commonMaterials.forEach(materialName => {
        const material = allMaterials.find(m => 
          m.name?.toLowerCase().includes(materialName.toLowerCase())
        );
        
        if (material) {
          suggestions.push({
            ...material,
            suggested_quantity: 1,
            usage_frequency: 50,
            reasoning: `Häufig benötigt für ${serviceType}-Arbeiten`,
            confidence: 0.6
          });
        }
      });
    }

    // Sort by confidence and usage frequency
    suggestions.sort((a, b) => {
      const scoreA = (a.confidence || 0) * (a.usage_frequency || 0);
      const scoreB = (b.confidence || 0) * (b.usage_frequency || 0);
      return scoreB - scoreA;
    });

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 6), // Top 6 suggestions
      totalHistoricalProjects: totalProjects,
      analysisNote: totalProjects > 0 
        ? `Basierend auf ${totalProjects} ähnlichen Projekten`
        : 'Basierend auf allgemeinen Empfehlungen für diese Serviceart'
    });

  } catch (error) {
    console.error('Smart suggestions error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to generate smart suggestions' 
    }, { status: 500 });
  }
}
