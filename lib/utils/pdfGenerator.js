import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Simple, consistent PDF generator for ZIMMR
 * 
 * This is a streamlined replacement for the original pdfGenerator.js
 * with just two functions: generateInvoicePdf and generateQuotePdf
 */

// PDF Layout Constants
const FOOTER_HEIGHT = 50;
const FOOTER_START_Y_OFFSET = 35; // Distance from bottom of page
const PAGE_BOTTOM_MARGIN = 80; // Reserve space for footer + buffer

// Helper function for currency formatting
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
};

// Helper function for German number formatting (with thousands separator)
// Examples: 1.000,00 / 10.000,00 / 100.000,00
const formatGermanNumber = (number) => {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
};

// Helper function for German date formatting (DD.MM.YYYY)
const formatGermanDate = (dateString) => {
  try {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
  } catch (e) {
    console.error('Error formatting date:', e);
    return '';
  }
};

/**
 * Generate an invoice PDF in German format matching professional template
 * @param {Object} invoice - Invoice data
 * @param {Object} craftsmanData - The craftsman data
 * @returns {boolean} - Success indicator
 */
export const generateInvoicePdf = (invoice, craftsmanData = {}) => {
  try {
    console.log('Generating professional invoice PDF with data:', { invoice, craftsmanData });
    
    // Add comprehensive logging to debug undefined issues
    console.log('=== DEBUGGING UNDEFINED ISSUE ===');
    console.log('Invoice customer_name:', invoice.customer_name, 'Type:', typeof invoice.customer_name);
    console.log('Invoice customer_address:', invoice.customer_address, 'Type:', typeof invoice.customer_address);
    console.log('CraftsmanData:', craftsmanData);
    console.log('=================================');
    
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
    
    // Create a safe text wrapper that filters out ALL undefined/null text
    const originalText = pdf.text.bind(pdf);
    pdf.text = function(text, x, y, options) {
      // Convert to string for checking
      const textStr = text ? String(text) : '';
      
      // Log every text call for debugging
      if (textStr.toLowerCase().includes('undefined')) {
        console.error('🚨 FOUND UNDEFINED TEXT:', text, 'at position', x, y);
        return; // Block it
      }
      
      // Skip if text is undefined, null, or literally 'undefined'
      if (!text || 
          text === undefined || 
          text === null || 
          textStr === 'undefined' || 
          textStr === 'null' ||
          textStr.trim() === 'undefined' ||
          textStr.trim() === 'null' ||
          textStr === 'undefined undefined' ||
          textStr.includes('undefined')) {
        console.warn('BLOCKED text from PDF:', text, 'at position', x, y);
        return;
      }
      
      // Call original text function
      return originalText(text, x, y, options);
    };
    
    // Set up document constants
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    let yPos = 15; // Starting Y position
    
    // Extract craftsman details with better error handling
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || '';
    let craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    const craftsmanSubtitle = craftsmanData.business_type || 'Handwerksbetrieb';
    
    // Clean up undefined strings in craftsman data
    if (craftsmanAddress === 'undefined' || craftsmanAddress === 'null' || !craftsmanAddress) {
      craftsmanAddress = '';
    }
    
    // ===== LOGO/COMPANY NAME AT TOP LEFT =====
    const headerPdfSettings = craftsmanData.pdf_settings || {};
    const headerCompanyName = headerPdfSettings.company_name || craftsmanData.name || craftsmanName || '';
    const logoUrl = headerPdfSettings.logo_url || '';
    
    if (headerCompanyName || logoUrl) {
      // Square logo dimensions
      const logoSize = 30; // 30mm square
      const logoX = margin;
      const logoY = yPos;
      
      // Check if we have a custom logo uploaded
      if (logoUrl) {
        try {
          // Add the uploaded logo image
          pdf.addImage(logoUrl, 'PNG', logoX, logoY, logoSize, logoSize);
          yPos += logoSize + 5;
        } catch (error) {
          console.warn('Failed to load custom logo, using fallback:', error);
          // Fall back to yellow box if image loading fails
          drawDefaultLogo();
        }
      } else {
        // No custom logo - use default yellow box
        drawDefaultLogo();
      }
      
      function drawDefaultLogo() {
        // Draw logo background
        pdf.setFillColor(255, 203, 0); // Yellow/gold color
        pdf.rect(logoX, logoY, logoSize, logoSize, 'F');
        
        // Draw border
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.8);
        pdf.rect(logoX, logoY, logoSize, logoSize);
        
        // Prepare company name text (split into lines if needed)
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const logoText = headerCompanyName.toUpperCase();
        const maxWidth = logoSize - 4; // Leave 2mm padding on each side
        const textLines = pdf.splitTextToSize(logoText, maxWidth);
        
        // Calculate vertical centering
        const lineHeight = 5;
        const totalTextHeight = textLines.length * lineHeight;
        const textStartY = logoY + (logoSize - totalTextHeight) / 2 + 4;
        
        // Draw centered text
        pdf.setTextColor(0, 0, 0); // Black text
        textLines.forEach((line, index) => {
          const lineWidth = pdf.getTextWidth(line);
          const textX = logoX + (logoSize - lineWidth) / 2; // Center horizontally
          pdf.text(line, textX, textStartY + (index * lineHeight));
        });
        
        // Reset text color
        pdf.setTextColor(0, 0, 0);
        yPos += logoSize + 5; // Add spacing after logo
      }
    }
    
    // ===== SENDER LINE (UNDERLINED - Small font per German standard) =====
    const headerCompanyAddress = headerPdfSettings.company_address || craftsmanData.address || craftsmanAddress || '';
    
    if (headerCompanyName && headerCompanyAddress) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      const senderLine = `${headerCompanyName}, ${headerCompanyAddress}`;
      pdf.text(senderLine, margin, yPos);
      
      // Underline the sender line
      const textWidth = pdf.getTextWidth(senderLine);
      pdf.setLineWidth(0.2);
      pdf.line(margin, yPos + 0.5, margin + textWidth, yPos + 0.5);
    }
    yPos += 8;
    
    // ===== RECEIVER BLOCK (Customer Address) =====
    // Debug customer data with more detail
    console.log('=== CUSTOMER DATA DEBUG ===');
    console.log('Raw customer_name:', invoice.customer_name);
    console.log('Raw customer_address:', invoice.customer_address);
    console.log('customer_name type:', typeof invoice.customer_name);
    console.log('customer_address type:', typeof invoice.customer_address);
    console.log('customer_name === "undefined":', invoice.customer_name === 'undefined');
    console.log('customer_address === "undefined":', invoice.customer_address === 'undefined');
    console.log('Invoice keys:', Object.keys(invoice));
    console.log('=========================');
    
    // Handle customer data more robustly - check both customer object and direct fields
    let customerName = invoice.customer_name;
    let customerAddress = invoice.customer_address;
    
    // If customer_name is undefined or contains "undefined", try to get from customer object
    if (!customerName || String(customerName).includes('undefined')) {
      if (invoice.customer && invoice.customer.name) {
        customerName = invoice.customer.name;
        console.log('Using customer.name instead:', customerName);
      }
    }
    
    // If customer_address is undefined, try to get from customer object
    if (!customerAddress || String(customerAddress).includes('undefined')) {
      if (invoice.customer && invoice.customer.address) {
        customerAddress = invoice.customer.address;
        console.log('Using customer.address instead:', customerAddress);
      } else if (invoice.location) {
        customerAddress = invoice.location;
        console.log('Using invoice.location instead:', customerAddress);
      }
    }
    
    // Clean up undefined strings and null values - be very strict
    if (!customerName || 
        customerName === 'undefined' || 
        customerName === 'null' || 
        customerName === undefined ||
        String(customerName).toLowerCase() === 'undefined' ||
        String(customerName).toLowerCase() === 'null') {
      customerName = '';
    }
    
    if (!customerAddress || 
        customerAddress === 'undefined' || 
        customerAddress === 'null' || 
        customerAddress === undefined ||
        String(customerAddress).toLowerCase() === 'undefined' ||
        String(customerAddress).toLowerCase() === 'null') {
      customerAddress = '';
    }
    
    // ===== CUSTOMER ADDRESS BLOCK (Receiver) - Properly formatted =====
    const hasValidCustomerData = (customerName && customerName.toString().trim() !== '') || 
                                  (customerAddress && customerAddress.toString().trim() !== '');
    
    if (hasValidCustomerData) {
      // Customer name in bold
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      
      if (customerName && customerName.toString().trim() !== '') {
        pdf.text(customerName, margin, yPos);
        yPos += 6;
      }
      
      // Address in normal font
      pdf.setFont('helvetica', 'normal');
      if (customerAddress && customerAddress.toString().trim() !== '') {
        // Split multi-line addresses
        const addressLines = customerAddress.split(/[\n,]/).filter(line => line.trim());
        addressLines.forEach(line => {
          pdf.text(line.trim(), margin, yPos);
          yPos += 5;
        });
      }
    }
    yPos += 20;
    
    // ===== DOCUMENT TITLE AND INFO TABLE (HEADER STYLE) =====
    yPos += 15;
    
    // Calculate table dimensions
    const titleTableY = yPos;
    const titleTableHeight = 12;
    const titleWidth = 100;
    const infoWidth = pageWidth - 2 * margin - titleWidth;
    
    // Draw gray background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, titleTableY, pageWidth - 2 * margin, titleTableHeight, 'F');
    
    // Draw outer border for entire header table
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, titleTableY, pageWidth - 2 * margin, titleTableHeight);
    
    // Draw vertical line separating title from info
    pdf.line(margin + titleWidth, titleTableY, margin + titleWidth, titleTableY + titleTableHeight);
    
    // Document title on the left side
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const documentTitle = invoice.invoice_type === 'final' ? 'Schlussrechnung' : 
                         invoice.invoice_type === 'partial' ? 'Teilrechnung' : 
                         invoice.invoice_type === 'down_payment' ? 'Anzahlungsrechnung' : 'Rechnung';
    pdf.text(documentTitle, margin + 3, titleTableY + 8);
    
    // Info section on the right (3 columns)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    const infoStartX = margin + titleWidth + 3;
    const infoColWidth = infoWidth / 3;
    
    // Format invoice number
    const invoiceNumber = invoice.invoice_number_formatted || 
                         (invoice.invoice_number ? `RE${String(invoice.invoice_number).padStart(4, '0')}` : 
                          `RE${String(invoice.id).padStart(4, '0')}`);
    
    // Customer number
    const customerNumber = invoice.customer_number || '10026';
    
    // Date
    const issueDate = invoice.issue_date || invoice.created_at;
    
    // Draw vertical lines between info columns
    pdf.line(infoStartX + infoColWidth - 3, titleTableY, infoStartX + infoColWidth - 3, titleTableY + titleTableHeight);
    pdf.line(infoStartX + 2 * infoColWidth - 3, titleTableY, infoStartX + 2 * infoColWidth - 3, titleTableY + titleTableHeight);
    
    // Column 1: Rechnungsnr
    let infoY = titleTableY + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Rechnungsnr.:', infoStartX, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(invoiceNumber, infoStartX, infoY + 4);
    
    // Column 2: Kundennr
    pdf.setFont('helvetica', 'bold');
    pdf.text('Kundennr.:', infoStartX + infoColWidth, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(customerNumber), infoStartX + infoColWidth, infoY + 4);
    
    // Column 3: Datum
    pdf.setFont('helvetica', 'bold');
    pdf.text('Datum:', infoStartX + 2 * infoColWidth, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatGermanDate(issueDate) || '–', infoStartX + 2 * infoColWidth, infoY + 4);
    
    yPos = titleTableY + titleTableHeight + 5;
    
    // Professional description line
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const description = invoice.description || 'Unsere Lieferungen/Leistungen stellen wir Ihnen wie folgt in Rechnung.';
    pdf.text(description, margin, yPos);
    yPos += 18;
    
    // ===== PROFESSIONAL LINE ITEMS TABLE =====
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Table header with properly calculated column positions to avoid overlap
    const tableStartY = yPos;
    const colPos = margin + 2;           // Position: 22mm
    const colDesc = 32;                   // Description: 32mm
    const colQty = 105;                   // Quantity: 105mm
    const colUnit = 125;                  // Unit: 125mm
    const colPriceRight = 155;            // Unit Price (right-aligned): 155mm
    const colTotal = pageWidth - margin - 10;  // Total (right-aligned from margin): ~180mm
    
    // Draw header background with better height
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
    
    // Draw header border
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10);
    
    // Header text with improved spacing
    pdf.text('Pos.', colPos, yPos);
    pdf.text('Bezeichnung', colDesc, yPos);
    pdf.text('Menge', colQty + 15, yPos, { align: 'right' }); // Right-aligned for numeric column
    pdf.text('Einheit', colUnit, yPos);
    pdf.text('Einzel €', colPriceRight, yPos, { align: 'right' });
    pdf.text('Gesamt €', colTotal, yPos, { align: 'right' });
    
    yPos += 10;
    
    // Initialize item counter and subtotal tracking
    let itemNumber = 1;
    let runningSubtotal = 0;
    
    // Create unified items array combining line_items and materials
    const allItems = [];
    
    // Add line items first (filter out auto-generated placeholder lines)
    if (invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
      invoice.line_items.forEach(item => {
        // Skip auto-generated appointment placeholder lines
        if (item.description && item.description.includes('Automatisch erstellt')) {
          console.log('Filtering out auto-generated line:', item.description);
          return;
        }
        allItems.push({
          type: 'service',
          description: item.description || '',
          quantity: parseFloat(item.quantity || 1),
          unit: item.unit || 'Stück',
          unitPrice: parseFloat(item.price || 0)
        });
      });
    } else {
      // Fallback service item - do NOT use invoice.notes as it's internal only
      allItems.push({
        type: 'service',
        description: 'Erbrachte Leistungen',
        quantity: 1,
        unit: 'Pauschal',
        unitPrice: parseFloat(invoice.amount || 0)
      });
    }
    
    // Add materials to the same array
    if (invoice.materials && Array.isArray(invoice.materials) && invoice.materials.length > 0) {
      invoice.materials.forEach(material => {
        allItems.push({
          type: 'material',
          description: material.name || 'Unbekanntes Material',
          quantity: parseFloat(material.quantity || 0),
          unit: material.unit || 'Stück',
          unitPrice: parseFloat(material.unit_price || 0)
        });
      });
    }
    
    // Render unified table with all items
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    const pageBottomMargin = PAGE_BOTTOM_MARGIN; // Reserve space for footer and subtotal
    
    allItems.forEach((item, index) => {
      const rowStartY = yPos - 3;
      
      // Calculate row height based on description with line-height ~1.3
      const descriptionLines = pdf.splitTextToSize(item.description, 75);
      const lineHeight = 5.2; // ~1.3 line-height for 9pt font
      const rowHeight = Math.max(descriptionLines.length * lineHeight + 3, 10);
      
      // Check if we need a new page (if row + subtotal won't fit)
      if (yPos + rowHeight + 20 > pageHeight - pageBottomMargin) {
        // Add subtotal at bottom of current page with gray background
        yPos += 5;
        pdf.setFillColor(245, 245, 245); // Light gray background
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPos, pageWidth - 2 * margin, 10);
        yPos += 7;
        pdf.setFont('helvetica', 'bold');
        pdf.text('Zwischensumme', margin + 5, yPos);
        pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos, { align: 'right' });
        
        // Add new page
        pdf.addPage();
        yPos = 40; // Start position on new page
        
        // Redraw table header on new page with proper column alignment
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Pos.', colPos, yPos);
        pdf.text('Bezeichnung', colDesc, yPos);
        pdf.text('Menge', colQty + 15, yPos, { align: 'right' });
        pdf.text('Einheit', colUnit, yPos);
        pdf.text('Einzel €', colPriceRight, yPos, { align: 'right' });
        pdf.text('Gesamt €', colTotal, yPos, { align: 'right' });
        yPos += 10;
        
        // Add "Übertrag" (carried forward) row with better styling
        pdf.setFillColor(250, 250, 250); // Very light gray
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 10, 'F');
        pdf.setDrawColor(180, 180, 180); // Medium gray border
        pdf.setLineWidth(0.3);
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 10);
        pdf.text('Übertrag', margin + 5, yPos + 2);
        pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos + 2, { align: 'right' });
        yPos += 12;
        
        pdf.setFont('helvetica', 'normal');
      }
      
      // Draw row border
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, rowHeight);
      
      // Position number
      pdf.text(String(itemNumber), colPos, yPos);
      
      // Description (multi-line with better formatting)
      pdf.text(descriptionLines, colDesc, yPos);
      
      // Quantity with German number formatting (right-aligned)
      pdf.text(item.quantity.toLocaleString('de-DE'), colQty + 15, yPos, { align: 'right' });
      
      // Unit
      pdf.text(String(item.unit), colUnit, yPos);
      
      // Unit price (right-aligned)
      pdf.text(formatGermanNumber(item.unitPrice), colPriceRight, yPos, { align: 'right' });
      
      // Total price (right-aligned at page margin)
      const itemTotal = item.quantity * item.unitPrice;
      runningSubtotal += itemTotal;
      pdf.text(formatGermanNumber(itemTotal), colTotal, yPos, { align: 'right' });
      
      // Move Y position for next item
      yPos += rowHeight;
      itemNumber++;
    });
    
    // Add final subtotal at end of items with gray background
    yPos += 5;
    pdf.setFillColor(245, 245, 245); // Light gray background
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 10);
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme', margin + 5, yPos);
    pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    yPos += 8;
    
    // ===== PROFESSIONAL BORDERED TOTALS SECTION =====
    yPos += 20;
    
    // Calculate totals
    const baseAmount = parseFloat(invoice.amount || 0);
    const materialsTotal = parseFloat(invoice.total_materials_price || 0);
    const subtotalNet = baseAmount + materialsTotal;
    const discountRate = parseFloat(invoice.discount_rate || 0);
    const discountAmount = subtotalNet * (discountRate / 100);
    const netAfterDiscount = subtotalNet - discountAmount;
    const taxAmount = parseFloat(invoice.tax_amount || 0);
    const totalAmount = parseFloat(invoice.total_amount || 0);
    
    // Professional totals section (no border)
    const totalsBoxX = 120;
    const totalsBoxY = yPos;
    const totalsBoxWidth = pageWidth - totalsBoxX - margin;
    const totalsBoxHeight = 50; // Increased height for better spacing
    
    // Totals content with professional formatting
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Subtotal (netto)
    pdf.text('Zwischensumme (netto)', totalsBoxX + 5, yPos);
    pdf.text(formatGermanNumber(subtotalNet) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    
    // Discount if applicable
    if (discountRate > 0) {
      yPos += 6;
      pdf.text(`abzgl. ${discountRate.toFixed(2)} % Rabatt`, totalsBoxX + 5, yPos);
      pdf.text(`-${formatGermanNumber(discountAmount)} €`, pageWidth - margin - 5, yPos, { align: 'right' });
      
      yPos += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Gesamt (netto)', totalsBoxX + 5, yPos);
      pdf.text(formatGermanNumber(netAfterDiscount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
    }
    
    // VAT
    yPos += 6;
    if (invoice.small_business_exempt) {
      pdf.text('Umsatzsteuer (§19 UStG befreit)', totalsBoxX + 5, yPos);
      pdf.text('0,00', pageWidth - margin - 5, yPos, { align: 'right' });
    } else if (invoice.reverse_charge) {
      pdf.text('Umsatzsteuer (Reverse Charge)', totalsBoxX + 5, yPos);
      pdf.text('0,00', pageWidth - margin - 5, yPos, { align: 'right' });
    } else {
      pdf.text('Umsatzsteuer 19 %', totalsBoxX + 5, yPos);
      pdf.text(formatGermanNumber(taxAmount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    }
    
    // Final total with emphasis
    yPos += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Gesamtbetrag', totalsBoxX + 5, yPos);
    pdf.text(formatGermanNumber(totalAmount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    
    yPos = totalsBoxY + totalsBoxHeight + 10;
    
    // ===== PARTIAL PAYMENT TRACKING SECTION =====
    if (invoice.partial_payments && Array.isArray(invoice.partial_payments) && invoice.partial_payments.length > 0) {
      yPos += 15;
      
      // Section header
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Abzüglich erhaltener Abschlagszahlungen', margin, yPos);
      yPos += 10;
      
      // Payment table headers
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('', margin + 5, yPos);
      pdf.text('Netto €', pageWidth - 80, yPos);
      pdf.text('USt €', pageWidth - 50, yPos);
      pdf.text('Brutto €', pageWidth - 20, yPos);
      yPos += 8;
      
      // Payment entries
      pdf.setFont('helvetica', 'normal');
      let totalPaymentsNet = 0;
      let totalPaymentsVat = 0;
      let totalPaymentsGross = 0;
      
      invoice.partial_payments.forEach((payment, index) => {
        const paymentNet = parseFloat(payment.net_amount || 0);
        const paymentVat = parseFloat(payment.vat_amount || 0);
        const paymentGross = parseFloat(payment.gross_amount || 0);
        
        totalPaymentsNet += paymentNet;
        totalPaymentsVat += paymentVat;
        totalPaymentsGross += paymentGross;
        
        const paymentLabel = `${index + 1}. Abschlagsrechnung ${payment.invoice_number || ''} vom ${formatGermanDate(payment.date)} (USt 19 %)`;
        pdf.text(paymentLabel, margin + 5, yPos);
        pdf.text(formatGermanNumber(paymentNet) + ' €', pageWidth - 80, yPos, { align: 'right' });
        pdf.text(formatGermanNumber(paymentVat) + ' €', pageWidth - 50, yPos, { align: 'right' });
        pdf.text(`-${formatGermanNumber(paymentGross)} €`, pageWidth - 20, yPos, { align: 'right' });
        yPos += 6;
      });
      
      // Outstanding balance calculation
      yPos += 5;
      const outstandingAmount = totalAmount - totalPaymentsGross;
      
      // Outstanding balance box
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.rect(pageWidth - 70, yPos - 3, 50, 12);
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Forderungsbetrag*', pageWidth - 65, yPos + 5);
      pdf.text(formatGermanNumber(outstandingAmount) + ' €', pageWidth - 25, yPos + 5, { align: 'right' });
      
      yPos += 20;
      
      // Outstanding balance explanation
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      const netOutstanding = outstandingAmount / 1.19; // Assuming 19% VAT
      const vatOutstanding = outstandingAmount - netOutstanding;
      pdf.text(`* Im Forderungsbetrag von ${formatGermanNumber(outstandingAmount)} € (Netto: ${formatGermanNumber(netOutstanding)} €) sind USt 19 % (${formatGermanNumber(vatOutstanding)} €)`, margin, yPos);
      pdf.text('enthalten.', margin, yPos + 4);
      yPos += 15;
    }
    
    // ===== PROFESSIONAL FOOTER WITH BUSINESS INFORMATION =====
    // Extract PDF settings with fallbacks to craftsman data
    const pdfSettings = craftsmanData.pdf_settings || {};
    
    // Company details - prioritize PDF settings
    const footerCompanyName = pdfSettings.company_name || craftsmanData.name || craftsmanName || '';
    const footerCompanyAddress = pdfSettings.company_address || craftsmanData.address || craftsmanAddress || '';
    const footerCompanyPhone = pdfSettings.company_phone || craftsmanData.phone || craftsmanData.contact_phone || '';
    const footerCompanyEmail = pdfSettings.company_email || craftsmanData.email || craftsmanData.contact_email || '';
    
    // Tax info - prioritize PDF settings
    const footerTaxId = pdfSettings.tax_id || invoice.tax_number || craftsmanData.tax_number || craftsmanData.tax_id || '';
    const footerVatId = pdfSettings.vat_id || invoice.vat_id || craftsmanData.vat_id || '';
    const footerOwnerName = pdfSettings.ceo_name || craftsmanData.owner_name || footerCompanyName;
    
    // Bank details - prioritize PDF settings
    const footerBankName = pdfSettings.bank_name || craftsmanData.bank_name || '';
    const footerIban = pdfSettings.iban || craftsmanData.iban || '';
    const footerBic = pdfSettings.bic || craftsmanData.bic || '';
    
    // Footer drawing function (called for each page)
    const footerY = pageHeight - FOOTER_START_Y_OFFSET;
    const middleX = 80;
    const rightX = 135;
    
    const drawFooter = () => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      // Left column - Company details
      let leftY = footerY;
      pdf.text(footerCompanyName, margin, leftY);
      leftY += 4;
      if (footerCompanyAddress && footerCompanyAddress.trim() !== '') {
        pdf.text(footerCompanyAddress, margin, leftY);
        leftY += 4;
      }
      if (footerCompanyPhone) {
        pdf.text(`Tel.: ${footerCompanyPhone}`, margin, leftY);
        leftY += 4;
      }
      if (footerCompanyEmail) {
        pdf.text(footerCompanyEmail, margin, leftY);
      }
      
      // Middle column - Tax and business manager info
      let middleY = footerY;
      if (footerTaxId) {
        pdf.text(`Steuernummer: ${footerTaxId}`, middleX, middleY);
        middleY += 4;
      }
      if (footerVatId) {
        pdf.text(`USt-IdNr.: ${footerVatId}`, middleX, middleY);
        middleY += 4;
      }
      if (footerOwnerName) {
        pdf.text(`Geschäftsführer: ${footerOwnerName}`, middleX, middleY);
      }
      
      // Right column - Banking info
      let rightY = footerY;
      if (footerBankName) {
        pdf.text(footerBankName, rightX, rightY);
        rightY += 4;
      }
      if (footerIban) {
        pdf.text(`IBAN: ${footerIban}`, rightX, rightY);
        rightY += 4;
      }
      if (footerBic) {
        pdf.text(`BIC: ${footerBic}`, rightX, rightY);
      }
    };
    
    // Draw footer and page numbers on all pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      drawFooter();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Seite ${i} von ${totalPages}`, pageWidth/2, footerY + 20, { align: 'center' });
    }
    
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
 * Generate a quote PDF in German format matching professional template
 * @param {Object} quote - The quote data
 * @param {Object} craftsmanData - The craftsman data
 * @returns {boolean} - Success indicator
 */
export const generateQuotePdf = (quote, craftsmanData = {}) => {
  try {
    console.log('Generating professional quote PDF with data:', { quote, craftsmanData });
    
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
    
    // Create a safe text wrapper that filters out ALL undefined/null text
    const originalText = pdf.text.bind(pdf);
    pdf.text = function(text, x, y, options) {
      // Convert to string for checking
      const textStr = text ? String(text) : '';
      
      // Log every text call for debugging
      if (textStr.toLowerCase().includes('undefined')) {
        console.error('🚨 FOUND UNDEFINED TEXT:', text, 'at position', x, y);
        return; // Block it
      }
      
      // Skip if text is undefined, null, or literally 'undefined'
      if (!text || 
          text === undefined || 
          text === null || 
          textStr === 'undefined' || 
          textStr === 'null' ||
          textStr.trim() === 'undefined' ||
          textStr.trim() === 'null' ||
          textStr === 'undefined undefined' ||
          textStr.includes('undefined')) {
        console.warn('BLOCKED text from PDF:', text, 'at position', x, y);
        return;
      }
      
      // Call original text function
      return originalText(text, x, y, options);
    };
    
    // Set up document constants
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const margin = 20;
    let yPos = 15; // Starting Y position
    
    // Extract craftsman details with better error handling
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || '';
    let craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    const craftsmanSubtitle = craftsmanData.business_type || 'Handwerksbetrieb';
    
    // Clean up undefined strings in craftsman data
    if (craftsmanAddress === 'undefined' || craftsmanAddress === 'null' || !craftsmanAddress) {
      craftsmanAddress = '';
    }
    
    // ===== LOGO/COMPANY NAME AT TOP LEFT =====
    const headerPdfSettings = craftsmanData.pdf_settings || {};
    const headerCompanyName = headerPdfSettings.company_name || craftsmanData.name || craftsmanName || '';
    const logoUrl = headerPdfSettings.logo_url || '';
    
    if (headerCompanyName || logoUrl) {
      // Square logo dimensions
      const logoSize = 30; // 30mm square
      const logoX = margin;
      const logoY = yPos;
      
      // Check if we have a custom logo uploaded
      if (logoUrl) {
        try {
          // Add the uploaded logo image
          pdf.addImage(logoUrl, 'PNG', logoX, logoY, logoSize, logoSize);
          yPos += logoSize + 5;
        } catch (error) {
          console.warn('Failed to load custom logo, using fallback:', error);
          // Fall back to yellow box if image loading fails
          drawDefaultLogo();
        }
      } else {
        // No custom logo - use default yellow box
        drawDefaultLogo();
      }
      
      function drawDefaultLogo() {
        // Draw logo background
        pdf.setFillColor(255, 203, 0); // Yellow/gold color
        pdf.rect(logoX, logoY, logoSize, logoSize, 'F');
        
        // Draw border
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.8);
        pdf.rect(logoX, logoY, logoSize, logoSize);
        
        // Prepare company name text (split into lines if needed)
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        const logoText = headerCompanyName.toUpperCase();
        const maxWidth = logoSize - 4; // Leave 2mm padding on each side
        const textLines = pdf.splitTextToSize(logoText, maxWidth);
        
        // Calculate vertical centering
        const lineHeight = 5;
        const totalTextHeight = textLines.length * lineHeight;
        const textStartY = logoY + (logoSize - totalTextHeight) / 2 + 4;
        
        // Draw centered text
        pdf.setTextColor(0, 0, 0); // Black text
        textLines.forEach((line, index) => {
          const lineWidth = pdf.getTextWidth(line);
          const textX = logoX + (logoSize - lineWidth) / 2; // Center horizontally
          pdf.text(line, textX, textStartY + (index * lineHeight));
        });
        
        // Reset text color
        pdf.setTextColor(0, 0, 0);
        yPos += logoSize + 5; // Add spacing after logo
      }
    }
    
    // ===== SENDER LINE (UNDERLINED - Small font per German standard) =====
    const headerCompanyAddress = headerPdfSettings.company_address || craftsmanData.address || craftsmanAddress || '';
    
    if (headerCompanyName && headerCompanyAddress) {
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      const senderLine = `${headerCompanyName}, ${headerCompanyAddress}`;
      pdf.text(senderLine, margin, yPos);
      
      // Underline the sender line
      const textWidth = pdf.getTextWidth(senderLine);
      pdf.setLineWidth(0.2);
      pdf.line(margin, yPos + 0.5, margin + textWidth, yPos + 0.5);
    }
    yPos += 8;
    
    // ===== RECEIVER BLOCK (Customer Address) =====
    // Debug customer data
    console.log('=== QUOTE CUSTOMER DATA DEBUG ===');
    console.log('Raw customer_name:', quote.customer_name);
    console.log('Raw customer_address:', quote.customer_address);
    console.log('Quote customer object:', quote.customer);
    console.log('Quote location:', quote.location);
    console.log('Full quote object keys:', Object.keys(quote));
    console.log('=================================');
    
    // Handle customer data more robustly - check both customer object and direct fields
    let customerName = quote.customer_name;
    let customerAddress = quote.customer_address;
    
    // If customer_name is undefined or contains "undefined", try to get from customer object
    if (!customerName || String(customerName).includes('undefined')) {
      if (quote.customer && quote.customer.name) {
        customerName = quote.customer.name;
        console.log('Using customer.name instead:', customerName);
      } else if (quote.customer && (quote.customer.first_name || quote.customer.last_name)) {
        customerName = [quote.customer.first_name, quote.customer.last_name].filter(Boolean).join(' ').trim();
        console.log('Using customer first/last name instead:', customerName);
      } else {
        // If no customer object, leave name empty - we'll only show address
        customerName = '';
        console.log('No customer name available, using empty string');
      }
    }
    
    // If customer_address is undefined, try to get from customer object or location
    if (!customerAddress || String(customerAddress).includes('undefined')) {
      if (quote.customer && quote.customer.address) {
        customerAddress = quote.customer.address;
        console.log('Using customer.address instead:', customerAddress);
      } else if (quote.location && quote.location.trim() !== '') {
        customerAddress = quote.location.trim();
        console.log('Using quote.location instead:', customerAddress);
      } else {
        customerAddress = '';
        console.log('No customer address available');
      }
    }
    
    // Clean up undefined strings and null values - be very strict
    if (!customerName || 
        customerName === 'undefined' || 
        customerName === 'null' || 
        customerName === undefined ||
        String(customerName).toLowerCase() === 'undefined' ||
        String(customerName).toLowerCase() === 'null') {
      customerName = '';
    }
    
    if (!customerAddress || 
        customerAddress === 'undefined' || 
        customerAddress === 'null' || 
        customerAddress === undefined ||
        String(customerAddress).toLowerCase() === 'undefined' ||
        String(customerAddress).toLowerCase() === 'null') {
      customerAddress = '';
    }
    
    // ===== CUSTOMER ADDRESS BLOCK (Receiver) - Properly formatted =====
    const hasValidCustomerData = (customerName && customerName.toString().trim() !== '') || 
                                  (customerAddress && customerAddress.toString().trim() !== '');
    
    if (hasValidCustomerData) {
      // Customer name in bold
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      
      if (customerName && customerName.toString().trim() !== '') {
        pdf.text(customerName, margin, yPos);
        yPos += 6;
      }
      
      // Address in normal font
      pdf.setFont('helvetica', 'normal');
      if (customerAddress && customerAddress.toString().trim() !== '') {
        // Split multi-line addresses
        const addressLines = customerAddress.split(/[\n,]/).filter(line => line.trim());
        addressLines.forEach(line => {
          pdf.text(line.trim(), margin, yPos);
          yPos += 5;
        });
      }
    }
    yPos += 20;
    
    // ===== DOCUMENT TITLE AND INFO TABLE (HEADER STYLE) =====
    yPos += 15;
    
    // Calculate table dimensions
    const titleTableY = yPos;
    const titleTableHeight = 12;
    const titleWidth = 100;
    const infoWidth = pageWidth - 2 * margin - titleWidth;
    
    // Draw gray background
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, titleTableY, pageWidth - 2 * margin, titleTableHeight, 'F');
    
    // Draw outer border for entire header table
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, titleTableY, pageWidth - 2 * margin, titleTableHeight);
    
    // Draw vertical line separating title from info
    pdf.line(margin + titleWidth, titleTableY, margin + titleWidth, titleTableY + titleTableHeight);
    
    // Document title on the left side
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Angebot', margin + 3, titleTableY + 8);
    
    // Info section on the right (3 columns)
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    const infoStartX = margin + titleWidth + 3;
    const infoColWidth = infoWidth / 3;
    
    // Format quote number
    const quoteNumber = quote.quote_number_formatted || 
                       (quote.quote_number ? `AN${String(quote.quote_number).padStart(4, '0')}` : 
                        `AN${String(quote.id).padStart(4, '0')}`);
    
    // Customer number
    const customerNumber = quote.customer_number || '10026';
    
    // Date
    const issueDate = quote.created_at;
    
    // Draw vertical lines between info columns
    pdf.line(infoStartX + infoColWidth - 3, titleTableY, infoStartX + infoColWidth - 3, titleTableY + titleTableHeight);
    pdf.line(infoStartX + 2 * infoColWidth - 3, titleTableY, infoStartX + 2 * infoColWidth - 3, titleTableY + titleTableHeight);
    
    // Column 1: Angebotsnr
    let infoY = titleTableY + 4;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Angebotsnr.:', infoStartX, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(quoteNumber, infoStartX, infoY + 4);
    
    // Column 2: Kundennr
    pdf.setFont('helvetica', 'bold');
    pdf.text('Kundennr.:', infoStartX + infoColWidth, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(String(customerNumber), infoStartX + infoColWidth, infoY + 4);
    
    // Column 3: Datum
    pdf.setFont('helvetica', 'bold');
    pdf.text('Datum:', infoStartX + 2 * infoColWidth, infoY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(formatGermanDate(issueDate) || '–', infoStartX + 2 * infoColWidth, infoY + 4);
    
    yPos = titleTableY + titleTableHeight + 5;
    
    // Professional description line
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const description = quote.description || 'Hiermit unterbreiten wir Ihnen folgendes Angebot.';
    pdf.text(description, margin, yPos);
    yPos += 18;
    
    // ===== PROFESSIONAL LINE ITEMS TABLE =====
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    
    // Table header with properly calculated column positions to avoid overlap
    const tableStartY = yPos;
    const colPos = margin + 2;           // Position: 22mm
    const colDesc = 32;                   // Description: 32mm
    const colQty = 105;                   // Quantity: 105mm
    const colUnit = 125;                  // Unit: 125mm
    const colPriceRight = 155;            // Unit Price (right-aligned): 155mm
    const colTotal = pageWidth - margin - 10;  // Total (right-aligned from margin): ~180mm
    
    // Draw header background with better height
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
    
    // Draw header border
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10);
    
    // Header text with improved spacing
    pdf.text('Pos.', colPos, yPos);
    pdf.text('Bezeichnung', colDesc, yPos);
    pdf.text('Menge', colQty + 15, yPos, { align: 'right' }); // Right-aligned for numeric column
    pdf.text('Einheit', colUnit, yPos);
    pdf.text('Einzel €', colPriceRight, yPos, { align: 'right' });
    pdf.text('Gesamt €', colTotal, yPos, { align: 'right' });
    
    yPos += 10;
    
    // Initialize item counter and subtotal tracking
    let itemNumber = 1;
    let runningSubtotal = 0;
    
    // Create unified items array combining line_items and materials
    const allItems = [];
    
    // Add line items first (filter out auto-generated placeholder lines)
    if (quote.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) {
      quote.line_items.forEach(item => {
        // Skip auto-generated appointment placeholder lines
        if (item.description && item.description.includes('Automatisch erstellt')) {
          console.log('Filtering out auto-generated line:', item.description);
          return;
        }
        allItems.push({
          type: 'service',
          description: item.description || '',
          quantity: parseFloat(item.quantity || 1),
          unit: item.unit || 'Stück',
          unitPrice: parseFloat(item.price || 0)
        });
      });
    } else {
      // Fallback service item - do NOT use quote.notes as it's internal only
      allItems.push({
        type: 'service',
        description: 'Angebotene Leistungen',
        quantity: 1,
        unit: 'Pauschal',
        unitPrice: parseFloat(quote.amount || 0)
      });
    }
    
    // Add materials to the same array
    if (quote.materials && Array.isArray(quote.materials) && quote.materials.length > 0) {
      quote.materials.forEach(material => {
        allItems.push({
          type: 'material',
          description: material.name || 'Unbekanntes Material',
          quantity: parseFloat(material.quantity || 0),
          unit: material.unit || 'Stück',
          unitPrice: parseFloat(material.unit_price || 0)
        });
      });
    }
    
    // Render unified table with all items
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    const pageBottomMargin = PAGE_BOTTOM_MARGIN; // Reserve space for footer and subtotal
    
    allItems.forEach((item, index) => {
      const rowStartY = yPos - 3;
      
      // Calculate row height based on description with line-height ~1.3
      const descriptionLines = pdf.splitTextToSize(item.description, 75);
      const lineHeight = 5.2; // ~1.3 line-height for 9pt font
      const rowHeight = Math.max(descriptionLines.length * lineHeight + 3, 10);
      
      // Check if we need a new page (if row + subtotal won't fit)
      if (yPos + rowHeight + 20 > pageHeight - pageBottomMargin) {
        // Add subtotal at bottom of current page
        yPos += 5;
        pdf.setFont('helvetica', 'bold');
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 8;
        pdf.text('Zwischensumme', margin + 5, yPos);
        pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos, { align: 'right' });
        
        // Add new page
        pdf.addPage();
        yPos = 40; // Start position on new page
        
        // Redraw table header on new page with proper column alignment
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10, 'F');
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.rect(margin, yPos - 5, pageWidth - 2 * margin, 10);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text('Pos.', colPos, yPos);
        pdf.text('Bezeichnung', colDesc, yPos);
        pdf.text('Menge', colQty + 15, yPos, { align: 'right' });
        pdf.text('Einheit', colUnit, yPos);
        pdf.text('Einzel €', colPriceRight, yPos, { align: 'right' });
        pdf.text('Gesamt €', colTotal, yPos, { align: 'right' });
        yPos += 10;
        
        // Add "Übertrag" (carried forward) row
        pdf.setFillColor(245, 245, 245);
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 10, 'F');
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.2);
        pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, 10);
        pdf.text('Übertrag', margin + 5, yPos + 2);
        pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos + 2, { align: 'right' });
        yPos += 12;
        
        pdf.setFont('helvetica', 'normal');
      }
      
      // Draw row border
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, yPos - 3, pageWidth - 2 * margin, rowHeight);
      
      // Position number
      pdf.text(String(itemNumber), colPos, yPos);
      
      // Description (multi-line with better formatting)
      pdf.text(descriptionLines, colDesc, yPos);
      
      // Quantity with German number formatting (right-aligned)
      pdf.text(item.quantity.toLocaleString('de-DE'), colQty + 15, yPos, { align: 'right' });
      
      // Unit
      pdf.text(String(item.unit), colUnit, yPos);
      
      // Unit price (right-aligned)
      pdf.text(formatGermanNumber(item.unitPrice), colPriceRight, yPos, { align: 'right' });
      
      // Total price (right-aligned at page margin)
      const itemTotal = item.quantity * item.unitPrice;
      runningSubtotal += itemTotal;
      pdf.text(formatGermanNumber(itemTotal), colTotal, yPos, { align: 'right' });
      
      // Move Y position for next item
      yPos += rowHeight;
      itemNumber++;
    });
    
    // Add final subtotal at end of items with gray background
    yPos += 5;
    pdf.setFillColor(245, 245, 245); // Light gray background
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 10, 'F');
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, yPos, pageWidth - 2 * margin, 10);
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme', margin + 5, yPos);
    pdf.text(formatGermanNumber(runningSubtotal), colTotal, yPos, { align: 'right' });
    pdf.setFont('helvetica', 'normal');
    yPos += 8;
    
    // ===== PROFESSIONAL BORDERED TOTALS SECTION =====
    yPos += 20;
    
    // Calculate totals
    const baseAmount = parseFloat(quote.amount || 0);
    const materialsTotal = parseFloat(quote.total_materials_price || 0);
    const subtotalNet = baseAmount + materialsTotal;
    const discountRate = parseFloat(quote.discount_rate || 0);
    const discountAmount = subtotalNet * (discountRate / 100);
    const netAfterDiscount = subtotalNet - discountAmount;
    const taxAmount = parseFloat(quote.tax_amount || 0);
    const totalAmount = parseFloat(quote.total_amount || 0);
    
    // Professional totals section (no border)
    const totalsBoxX = 120;
    const totalsBoxY = yPos;
    const totalsBoxWidth = pageWidth - totalsBoxX - margin;
    const totalsBoxHeight = 45; // Increased height for better spacing
    
    // Totals content with professional formatting
    yPos += 8;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Subtotal (netto)
    pdf.text('Zwischensumme (netto)', totalsBoxX + 5, yPos);
    pdf.text(formatGermanNumber(subtotalNet) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    
    // Discount if applicable
    if (discountRate > 0) {
      yPos += 6;
      pdf.text(`abzgl. ${discountRate.toFixed(2)} % Rabatt`, totalsBoxX + 5, yPos);
      pdf.text(`-${formatGermanNumber(discountAmount)} €`, pageWidth - margin - 5, yPos, { align: 'right' });
      
      yPos += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Gesamt (netto)', totalsBoxX + 5, yPos);
      pdf.text(formatGermanNumber(netAfterDiscount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
    }
    
    // VAT
    yPos += 6;
    pdf.text('Umsatzsteuer 19 %', totalsBoxX + 5, yPos);
    pdf.text(formatGermanNumber(taxAmount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    
    // Final total with emphasis
    yPos += 8;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Gesamtbetrag', totalsBoxX + 5, yPos);
    pdf.text(formatGermanNumber(totalAmount) + ' €', pageWidth - margin - 5, yPos, { align: 'right' });
    
    yPos = totalsBoxY + totalsBoxHeight + 15;
    
    // ===== PROFESSIONAL FOOTER WITH BUSINESS INFORMATION =====
    // Extract PDF settings with fallbacks to craftsman data
    const pdfSettings = craftsmanData.pdf_settings || {};
    
    // Company details - prioritize PDF settings
    const footerCompanyName = pdfSettings.company_name || craftsmanData.name || craftsmanName || '';
    const footerCompanyAddress = pdfSettings.company_address || craftsmanData.address || craftsmanAddress || '';
    const footerCompanyPhone = pdfSettings.company_phone || craftsmanData.phone || craftsmanData.contact_phone || '';
    const footerCompanyEmail = pdfSettings.company_email || craftsmanData.email || craftsmanData.contact_email || '';
    
    // Tax info - prioritize PDF settings
    const footerTaxId = pdfSettings.tax_id || quote.tax_number || craftsmanData.tax_number || craftsmanData.tax_id || '';
    const footerVatId = pdfSettings.vat_id || quote.vat_id || craftsmanData.vat_id || '';
    const footerOwnerName = pdfSettings.ceo_name || craftsmanData.owner_name || footerCompanyName;
    
    // Bank details - prioritize PDF settings
    const footerBankName = pdfSettings.bank_name || craftsmanData.bank_name || '';
    const footerIban = pdfSettings.iban || craftsmanData.iban || '';
    const footerBic = pdfSettings.bic || craftsmanData.bic || '';
    
    // Footer drawing function (called for each page)
    const footerY = pageHeight - FOOTER_START_Y_OFFSET;
    const middleX = 80;
    const rightX = 135;
    
    const drawFooter = () => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      
      // Left column - Company details
      let leftY = footerY;
      pdf.text(footerCompanyName, margin, leftY);
      leftY += 4;
      if (footerCompanyAddress && footerCompanyAddress.trim() !== '') {
        pdf.text(footerCompanyAddress, margin, leftY);
        leftY += 4;
      }
      if (footerCompanyPhone) {
        pdf.text(`Tel.: ${footerCompanyPhone}`, margin, leftY);
        leftY += 4;
      }
      if (footerCompanyEmail) {
        pdf.text(footerCompanyEmail, margin, leftY);
      }
      
      // Middle column - Tax and business manager info
      let middleY = footerY;
      if (footerTaxId) {
        pdf.text(`Steuernummer: ${footerTaxId}`, middleX, middleY);
        middleY += 4;
      }
      if (footerVatId) {
        pdf.text(`USt-IdNr.: ${footerVatId}`, middleX, middleY);
        middleY += 4;
      }
      if (footerOwnerName) {
        pdf.text(`Geschäftsführer: ${footerOwnerName}`, middleX, middleY);
      }
      
      // Right column - Banking info
      let rightY = footerY;
      if (footerBankName) {
        pdf.text(footerBankName, rightX, rightY);
        rightY += 4;
      }
      if (footerIban) {
        pdf.text(`IBAN: ${footerIban}`, rightX, rightY);
        rightY += 4;
      }
      if (footerBic) {
        pdf.text(`BIC: ${footerBic}`, rightX, rightY);
      }
    };
    
    // Draw footer and page numbers on all pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      drawFooter();
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Seite ${i} von ${totalPages}`, pageWidth/2, footerY + 20, { align: 'center' });
    }
    
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
