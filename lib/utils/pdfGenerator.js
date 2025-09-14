import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Simple, consistent PDF generator for ZIMMR
 * 
 * This is a streamlined replacement for the original pdfGenerator.js
 * with just two functions: generateInvoicePdf and generateQuotePdf
 */

// Helper function for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

// Helper function for German date formatting (DD.MM.YYYY)
const formatGermanDate = (dateString) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'N/A';
  }
};

/**
 * Generate an invoice PDF in German format
 * @param {Object} invoice - The invoice data
 * @param {Object} craftsmanData - The craftsman data
 * @returns {boolean} - Success indicator
 */
export const generateInvoicePdf = (invoice, craftsmanData = {}) => {
  try {
    console.log('Generating invoice PDF with data:', { invoice, craftsmanData });
    
    // CRITICAL FIX: Create placeholder materials when none are provided but we have a materials price
    if ((!invoice.materials || !Array.isArray(invoice.materials) || invoice.materials.length === 0) && 
        invoice.total_materials_price && parseFloat(invoice.total_materials_price) > 0) {
      console.log('Creating placeholder materials for invoice PDF since no materials array was provided');
      invoice.materials = [{
        name: 'Materialien',
        quantity: 1,
        unit: 'Pauschal',
        unit_price: parseFloat(invoice.total_materials_price)
      }];
    }
    
    // Detailed materials debugging for invoice PDF
    console.log('====== INVOICE PDF MATERIALS DEBUG ======');
    console.log('Materials array received:', JSON.stringify(invoice.materials, null, 2));
    console.log('Materials valid array?', Array.isArray(invoice.materials));
    console.log('Materials length:', Array.isArray(invoice.materials) ? invoice.materials.length : 0);
    console.log('Total materials price from invoice:', invoice.total_materials_price);
    console.log('==========================================');
    
    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set up document constants
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    let yPos = 20; // Starting Y position
    
    // Add craftsman business information at top
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Extract craftsman details
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || 'ZIMMR Handwerker';
    const craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    
    // Business header
    const businessHeaderText = `${craftsmanName}, ${craftsmanAddress}`;
    pdf.text(businessHeaderText, margin, yPos);
    
    // Recipient address block
    yPos += 15;
    pdf.text(invoice.customer_name || 'Kunde', margin, yPos);
    yPos += 5;
    pdf.text(invoice.customer_address || '', margin, yPos);
    
    // Add document title with German formatted invoice number
    yPos += 25;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const invoiceNumber = invoice.invoice_number_formatted || invoice.invoice_number || `${new Date().getFullYear()}-${String(invoice.id).padStart(3, '0')}`;
    pdf.text(`RECHNUNG Nr. ${invoiceNumber}`, margin, yPos);
    
    // Add invoice type if not final
    if (invoice.invoice_type && invoice.invoice_type !== 'final') {
      yPos += 8;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const typeText = invoice.invoice_type === 'partial' ? 'Teilrechnung' : 
                      invoice.invoice_type === 'down_payment' ? 'Anzahlungsrechnung' : '';
      pdf.text(`(${typeText})`, margin, yPos);
    }
    
    // Add invoice date (use issue_date if available)
    yPos += 15;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const issueDate = invoice.issue_date || invoice.created_at;
    pdf.text(`Rechnungsdatum: ${formatGermanDate(issueDate)}`, margin, yPos);
    
    // Add due date if available
    yPos += 5;
    const dueDateString = invoice.due_date || '';
    pdf.text(`Fälligkeitsdatum: ${formatGermanDate(dueDateString)}`, margin, yPos);
    
    // Add service period if available
    if (invoice.service_period_start || invoice.service_period_end) {
      yPos += 5;
      const startDate = invoice.service_period_start ? formatGermanDate(invoice.service_period_start) : '';
      const endDate = invoice.service_period_end ? formatGermanDate(invoice.service_period_end) : '';
      if (startDate && endDate) {
        pdf.text(`Leistungszeitraum: ${startDate} - ${endDate}`, margin, yPos);
      } else if (startDate) {
        pdf.text(`Leistungsdatum: ${startDate}`, margin, yPos);
      }
    } else if (invoice.service_date) {
      yPos += 5;
      pdf.text(`Leistungsdatum: ${formatGermanDate(invoice.service_date)}`, margin, yPos);
    }
    
    // Add invoice description/notes
    yPos += 10;
    pdf.text('Betreff: ' + (invoice.description || 'Handwerkerleistungen'), margin, yPos);
    
    // Add table header for line items
    yPos += 15;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pos.', 25, yPos);
    pdf.text('Beschreibung', 40, yPos);
    pdf.text('Menge', 115, yPos);
    pdf.text('Einheit', 135, yPos);
    pdf.text('Preis', 155, yPos);
    pdf.text('Summe', 175, yPos);
    
    // Draw header line
    yPos += 2;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    // Initialize item counter
    let itemNumber = 1;
    
    // Add line items
    pdf.setFont('helvetica', 'normal');
    if (invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
      // Add detailed line items
      invoice.line_items.forEach(item => {
        // Position number
        pdf.text(String(itemNumber), 25, yPos);
        
        // Description (multi-line if needed)
        const description = item.description || '';
        const descriptionLines = pdf.splitTextToSize(description, 70);
        pdf.text(descriptionLines, 40, yPos);
        
        // Quantity, unit, price, total
        pdf.text(String(item.quantity || '1'), 115, yPos);
        pdf.text(String(item.unit || 'Stück'), 135, yPos);
        pdf.text(formatCurrency(item.price || 0).replace('€ ', ''), 155, yPos);
        
        const itemTotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 1)).toFixed(2);
        pdf.text(formatCurrency(parseFloat(itemTotal)), 175, yPos);
        
        // Move Y position for next item, accounting for multi-line descriptions
        yPos += Math.max(descriptionLines.length * 5, 8);
        itemNumber++;
      });
    } else {
      // Fallback to a single line item
      pdf.text('1', 25, yPos);
      
      const description = invoice.notes || 'Erbrachte Leistungen';
      const descriptionLines = pdf.splitTextToSize(description, 70);
      pdf.text(descriptionLines, 40, yPos);
      
      pdf.text('1', 115, yPos);
      pdf.text('Pauschal', 135, yPos);
      pdf.text(formatCurrency(parseFloat(invoice.amount || 0)).replace('€ ', ''), 155, yPos);
      pdf.text(formatCurrency(parseFloat(invoice.amount || 0)), 175, yPos);
      
      yPos += Math.max(descriptionLines.length * 5, 8);
      itemNumber++;
    }
    
    // Add materials if available
    if (invoice.materials && Array.isArray(invoice.materials) && invoice.materials.length > 0) {
      console.log('Adding materials section to PDF, materials count:', invoice.materials.length);
      // Add a clear separator and heading for Materials section
      yPos += 10;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      
      // Materials section header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('MATERIALIEN', margin, yPos);
      pdf.setFontSize(10);
      yPos += 12;
      
      // Add materials table header
      pdf.setFont('helvetica', 'bold');
      pdf.text('Pos.', 25, yPos);
      pdf.text('Material', 40, yPos);
      pdf.text('Menge', 115, yPos);
      pdf.text('Einheit', 135, yPos);
      pdf.text('Preis', 155, yPos);
      pdf.text('Summe', 175, yPos);
      
      // Draw header line for materials table
      yPos += 2;
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      pdf.setFont('helvetica', 'normal');
      
      // Add each material as a line item (display only, no calculation)
      invoice.materials.forEach(material => {
        pdf.text(String(itemNumber), 25, yPos);
        
        const materialName = material.name || 'Unbekanntes Material';
        const materialDesc = pdf.splitTextToSize(materialName, 70);
        pdf.text(materialDesc, 40, yPos);
        
        const quantity = parseFloat(material.quantity) || 0;
        const unitPrice = parseFloat(material.unit_price) || 0;
        const total = quantity * unitPrice;
        
        pdf.text(quantity.toLocaleString('de-DE'), 115, yPos);
        pdf.text(material.unit || 'Stück', 135, yPos);
        pdf.text(formatCurrency(unitPrice).replace('€ ', ''), 155, yPos);
        pdf.text(formatCurrency(total), 175, yPos);
        
        yPos += Math.max(materialDesc.length * 5, 8);
        itemNumber++;
      });
      
      // Add materials subtotal using corrected value from frontend
      const materialsTotal = parseFloat(invoice.total_materials_price) || 0;
      yPos += 5;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.line(130, yPos, pageWidth - margin, yPos);
      yPos += 8;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Materialien Zwischensumme:', 100, yPos);
      pdf.text(formatCurrency(materialsTotal), 175, yPos);
      yPos += 5;
    }
    
    // Draw subtotal line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
    
    // Use the corrected values from frontend (no complex recalculation needed)
    const baseAmount = parseFloat(invoice.amount || 0);
    const materialsTotal = parseFloat(invoice.total_materials_price || 0);
    const subtotal = baseAmount + materialsTotal;
    const taxAmount = parseFloat(invoice.tax_amount || 0);
    const totalAmount = parseFloat(invoice.total_amount || 0);
    
    // Add subtotal, VAT, and total
    yPos += 13;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme (netto)', 130, yPos);
    pdf.text(formatCurrency(subtotal), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    
    // Handle different VAT scenarios based on German law
    if (invoice.small_business_exempt) {
      pdf.text('Umsatzsteuer (§19 UStG befreit)', 130, yPos);
      pdf.text('0,00 €', 175, yPos);
    } else if (invoice.reverse_charge) {
      pdf.text('Umsatzsteuer (Reverse Charge)', 130, yPos);
      pdf.text('0,00 €', 175, yPos);
    } else {
      pdf.text('Umsatzsteuer 19 %', 130, yPos);
      pdf.text(formatCurrency(taxAmount), 175, yPos);
    }
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Gesamtbetrag', 130, yPos);
    pdf.text(formatCurrency(totalAmount), 175, yPos);
    
    // Add German legal footer text
    yPos += 20;
    pdf.setFont('helvetica', 'normal');
    
    if (invoice.legal_footer_text) {
      // Use custom legal footer text
      const footerLines = pdf.splitTextToSize(invoice.legal_footer_text, pageWidth - 2 * margin);
      pdf.text(footerLines, margin, yPos);
      yPos += footerLines.length * 5;
    } else {
      // Default German payment instructions
      const paymentTerms = invoice.payment_terms_days || 14;
      pdf.text(`Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer bis zum`, margin, yPos);
      pdf.text(`${formatGermanDate(dueDateString)} (${paymentTerms} Tage nach Rechnungsdatum).`, margin, yPos + 5);
      
      if (invoice.small_business_exempt) {
        yPos += 10;
        pdf.text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', margin, yPos);
      } else if (invoice.reverse_charge) {
        yPos += 10;
        pdf.text('Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).', margin, yPos);
      }
      
      yPos += 10;
      pdf.text('Bei Zahlungsverzug werden Verzugszinsen in Höhe von 9 Prozentpunkten über dem', margin, yPos);
      pdf.text('Basiszinssatz berechnet.', margin, yPos + 5);
    }
    
    // Add footer with business information
    const footerY = 260;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    // Extract craftsman profile details with better fallbacks
    const craftsmanPhone = craftsmanData.phone || craftsmanData.contact_phone || '123-456-7890';
    const craftsmanEmail = craftsmanData.email || craftsmanData.contact_email || 'kontakt@zimmr.de';
    const taxId = invoice.tax_number || craftsmanData.tax_number || craftsmanData.tax_id || craftsmanData.vat_number || '123/456/78901';
    const vatId = invoice.vat_id || craftsmanData.vat_id || 'DE123456789';
    const ownerName = craftsmanData.owner_name || craftsmanName;
    const bankName = craftsmanData.bank_name || 'Deutsche Bank';
    const iban = craftsmanData.iban || 'DE89 3704 0044 0532 0130 00';
    const bic = craftsmanData.bic || 'COBADEFFXXX';
    
    // Company details on left
    pdf.text(craftsmanName, margin, footerY);
    pdf.text(craftsmanAddress, margin, footerY + 4);
    pdf.text(`Tel.: ${craftsmanPhone}`, margin, footerY + 8);
    pdf.text(craftsmanEmail, margin, footerY + 12);
    
    // Tax and registration info in middle
    if (taxId) {
      pdf.text(`Steuernummer: ${taxId}`, 80, footerY);
    }
    if (vatId) {
      pdf.text(`USt-IdNr.: ${vatId}`, 80, footerY + 4);
    }
    pdf.text(`Geschäftsführer: ${ownerName}`, 80, footerY + 8);
    
    // Banking info on right
    pdf.text(bankName, 140, footerY);
    pdf.text(`IBAN: ${iban}`, 140, footerY + 4);
    pdf.text(`BIC: ${bic}`, 140, footerY + 8);
    
    // Page number at bottom
    pdf.text('Seite 1/1', 100, footerY + 16);
    
    // Generate a filename
    const filename = `rechnung_${invoice.invoice_number || invoice.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    console.log('Invoice PDF generated successfully');
    return true;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw error;
  }
};

/**
 * Generate a quote PDF in German format
 * @param {Object} quote - The quote data
 * @param {Object} craftsmanData - The craftsman data
 * @returns {boolean} - Success indicator
 */
export const generateQuotePdf = (quote, craftsmanData = {}) => {
  try {
    console.log('Generating quote PDF with data:', { quote, craftsmanData });
    
    // CRITICAL FIX: Create placeholder materials when none are provided but we have a materials price
    if ((!quote.materials || !Array.isArray(quote.materials) || quote.materials.length === 0) && 
        quote.total_materials_price && parseFloat(quote.total_materials_price) > 0) {
      console.log('Creating placeholder materials for quote PDF since no materials array was provided');
      quote.materials = [{
        name: 'Materialien',
        quantity: 1,
        unit: 'Pauschal',
        unit_price: parseFloat(quote.total_materials_price)
      }];
    }
    
    // Detailed materials debugging for quote PDF
    console.log('====== QUOTE PDF MATERIALS DEBUG ======');
    console.log('Materials array received:', JSON.stringify(quote.materials, null, 2));
    console.log('Materials valid array?', Array.isArray(quote.materials));
    console.log('Materials length:', Array.isArray(quote.materials) ? quote.materials.length : 0);
    console.log('Total materials price from quote:', quote.total_materials_price);
    console.log('========================================');
    
    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Set up document constants
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    let yPos = 20; // Starting Y position
    
    // Add craftsman business information at top
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Extract craftsman details
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || 'ZIMMR Handwerker';
    const craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    
    // Business header
    const businessHeaderText = `${craftsmanName}, ${craftsmanAddress}`;
    pdf.text(businessHeaderText, margin, yPos);
    
    // Recipient address block
    yPos += 15;
    pdf.text(quote.customer_name || 'Kunde', margin, yPos);
    yPos += 5;
    pdf.text(quote.customer_address || '', margin, yPos);
    
    // Add document title
    yPos += 25;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`ANGEBOT Nr. ${quote.quote_number || quote.id}`, margin, yPos);
    
    // Add quote date
    yPos += 15;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Datum: ${formatGermanDate(quote.created_at)}`, margin, yPos);
    
    // Add validity date if available
    yPos += 5;
    const validUntilDate = quote.valid_until || '';
    pdf.text(`Gültig bis: ${formatGermanDate(validUntilDate)}`, margin, yPos);
    
    // Add quote description/notes
    yPos += 10;
    pdf.text('Betreff: ' + (quote.description || 'Angebot für Handwerkerleistungen'), margin, yPos);
    
    // Add table header for line items
    yPos += 15;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pos.', 25, yPos);
    pdf.text('Beschreibung', 40, yPos);
    pdf.text('Menge', 115, yPos);
    pdf.text('Einheit', 135, yPos);
    pdf.text('Preis', 155, yPos);
    pdf.text('Summe', 175, yPos);
    
    // Draw header line
    yPos += 2;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    
    // Initialize item counter
    let itemNumber = 1;
    
    // Add line items
    pdf.setFont('helvetica', 'normal');
    if (quote.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) {
      // Add detailed line items
      quote.line_items.forEach(item => {
        // Position number
        pdf.text(String(itemNumber), 25, yPos);
        
        // Description (multi-line if needed)
        const description = item.description || '';
        const descriptionLines = pdf.splitTextToSize(description, 70);
        pdf.text(descriptionLines, 40, yPos);
        
        // Quantity, unit, price, total
        pdf.text(String(item.quantity || '1'), 115, yPos);
        pdf.text(String(item.unit || 'Stück'), 135, yPos);
        pdf.text(formatCurrency(item.price || 0).replace('€ ', ''), 155, yPos);
        
        const itemTotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 1)).toFixed(2);
        pdf.text(formatCurrency(parseFloat(itemTotal)), 175, yPos);
        
        // Move Y position for next item, accounting for multi-line descriptions
        yPos += Math.max(descriptionLines.length * 5, 8);
        itemNumber++;
      });
    } else {
      // Fallback to a single line item
      pdf.text('1', 25, yPos);
      
      const description = quote.notes || 'Angebotene Leistungen';
      const descriptionLines = pdf.splitTextToSize(description, 70);
      pdf.text(descriptionLines, 40, yPos);
      
      pdf.text('1', 115, yPos);
      pdf.text('Pauschal', 135, yPos);
      pdf.text(formatCurrency(parseFloat(quote.amount || 0)).replace('€ ', ''), 155, yPos);
      pdf.text(formatCurrency(parseFloat(quote.amount || 0)), 175, yPos);
      
      yPos += Math.max(descriptionLines.length * 5, 8);
      itemNumber++;
    }
    
    // Add materials if available
    if (quote.materials && Array.isArray(quote.materials) && quote.materials.length > 0) {
      console.log('Adding materials section to quote PDF, materials count:', quote.materials.length);
      // Add a clear separator and heading for Materials section
      yPos += 10;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      
      // Materials section header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('MATERIALIEN', margin, yPos);
      pdf.setFontSize(10);
      yPos += 12;
      
      // Add materials table header
      pdf.setFont('helvetica', 'bold');
      pdf.text('Pos.', 25, yPos);
      pdf.text('Material', 40, yPos);
      pdf.text('Menge', 115, yPos);
      pdf.text('Einheit', 135, yPos);
      pdf.text('Preis', 155, yPos);
      pdf.text('Summe', 175, yPos);
      
      // Draw header line for materials table
      yPos += 2;
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;
      pdf.setFont('helvetica', 'normal');
      
      // Initialize materials subtotal
      let materialsSubtotal = 0;
      
      // Add each material as a line item
      quote.materials.forEach(material => {
        pdf.text(String(itemNumber), 25, yPos);
        
        const materialName = material.name || 'Unbekanntes Material';
        const materialDesc = pdf.splitTextToSize(materialName, 70);
        pdf.text(materialDesc, 40, yPos);
        
        const quantity = parseFloat(material.quantity) || 0;
        const unitPrice = parseFloat(material.unit_price) || 0;
        const total = quantity * unitPrice;
        materialsSubtotal += total;
        
        pdf.text(quantity.toLocaleString('de-DE'), 115, yPos);
        pdf.text(material.unit || 'Stück', 135, yPos);
        pdf.text(formatCurrency(unitPrice).replace('€ ', ''), 155, yPos);
        pdf.text(formatCurrency(total), 175, yPos);
        
        yPos += Math.max(materialDesc.length * 5, 8);
        itemNumber++;
      });
      
      // Add materials subtotal
      yPos += 5;
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.3);
      pdf.line(130, yPos, pageWidth - margin, yPos);
      yPos += 8;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Materialien Zwischensumme:', 100, yPos);
      pdf.text(formatCurrency(materialsSubtotal), 175, yPos);
      yPos += 5;
    }
    
    // Draw subtotal line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
    

    
    // Use the corrected values from frontend (no complex recalculation needed)
    const baseAmount = parseFloat(quote.amount || 0);
    const materialsTotal = parseFloat(quote.total_materials_price || 0);
    const subtotal = baseAmount + materialsTotal;
    const taxAmount = parseFloat(quote.tax_amount || 0);
    const totalAmount = parseFloat(quote.total_amount || 0);
    
    // Add subtotal, VAT, and total
    yPos += 13;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme (netto)', 130, yPos);
    pdf.text(formatCurrency(subtotal), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Umsatzsteuer 19 %', 130, yPos);
    pdf.text(formatCurrency(taxAmount), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Gesamtbetrag', 130, yPos);
    pdf.text(formatCurrency(totalAmount), 175, yPos);
    
    // Add quote-specific footer text
    yPos += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Dieses Angebot ist freibleibend und unverbindlich. Alle genannten Preise sind Nettopreise', margin, yPos);
    pdf.text('zuzüglich der gesetzlichen Mehrwertsteuer. Dieses Angebot ist gültig bis zum', margin, yPos + 5);
    pdf.text(formatGermanDate(validUntilDate) + '.', margin, yPos + 10);
    
    // Add footer with business information
    const footerY = 260;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    // Extract craftsman profile details
    const craftsmanPhone = craftsmanData.phone || craftsmanData.contact_phone || '';
    const craftsmanEmail = craftsmanData.email || craftsmanData.contact_email || '';
    const taxId = craftsmanData.tax_id || craftsmanData.vat_number || '';
    const ownerName = craftsmanData.owner_name || craftsmanName;
    const bankName = craftsmanData.bank_name || 'Bank';
    const iban = craftsmanData.iban || '';
    const bic = craftsmanData.bic || '';
    
    // Company details on left
    pdf.text(craftsmanName, margin, footerY);
    pdf.text(craftsmanAddress, margin, footerY + 4);
    pdf.text(`Tel.: ${craftsmanPhone}`, margin, footerY + 8);
    pdf.text(craftsmanEmail, margin, footerY + 12);
    
    // Tax and registration info in middle
    pdf.text(`Steuernummer: ${taxId}`, 80, footerY);
    pdf.text(`Geschäftsführer: ${ownerName}`, 80, footerY + 4);
    
    // Banking info on right
    pdf.text(bankName, 140, footerY);
    pdf.text(`IBAN: ${iban}`, 140, footerY + 4);
    pdf.text(`BIC: ${bic}`, 140, footerY + 8);
    
    // Page number at bottom
    pdf.text('Seite 1/1', 100, footerY + 16);
    
    // Generate a filename
    const filename = `angebot_${quote.quote_number || quote.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    console.log('Quote PDF generated successfully');
    return true;
  } catch (error) {
    console.error('Error generating quote PDF:', error);
    throw error;
  }
};

/**
 * Generate a standalone document PDF (notes, communications, client info, etc.)
 * @param {Object} document - The document data
 * @param {Object} craftsmanData - The craftsman data
 * @returns {boolean} - Success indicator
 */
export const generateDocumentPdf = (document, craftsmanData = {}) => {
  try {
    console.log('Generating document PDF with data:', { document, craftsmanData });
    
    const doc = new jsPDF();
    let yPosition = 20;
    
    // Company header
    if (craftsmanData.business_name || craftsmanData.name) {
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text(craftsmanData.business_name || craftsmanData.name, 20, yPosition);
      yPosition += 10;
    }
    
    // Company details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    if (craftsmanData.address) {
      doc.text(craftsmanData.address, 20, yPosition);
      yPosition += 5;
    }
    if (craftsmanData.phone) {
      doc.text(`Tel: ${craftsmanData.phone}`, 20, yPosition);
      yPosition += 5;
    }
    if (craftsmanData.email) {
      doc.text(`E-Mail: ${craftsmanData.email}`, 20, yPosition);
      yPosition += 5;
    }
    if (craftsmanData.tax_number) {
      doc.text(`Steuernummer: ${craftsmanData.tax_number}`, 20, yPosition);
      yPosition += 5;
    }
    if (craftsmanData.vat_id) {
      doc.text(`USt-IdNr: ${craftsmanData.vat_id}`, 20, yPosition);
      yPosition += 10;
    }
    
    // Document title
    yPosition += 10;
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text(document.title || 'Dokument', 20, yPosition);
    yPosition += 15;
    
    // Document info
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Dokumenttyp: ${getDocumentTypeLabel(document.document_type)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Ordner: ${getFolderTypeLabel(document.folder_type)}`, 20, yPosition);
    yPosition += 7;
    doc.text(`Erstellt: ${formatGermanDate(document.created_at)}`, 20, yPosition);
    yPosition += 7;
    
    if (document.version > 1) {
      doc.text(`Version: ${document.version}`, 20, yPosition);
      yPosition += 7;
    }
    
    // Customer info if available
    if (document.customers) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Kunde:', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(document.customers.name, 30, yPosition);
      yPosition += 6;
      
      if (document.customers.address) {
        doc.text(document.customers.address, 30, yPosition);
        yPosition += 6;
      }
      if (document.customers.email) {
        doc.text(document.customers.email, 30, yPosition);
        yPosition += 6;
      }
      if (document.customers.phone) {
        doc.text(document.customers.phone, 30, yPosition);
        yPosition += 6;
      }
    }
    
    // Document-specific content
    yPosition = addDocumentSpecificContent(doc, document, yPosition);
    
    // Description
    if (document.description) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Beschreibung:', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      const descriptionLines = doc.splitTextToSize(document.description, 170);
      doc.text(descriptionLines, 20, yPosition);
      yPosition += descriptionLines.length * 6;
    }
    
    // Notes
    if (document.notes) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Notizen:', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      const notesLines = doc.splitTextToSize(document.notes, 170);
      doc.text(notesLines, 20, yPosition);
      yPosition += notesLines.length * 6;
    }
    
    // Tags
    if (document.tags && document.tags.length > 0) {
      yPosition += 10;
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text('Tags:', 20, yPosition);
      yPosition += 8;
      
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      doc.text(document.tags.join(', '), 20, yPosition);
      yPosition += 6;
    }
    
    // Linked items
    yPosition = addLinkedItemsContent(doc, document, yPosition);
    
    // Footer
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(`Generiert am ${formatGermanDate(new Date().toISOString())} um ${new Date().toLocaleTimeString('de-DE')}`, 
              20, doc.internal.pageSize.height - 20);
    
    // Save the PDF
    const filename = `${document.title.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    doc.save(filename);
    
    console.log('Document PDF generated successfully');
    return true;
    
  } catch (error) {
    console.error('Error generating document PDF:', error);
    throw error;
  }
};

// Helper functions for document PDF generation
function getDocumentTypeLabel(type) {
  const types = {
    'quote': 'Kostenvoranschlag',
    'invoice': 'Rechnung', 
    'note': 'Notiz',
    'communication': 'Kommunikation',
    'upload': 'Upload',
    'client_info': 'Kundeninfo'
  };
  return types[type] || type;
}

function getFolderTypeLabel(type) {
  const folders = {
    'clients': 'Kunden',
    'quotes': 'Kostenvoranschläge',
    'invoices': 'Rechnungen',
    'uploads': 'Uploads',
    'notes': 'Notizen',
    'comms': 'Kommunikation'
  };
  return folders[type] || type;
}

function addDocumentSpecificContent(doc, document, yPosition) {
  if (!document.content_data) return yPosition;

  const contentData = document.content_data;
  
  switch (document.document_type) {
    case 'communication':
      if (contentData.communication_type || contentData.communication_date) {
        yPosition += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Kommunikationsdetails:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        
        if (contentData.communication_type) {
          doc.text(`Typ: ${getCommunicationTypeLabel(contentData.communication_type)}`, 30, yPosition);
          yPosition += 6;
        }
        
        if (contentData.communication_date) {
          const date = new Date(contentData.communication_date);
          doc.text(`Datum: ${formatGermanDate(contentData.communication_date)} ${date.toLocaleTimeString('de-DE')}`, 30, yPosition);
          yPosition += 6;
        }
      }
      break;
      
    case 'client_info':
      if (contentData.client_doc_type || contentData.status) {
        yPosition += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Kundeninformationen:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        
        if (contentData.client_doc_type) {
          doc.text(`Dokumenttyp: ${getClientDocTypeLabel(contentData.client_doc_type)}`, 30, yPosition);
          yPosition += 6;
        }
        
        if (contentData.status) {
          doc.text(`Status: ${getStatusLabel(contentData.status)}`, 30, yPosition);
          yPosition += 6;
        }
      }
      break;
      
    case 'note':
      if (contentData.priority) {
        yPosition += 10;
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Notizdetails:', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text(`Priorität: ${getPriorityLabel(contentData.priority)}`, 30, yPosition);
        yPosition += 6;
      }
      break;
  }
  
  return yPosition;
}

function addLinkedItemsContent(doc, document, yPosition) {
  if (document.appointments || document.quotes || document.invoices) {
    yPosition += 10;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Verknüpfte Elemente:', 20, yPosition);
    yPosition += 8;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
  }
  
  if (document.appointments) {
    doc.text(`Termin: #${document.appointments.id}`, 30, yPosition);
    yPosition += 6;
    doc.text(`Datum: ${formatGermanDate(document.appointments.scheduled_at)}`, 30, yPosition);
    yPosition += 6;
    
    if (document.appointments.location) {
      doc.text(`Ort: ${document.appointments.location}`, 30, yPosition);
      yPosition += 6;
    }
  }
  
  if (document.quotes) {
    doc.text(`Kostenvoranschlag: #${document.quotes.id}`, 30, yPosition);
    yPosition += 6;
    doc.text(`Betrag: ${formatCurrency(parseFloat(document.quotes.amount || 0))}`, 30, yPosition);
    yPosition += 6;
  }
  
  if (document.invoices) {
    doc.text(`Rechnung: ${document.invoices.invoice_number_formatted || `#${document.invoices.id}`}`, 30, yPosition);
    yPosition += 6;
    doc.text(`Betrag: ${formatCurrency(parseFloat(document.invoices.total_amount || 0))}`, 30, yPosition);
    yPosition += 6;
  }
  
  return yPosition;
}

function getCommunicationTypeLabel(type) {
  const types = {
    'email': 'E-Mail',
    'phone': 'Telefon',
    'meeting': 'Besprechung',
    'letter': 'Brief'
  };
  return types[type] || type;
}

function getClientDocTypeLabel(type) {
  const types = {
    'contract': 'Vertrag',
    'agreement': 'Vereinbarung',
    'profile': 'Kundenprofil',
    'notes': 'Kundennotizen'
  };
  return types[type] || type;
}

function getStatusLabel(status) {
  const statuses = {
    'active': 'Aktiv',
    'pending': 'Ausstehend',
    'completed': 'Abgeschlossen'
  };
  return statuses[status] || status;
}

function getPriorityLabel(priority) {
  const priorities = {
    'low': 'Niedrig',
    'normal': 'Normal',
    'high': 'Hoch',
    'urgent': 'Dringend'
  };
  return priorities[priority] || priority;
}

// Export default object with all functions
export default {
  generateInvoicePdf,
  generateQuotePdf,
  generateDocumentPdf
};
