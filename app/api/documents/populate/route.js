import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/documents/populate - Create documents from existing quotes and invoices
export async function POST(request) {
  try {
    const { craftsman_id } = await request.json();
    
    if (!craftsman_id) {
      return NextResponse.json({ error: 'Craftsman ID is required' }, { status: 400 });
    }

    const createdDocuments = [];

    // Fetch existing quotes for this craftsman
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('craftsman_id', craftsman_id);

    if (quotesError) {
      console.error('Error fetching quotes:', quotesError);
    } else if (quotes && quotes.length > 0) {
      // Create documents for each quote
      for (const quote of quotes) {
        const quoteDoc = {
          craftsman_id,
          customer_id: quote.customer_id,
          appointment_id: quote.appointment_id,
          quote_id: quote.id,
          title: `Kostenvoranschlag #${quote.id}`,
          description: `Kostenvoranschlag über €${parseFloat(quote.total_amount || quote.amount || 0).toFixed(2)}`,
          folder_type: 'quotes',
          document_type: 'quote',
          content_data: {
            amount: quote.amount,
            total_amount: quote.total_amount,
            tax_amount: quote.tax_amount,
            materials: quote.materials,
            notes: quote.notes,
            status: quote.status,
            service_date: quote.service_date,
            location: quote.location
          },
          tags: ['kostenvoranschlag', 'automatisch_erstellt'],
          notes: quote.notes
        };

        const { data: createdQuoteDoc, error: quoteDocError } = await supabase
          .from('documents')
          .insert(quoteDoc)
          .select()
          .single();

        if (quoteDocError) {
          console.error('Error creating quote document:', quoteDocError);
        } else {
          createdDocuments.push(createdQuoteDoc);
        }
      }
    }

    // Fetch existing invoices for this craftsman
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('*')
      .eq('craftsman_id', craftsman_id);

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
    } else if (invoices && invoices.length > 0) {
      // Create documents for each invoice
      for (const invoice of invoices) {
        const invoiceDoc = {
          craftsman_id,
          customer_id: invoice.customer_id,
          appointment_id: invoice.appointment_id,
          invoice_id: invoice.id,
          title: invoice.invoice_number_formatted || `Rechnung #${invoice.id}`,
          description: `Rechnung über €${parseFloat(invoice.total_amount || 0).toFixed(2)} - Status: ${invoice.status}`,
          folder_type: 'invoices',
          document_type: 'invoice',
          content_data: {
            amount: invoice.amount,
            total_amount: invoice.total_amount,
            tax_amount: invoice.tax_amount,
            materials: invoice.materials,
            notes: invoice.notes,
            status: invoice.status,
            due_date: invoice.due_date,
            service_date: invoice.service_date,
            location: invoice.location,
            invoice_number: invoice.invoice_number_formatted,
            payment_terms_days: invoice.payment_terms_days,
            vat_exempt: invoice.vat_exempt
          },
          tags: ['rechnung', 'automatisch_erstellt', invoice.status],
          notes: invoice.notes
        };

        const { data: createdInvoiceDoc, error: invoiceDocError } = await supabase
          .from('documents')
          .insert(invoiceDoc)
          .select()
          .single();

        if (invoiceDocError) {
          console.error('Error creating invoice document:', invoiceDocError);
        } else {
          createdDocuments.push(createdInvoiceDoc);
        }
      }
    }

    return NextResponse.json({ 
      data: createdDocuments,
      message: `Successfully created ${createdDocuments.length} documents from existing quotes and invoices`,
      status: 'success'
    });

  } catch (error) {
    console.error('Error in documents populate API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
