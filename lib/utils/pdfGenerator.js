import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Format currency values with thousand separators and Euro symbol
 * @param {number|string} value - The value to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (value) => {
  // Handle null, undefined, or NaN values
  if (value === null || value === undefined || value === '') {
    return '€ 0,00';
  }
  
  // Ensure we're working with a number
  const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : parseFloat(value);
  
  // Handle NaN after conversion
  if (isNaN(numValue)) {
    return '€ 0,00';
  }
  
  // Format with German locale (commas as decimal separators, periods as thousand separators)
  return `€ ${numValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Generate a PDF for an invoice using jsPDF and html2canvas
 * This function renders the invoice to a hidden div, captures it as an image,
 * and then creates a downloadable PDF
 * 
 * @param {Object} invoice - The invoice data
 * @param {Object} craftsmanData - Optional craftsman data
 * @returns {Promise<void>}
 */
export const generateInvoicePdf = async (invoice, craftsmanData = {}) => {
  try {
    // Create a temporary container for rendering the invoice
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '794px'; // A4 width in pixels at 96 DPI
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.padding = '40px';
    container.style.fontFamily = 'Arial, sans-serif';
    
    // Populate the container with invoice content
    container.innerHTML = `
      <div style="margin-bottom: 30px; text-align: center;">
        <h1 style="color: #132f4c; font-size: 24px; margin-bottom: 5px;">INVOICE</h1>
        <p style="color: #666; font-size: 14px; margin: 0;">Invoice #${invoice.invoice_number || invoice.id}</p>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
        <div>
          <h3 style="color: #132f4c; font-size: 16px; margin-bottom: 10px;">From:</h3>
          <p style="margin: 0; font-size: 14px;">${craftsmanData.name || 'ZIMMR Craftsman'}</p>
          <p style="margin: 0; font-size: 14px;">${craftsmanData.address || ''}</p>
          <p style="margin: 0; font-size: 14px;">${craftsmanData.email || ''}</p>
          <p style="margin: 0; font-size: 14px;">${craftsmanData.phone || ''}</p>
          ${craftsmanData.tax_id ? `<p style="margin: 0; font-size: 14px;">Tax ID: ${craftsmanData.tax_id}</p>` : ''}
        </div>
        
        <div>
          <h3 style="color: #132f4c; font-size: 16px; margin-bottom: 10px;">To:</h3>
          <p style="margin: 0; font-size: 14px;">${invoice.customer_name || 'Customer'}</p>
          <p style="margin: 0; font-size: 14px;">${invoice.customer_address || ''}</p>
          <p style="margin: 0; font-size: 14px;">${invoice.customer_email || ''}</p>
          <p style="margin: 0; font-size: 14px;">${invoice.customer_phone || ''}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #132f4c; font-size: 16px; margin-bottom: 10px;">Invoice Details:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Date</th>
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Due Date</th>
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Status</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.created_at).toLocaleDateString()}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}</td>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoice.status || 'Pending'}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-bottom: 30px;">
        <h3 style="color: #132f4c; font-size: 16px; margin-bottom: 10px;">Summary:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="background-color: #f2f2f2;">
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Description</th>
            <th style="text-align: right; padding: 10px; border: 1px solid #ddd;">Amount</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">${invoice.notes || 'Services rendered'}</td>
            <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">${formatCurrency(parseFloat(invoice.amount || 0))}</td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: bold;">Tax (19%):</td>
            <td style="text-align: right; padding: 10px; border: 1px solid #ddd;">${formatCurrency(parseFloat(invoice.tax_amount || 0))}</td>
          </tr>
          <tr>
            <td style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total:</td>
            <td style="text-align: right; padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrency(parseFloat(invoice.total_amount || 0))}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin-top: 50px; font-size: 14px; color: #666;">
        <p style="margin-bottom: 5px;"><strong>Payment Terms:</strong> Due within 16 days of receipt</p>
        <p style="margin-bottom: 5px;"><strong>Payment Method:</strong> Bank Transfer</p>
        <p style="margin-bottom: 5px;">Thank you for your business!</p>
      </div>
      
      <div style="margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px; font-size: 12px; color: #999; text-align: center;">
        <p>This invoice was generated by ZIMMR - Platform for Craftsmen in Germany</p>
      </div>
    `;
    
    // Add the container to the document body
    document.body.appendChild(container);
    
    // Use html2canvas to capture the invoice as an image
    const canvas = await html2canvas(container, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add the canvas image to the PDF
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    
    // Generate a filename
    const filename = `invoice_${invoice.invoice_number || invoice.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    // Clean up - remove the temporary container
    document.body.removeChild(container);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Generate a simple invoice PDF with minimal styling
 * This is a lighter alternative that doesn't require rendering to HTML first
 * 
 * @param {Object} invoice - The invoice data
 * @param {Object} craftsmanData - Optional craftsman data
 * @returns {Promise<void>}
 */
export const generateSimpleInvoicePdf = (invoice, craftsmanData = {}) => {
  try {
    // Create a new PDF document
    const pdf = new jsPDF();
    
    // Set font size and add title
    pdf.setFontSize(20);
    pdf.text('INVOICE', 105, 20, { align: 'center' });
    
    // Add invoice number
    pdf.setFontSize(12);
    pdf.text(`Invoice #${invoice.invoice_number || invoice.id}`, 105, 30, { align: 'center' });
    
    // Add craftsman details
    pdf.setFontSize(10);
    pdf.text('From:', 20, 50);
    pdf.text(`${craftsmanData.name || 'ZIMMR Craftsman'}`, 20, 55);
    if (craftsmanData.address) pdf.text(craftsmanData.address, 20, 60);
    if (craftsmanData.email) pdf.text(craftsmanData.email, 20, 65);
    if (craftsmanData.phone) pdf.text(craftsmanData.phone, 20, 70);
    
    // Add customer details
    pdf.text('To:', 120, 50);
    pdf.text(`${invoice.customer_name || 'Customer'}`, 120, 55);
    if (invoice.customer_address) pdf.text(invoice.customer_address, 120, 60);
    if (invoice.customer_email) pdf.text(invoice.customer_email, 120, 65);
    if (invoice.customer_phone) pdf.text(invoice.customer_phone, 120, 70);
    
    // Add invoice details
    pdf.text('Invoice Details:', 20, 90);
    pdf.text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 20, 95);
    pdf.text(`Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}`, 20, 100);
    pdf.text(`Status: ${invoice.status || 'Pending'}`, 20, 105);
    
    // Add summary
    pdf.text('Summary:', 20, 120);
    pdf.text(`Description: ${invoice.notes || 'Services rendered'}`, 20, 125);
    pdf.text(`Amount: ${formatCurrency(parseFloat(invoice.amount || 0))}`, 20, 130);
    pdf.text(`Tax (19%): ${formatCurrency(parseFloat(invoice.tax_amount || 0))}`, 20, 135);
    pdf.text(`Total: ${formatCurrency(parseFloat(invoice.total_amount || 0))}`, 20, 140);
    
    // Add payment terms
    pdf.text('Payment Terms: Due within 16 days of receipt', 20, 160);
    pdf.text('Payment Method: Bank Transfer', 20, 165);
    pdf.text('Thank you for your business!', 20, 170);
    
    // Add footer
    pdf.setFontSize(8);
    pdf.text('This invoice was generated by ZIMMR - Platform for Craftsmen in Germany', 105, 280, { align: 'center' });
    
    // Generate a filename
    const filename = `invoice_${invoice.invoice_number || invoice.id}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating simple PDF:', error);
    throw error;
  }
};

/**
 * Generate a German-style quote PDF following standard formats
 * This implements the format shown in the example German quotes
 * 
 * @param {Object} quote - The quote data
 * @param {Object} craftsmanData - Craftsman data
 * @returns {Promise<boolean>} Success indicator
 */
export const generateGermanQuotePdf = (quote, craftsmanData = {}) => {
  try {
    // Format dates in German style (DD.MM.YYYY)
    const formatGermanDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    };
    
    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add craftsman business information at top
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Business name and address top line
    const businessHeaderText = `${craftsmanData.name || 'ZIMMR Craftsman'}, ${craftsmanData.address || ''}`;
    pdf.text(businessHeaderText, 20, 20);
    
    // Recipient address block
    pdf.text('', 20, 30); // Space
    pdf.text(quote.customer_name || 'Customer', 20, 35);
    if (quote.customer_address) {
      const addressLines = quote.customer_address.split(',');
      let yPos = 40;
      addressLines.forEach(line => {
        pdf.text(line.trim(), 20, yPos);
        yPos += 5;
      });
    }
    
    // Title block with metadata
    pdf.setFillColor(240, 240, 240); // Light gray background for header
    pdf.rect(20, 60, 170, 10, 'F');
    
    // Bold "Angebot" title
    pdf.setFont('helvetica', 'bold');
    pdf.text('Angebot', 25, 67);
    
    // Quote information with clear columns - improved spacing
    pdf.setFont('helvetica', 'normal');
    pdf.text('Angebotsnr.:', 60, 67);
    
    // Format quote number if needed (ensure it starts with ANG instead of INV)
    let quoteNumber = String(quote.invoice_number || quote.id);
    if (quoteNumber.startsWith('INV-')) {
      quoteNumber = 'ANG-' + quoteNumber.substring(4);
    }
    pdf.text(quoteNumber, 90, 67);
    
    pdf.text('Kundennr.:', 120, 67);
    pdf.text(String(quote.customer_id || ''), 145, 67);
    
    // Draw the date on a second line to avoid cramping
    pdf.text('Datum:', 60, 75);
    pdf.text(formatGermanDate(quote.created_at), 90, 75);
    
    // Add validity date (Gültig bis) on the second line
    pdf.text('gültig bis:', 145, 75);
    
    // Calculate validity date if not provided (30 days from creation by default)
    const validUntilDate = new Date(quote.created_at);
    validUntilDate.setDate(validUntilDate.getDate() + 30);
    const validUntil = quote.valid_until ? formatGermanDate(quote.valid_until) : formatGermanDate(validUntilDate);
    
    // Add validity date (Gültig bis) on the second line
    pdf.text(validUntil, 170, 75);
    
    // Draw validity line
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, 82, 190, 82);
    
    // Add standard German greeting
    pdf.text('Sehr geehrte Damen & Herren,', 20, 85);
    pdf.text('Herzlichen Dank für Ihr Interesse. Wie besprochen, erlauben wir uns, Ihnen folgendes Angebot', 20, 95);
    pdf.text('zu unterbreiten.', 20, 100);
    
    // Add project reference if available
    if (quote.project_reference || quote.location) {
      pdf.text('BV:', 20, 110);
      pdf.text(quote.project_reference || quote.location || '', 35, 110);
    }
    
    // Draw table headers
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, 120, 170, 8, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pos.', 25, 126);
    pdf.text('Bezeichnung', 40, 126);
    pdf.text('Menge', 115, 126);
    pdf.text('Einheit', 135, 126);
    pdf.text('Einzel €', 155, 126);
    pdf.text('Gesamt €', 175, 126);
    
    // Parse and add line items
    let yPos = 134;
    let itemNumber = 1;
    
    // If we have line items, use them
    if (quote.line_items && Array.isArray(quote.line_items) && quote.line_items.length > 0) {
      quote.line_items.forEach(item => {
        // Position number
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(itemNumber), 25, yPos);
        
        // Description (handle multi-line)
        const description = item.description || '';
        const descriptionLines = pdf.splitTextToSize(description, 70);
        pdf.text(descriptionLines, 40, yPos);
        
        // Quantity, unit, price, total
        pdf.text(String(item.quantity || '1'), 115, yPos);
        pdf.text(String(item.unit || 'Stück'), 135, yPos);
        pdf.text(formatCurrency(item.price || 0).replace('€ ', ''), 155, yPos);
        
        const itemTotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 1)).toFixed(2);
        pdf.text(formatCurrency(parseFloat(itemTotal)), 175, yPos);
        
        // Move Y position based on description length
        yPos += Math.max(descriptionLines.length * 5, 8);
        itemNumber++;
      });
    } else {
      // Fallback to a single line item based on quote notes
      pdf.setFont('helvetica', 'normal');
      pdf.text('1', 25, yPos);
      
      const description = quote.notes || 'Dienstleistungen gemäß Angebot';
      const descriptionLines = pdf.splitTextToSize(description, 70);
      pdf.text(descriptionLines, 40, yPos);
      
      pdf.text('1', 115, yPos);
      pdf.text('Pauschal', 135, yPos);
      pdf.text(formatCurrency(parseFloat(quote.amount || 0)), 155, yPos);
      pdf.text(formatCurrency(parseFloat(quote.amount || 0)), 175, yPos);
      
      yPos += Math.max(descriptionLines.length * 5, 8);
    }
    
    // Draw subtotal line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(20, yPos + 3, 190, yPos + 3);
    
    // Add subtotal, VAT, and total
    yPos += 13;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme (netto)', 130, yPos);
    pdf.text(formatCurrency(parseFloat(quote.amount || 0)), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Umsatzsteuer 19 %', 130, yPos);
    pdf.text(formatCurrency(parseFloat(quote.tax_amount || 0)), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Gesamtbetrag', 130, yPos);
    pdf.text(formatCurrency(parseFloat(quote.total_amount || 0)), 175, yPos);
    
    // Add footer with business information
    const footerY = 270;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    // Log craftsman data to debug what's available
    console.log('Craftsman data for PDF:', craftsmanData);
    
    // Extract craftsman profile details with better fallbacks
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || craftsmanData.user?.name || 'ZIMMR Craftsman';
    const craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    const craftsmanPhone = craftsmanData.phone || craftsmanData.contact_phone || craftsmanData.user?.phone || '';
    const craftsmanEmail = craftsmanData.email || craftsmanData.contact_email || craftsmanData.user?.email || '';
    const taxId = craftsmanData.tax_id || craftsmanData.vat_number || craftsmanData.steuer_nr || '';
    const ownerName = craftsmanData.owner_name || craftsmanData.geschaeftsfuehrer || craftsmanName;
    const bankName = craftsmanData.bank_name || craftsmanData.bank || 'Bank';
    const iban = craftsmanData.iban || '';
    const bic = craftsmanData.bic || craftsmanData.swift || '';
    
    // Company details on left
    pdf.text(craftsmanName, 20, footerY);
    pdf.text(craftsmanAddress, 20, footerY + 4);
    pdf.text(`Tel.: ${craftsmanPhone}`, 20, footerY + 8);
    pdf.text(craftsmanEmail, 20, footerY + 12);
    
    // Tax and registration info in middle
    pdf.text(`Steuernummer: ${taxId}`, 80, footerY);
    pdf.text(`Geschäftsführer: ${ownerName}`, 80, footerY + 4);
    
    // Banking info on right
    pdf.text(bankName, 140, footerY);
    pdf.text(`IBAN: ${iban}`, 140, footerY + 4);
    pdf.text(`BIC: ${bic}`, 140, footerY + 8);
    
    // Page number at bottom
    pdf.text('Seite 1/1', 100, footerY + 16);
    
    // Generate a filename using the formatted quote number
    const filename = `angebot_${quoteNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating German quote PDF:', error);
    throw error;
  }
};

/**
 * Generate a German-style invoice PDF following standard formats
 * Similar to the German quote format but with invoice-specific terminology
 * 
 * @param {Object} invoice - The invoice data
 * @param {Object} craftsmanData - Craftsman data
 * @returns {Promise<boolean>} Success indicator
 */
export const generateGermanInvoicePdf = (invoice, craftsmanData = {}) => {
  try {
    // Format dates in German style (DD.MM.YYYY)
    const formatGermanDate = (dateString) => {
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
    };
    
    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add craftsman business information at top
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    
    // Business name and address top line
    const businessHeaderText = `${craftsmanData.name || 'ZIMMR Craftsman'}, ${craftsmanData.address || ''}`;
    pdf.text(businessHeaderText, 20, 20);
    
    // Recipient address block
    pdf.text('', 20, 30); // Space
    pdf.text(invoice.customer_name || 'Customer', 20, 35);
    if (invoice.customer_address) {
      const addressLines = invoice.customer_address.split(',');
      let yPos = 40;
      addressLines.forEach(line => {
        pdf.text(line.trim(), 20, yPos);
        yPos += 5;
      });
    }
    
    // Title block with metadata
    pdf.setFillColor(240, 240, 240); // Light gray background for header
    pdf.rect(20, 60, 170, 10, 'F');
    
    // Bold "Rechnung" title (German for Invoice)
    pdf.setFont('helvetica', 'bold');
    pdf.text('Rechnung', 25, 67);
    
    // Invoice information with clear columns - improved spacing
    pdf.setFont('helvetica', 'normal');
    pdf.text('Rechnungsnr.:', 60, 67);
    
    // Ensure invoice number format
    let invoiceNumber = String(invoice.invoice_number || invoice.id);
    if (invoiceNumber.startsWith('ANG-')) {
      invoiceNumber = 'INV-' + invoiceNumber.substring(4);
    }
    pdf.text(invoiceNumber, 90, 67);
    
    pdf.text('Kundennr.:', 120, 67);
    pdf.text(String(invoice.customer_id || ''), 145, 67);
    
    // Draw date and due date on a second line
    pdf.text('Datum:', 60, 75);
    pdf.text(formatGermanDate(invoice.created_at), 90, 75);
    
    // Add due date (specific to invoices)
    pdf.text('Fällig bis:', 145, 75);
    
    // Calculate due date if not provided (14 days is standard in Germany)
    const dueDateString = invoice.due_date || (() => {
      const dueDate = new Date(invoice.created_at);
      dueDate.setDate(dueDate.getDate() + 14);
      return dueDate.toISOString();
    })();
    pdf.text(formatGermanDate(dueDateString), 170, 75);
    
    // Draw line under header
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, 82, 190, 82);
    
    // Add standard German greeting
    pdf.text('Sehr geehrte Damen & Herren,', 20, 85);
    pdf.text('vielen Dank für Ihren Auftrag. Hiermit stellen wir Ihnen folgende Leistungen in Rechnung:', 20, 95);
    
    // Add project reference if available
    if (invoice.project_reference || invoice.location) {
      pdf.text('BV:', 20, 110);
      pdf.text(invoice.project_reference || invoice.location || '', 35, 110);
    }
    
    // Draw table headers
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, 120, 170, 8, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Pos.', 25, 126);
    pdf.text('Bezeichnung', 40, 126);
    pdf.text('Menge', 115, 126);
    pdf.text('Einheit', 135, 126);
    pdf.text('Einzel €', 155, 126);
    pdf.text('Gesamt €', 175, 126);
    
    // Parse and add line items
    let yPos = 134;
    let itemNumber = 1;
    
    // If we have line items, use them
    if (invoice.line_items && Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
      invoice.line_items.forEach(item => {
        // Position number
        pdf.setFont('helvetica', 'normal');
        pdf.text(String(itemNumber), 25, yPos);
        
        // Description (handle multi-line)
        const description = item.description || '';
        const descriptionLines = pdf.splitTextToSize(description, 70);
        pdf.text(descriptionLines, 40, yPos);
        
        // Quantity, unit, price, total
        pdf.text(String(item.quantity || '1'), 115, yPos);
        pdf.text(String(item.unit || 'Stück'), 135, yPos);
        pdf.text(formatCurrency(item.price || 0).replace('€ ', ''), 155, yPos);
        
        const itemTotal = (parseFloat(item.price || 0) * parseFloat(item.quantity || 1)).toFixed(2);
        pdf.text(formatCurrency(parseFloat(itemTotal)), 175, yPos);
        
        // Move Y position based on description length
        yPos += Math.max(descriptionLines.length * 5, 8);
        itemNumber++;
      });
    } else {
      // Fallback to a single line item based on invoice notes
      pdf.setFont('helvetica', 'normal');
      pdf.text('1', 25, yPos);
      
      const description = invoice.notes || 'Erbrachte Leistungen';
      const descriptionLines = pdf.splitTextToSize(description, 70);
      pdf.text(descriptionLines, 40, yPos);
      
      pdf.text('1', 115, yPos);
      pdf.text('Pauschal', 135, yPos);
      pdf.text(formatCurrency(parseFloat(invoice.amount || 0)), 155, yPos);
      pdf.text(formatCurrency(parseFloat(invoice.amount || 0)), 175, yPos);
      
      yPos += Math.max(descriptionLines.length * 5, 8);
    }
    
    // Draw subtotal line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(20, yPos + 3, 190, yPos + 3);
    
    // Add subtotal, VAT, and total
    yPos += 13;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Zwischensumme (netto)', 130, yPos);
    pdf.text(formatCurrency(parseFloat(invoice.amount || 0)), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Umsatzsteuer 19 %', 130, yPos);
    pdf.text(formatCurrency(parseFloat(invoice.tax_amount || 0)), 175, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Gesamtbetrag', 130, yPos);
    pdf.text(formatCurrency(parseFloat(invoice.total_amount || 0)), 175, yPos);
    
    // Add invoice-specific payment instructions
    yPos += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.text('Bitte überweisen Sie den Rechnungsbetrag unter Angabe der Rechnungsnummer bis zum', 20, yPos);
    pdf.text(formatGermanDate(dueDateString) + '.', 20, yPos + 5);
    pdf.text('Bei Zahlung nach diesem Datum behalten wir uns vor, Verzugszinsen zu berechnen.', 20, yPos + 10);
    
    // Add footer with business information
    const footerY = 260; // Move up to make room for payment instructions
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    
    // Log craftsman data to debug what's available
    console.log('Craftsman data for Invoice PDF:', craftsmanData);
    
    // Extract craftsman profile details with better fallbacks
    const craftsmanName = craftsmanData.name || craftsmanData.business_name || craftsmanData.user?.name || 'ZIMMR Craftsman';
    const craftsmanAddress = craftsmanData.address || craftsmanData.business_address || '';
    const craftsmanPhone = craftsmanData.phone || craftsmanData.contact_phone || craftsmanData.user?.phone || '';
    const craftsmanEmail = craftsmanData.email || craftsmanData.contact_email || craftsmanData.user?.email || '';
    const taxId = craftsmanData.tax_id || craftsmanData.vat_number || craftsmanData.steuer_nr || '';
    const ownerName = craftsmanData.owner_name || craftsmanData.geschaeftsfuehrer || craftsmanName;
    const bankName = craftsmanData.bank_name || craftsmanData.bank || 'Bank';
    const iban = craftsmanData.iban || '';
    const bic = craftsmanData.bic || craftsmanData.swift || '';
    
    // Company details on left
    pdf.text(craftsmanName, 20, footerY);
    pdf.text(craftsmanAddress, 20, footerY + 4);
    pdf.text(`Tel.: ${craftsmanPhone}`, 20, footerY + 8);
    pdf.text(craftsmanEmail, 20, footerY + 12);
    
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
    const filename = `rechnung_${invoiceNumber}_${new Date().toISOString().split('T')[0]}.pdf`;
    
    // Download the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating German invoice PDF:', error);
    throw error;
  }
};

export default {
  generateInvoicePdf,
  generateSimpleInvoicePdf,
  generateGermanQuotePdf,
  generateGermanInvoicePdf
};
