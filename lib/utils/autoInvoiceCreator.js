// Auto-invoice creation utility
// Creates draft invoices automatically when appointments are completed

import { createSupabaseClient } from '../api-utils';

const supabase = createSupabaseClient('Auto-Invoice Creator');

/**
 * Extracts materials from appointment notes using AI analysis
 * @param {string} notes - The appointment notes to analyze
 * @returns {Array} Array of extracted materials with quantities and prices
 */
async function extractMaterialsFromNotes(notes) {
  try {
    console.log('Auto-Invoice Creator - Analyzing notes for materials:', notes);

    // Use absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/ai/extract-materials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    });

    if (!response.ok) {
      console.warn('Auto-Invoice Creator - AI material extraction failed:', response.statusText);
      return [];
    }

    const data = await response.json();
    const materials = data.materials || [];
    
    console.log('Auto-Invoice Creator - Extracted materials:', materials);
    return materials;
  } catch (error) {
    console.warn('Auto-Invoice Creator - Error extracting materials:', error);
    return [];
  }
}

/**
 * Creates a draft invoice automatically from completed appointment data
 * @param {Object} appointment - The completed appointment object
 * @param {string} craftsmanId - The craftsman ID
 * @returns {Object} Created invoice data or error
 */
export async function createAutoInvoice(appointment, craftsmanId) {
  try {
    console.log('Auto-Invoice Creator - Creating invoice for appointment:', appointment.id);

    // Fetch craftsman data for German compliance defaults
    const { data: craftsman, error: craftsmanError } = await supabase
      .from('craftsmen')
      .select('tax_number, vat_id, small_business_exempt')
      .eq('id', craftsmanId)
      .single();

    if (craftsmanError) {
      console.warn('Auto-Invoice Creator - Could not fetch craftsman data:', craftsmanError);
    }

    // Analyze appointment notes to extract materials using AI
    let materials = appointment.materials || [];
    
    console.log('Auto-Invoice Creator - Current materials:', materials);
    console.log('Auto-Invoice Creator - Appointment notes:', appointment.notes);
    
    // If no materials exist but there are notes, try to extract materials from notes
    if (materials.length === 0 && appointment.notes) {
      console.log('Auto-Invoice Creator - Attempting to extract materials from notes');
      const extractedMaterials = await extractMaterialsFromNotes(appointment.notes);
      materials = extractedMaterials;
      console.log('Auto-Invoice Creator - Final materials after AI extraction:', materials);
    } else {
      console.log('Auto-Invoice Creator - Skipping AI extraction - materials exist or no notes');
    }
    
    let totalMaterialsPrice = 0;
    materials.forEach(material => {
      totalMaterialsPrice += (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
    });

    // Calculate totals
    const serviceAmount = parseFloat(appointment.price || 0);
    const totalNetAmount = serviceAmount + totalMaterialsPrice;

    // Calculate VAT based on German rules
    let calculatedTaxAmount = 0;
    const vatRate = 0.19; // Standard German VAT rate

    if (craftsman?.small_business_exempt) {
      calculatedTaxAmount = 0;
    } else {
      calculatedTaxAmount = totalNetAmount * vatRate;
    }

    const totalAmount = totalNetAmount + calculatedTaxAmount;

    // Get default legal footer text
    const getDefaultLegalFooter = (isSmallBusiness) => {
      if (isSmallBusiness) {
        return 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.';
      }
      return 'Zahlbar ohne Abzug innerhalb von 14 Tagen nach Rechnungsdatum. Bei Zahlungsverzug werden Verzugszinsen in Höhe von 9 Prozentpunkten über dem Basiszinssatz berechnet.';
    };

    // Prepare invoice data
    const invoiceData = {
      customer_id: appointment.customer_id,
      appointment_id: appointment.id,
      amount: serviceAmount.toFixed(2),
      tax_amount: calculatedTaxAmount.toFixed(2),
      total_amount: totalAmount.toFixed(2),
      total_materials_price: totalMaterialsPrice.toFixed(2),
      materials: materials,
      notes: appointment.notes || `Automatisch erstellt für Termin vom ${new Date(appointment.date).toLocaleDateString('de-DE')}`,
      status: 'draft', // Auto-created invoices start as drafts
      service_date: appointment.date,
      location: appointment.location || '',
      craftsman_id: craftsmanId,
      // German compliance fields
      invoice_type: 'final',
      tax_number: craftsman?.tax_number || null,
      vat_id: craftsman?.vat_id || null,
      small_business_exempt: craftsman?.small_business_exempt || false,
      payment_terms_days: 14,
      issue_date: new Date().toISOString().split('T')[0],
      service_period_start: appointment.date,
      service_period_end: appointment.date,
      reverse_charge: false,
      legal_footer_text: getDefaultLegalFooter(craftsman?.small_business_exempt)
    };

    // Create the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (invoiceError) {
      console.error('Auto-Invoice Creator - Error creating invoice:', invoiceError);
      throw new Error(`Failed to create invoice: ${invoiceError.message}`);
    }

    // Update appointment to mark it has an invoice
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ has_invoice: true })
      .eq('id', appointment.id);

    if (updateError) {
      console.warn('Auto-Invoice Creator - Could not update appointment has_invoice flag:', updateError);
    }

    console.log('Auto-Invoice Creator - Successfully created invoice:', invoice.id);
    return { success: true, invoice, message: 'Rechnung automatisch erstellt' };

  } catch (error) {
    console.error('Auto-Invoice Creator - Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to determine if an appointment is eligible for auto-invoice creation
 * @param {Object} appointment - The appointment object
 * @returns {boolean} Whether the appointment can have an auto-invoice created
 */
export function canCreateAutoInvoice(appointment) {
  // Check if appointment is completed and doesn't already have an invoice
  return (
    appointment.status === 'completed' &&
    !appointment.has_invoice &&
    appointment.customer_id &&
    parseFloat(appointment.price || 0) > 0
  );
}
