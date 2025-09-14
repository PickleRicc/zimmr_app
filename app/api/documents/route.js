import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/documents - List documents with filtering
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const craftsmanId = searchParams.get('craftsman_id');
    const folderType = searchParams.get('folder_type');
    const documentType = searchParams.get('document_type');
    const customerId = searchParams.get('customer_id');
    const search = searchParams.get('search');
    
    if (!craftsmanId) {
      return NextResponse.json({ error: 'Craftsman ID is required' }, { status: 400 });
    }

    let query = supabase
      .from('documents')
      .select(`
        *,
        customers(name, email),
        appointments(id, scheduled_at, notes, location),
        quotes(id, amount),
        invoices(id, invoice_number_formatted, total_amount)
      `)
      .eq('craftsman_id', craftsmanId)
      .eq('status', 'active')
      .eq('is_latest_version', true)
      .order('created_at', { ascending: false });

    // Apply filters
    if (folderType) {
      query = query.eq('folder_type', folderType);
    }
    
    if (documentType) {
      query = query.eq('document_type', documentType);
    }
    
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching documents:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Apply search filter on the client side for title, description, and tags
    let filteredData = data;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = data.filter(doc => 
        doc.title?.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    return NextResponse.json({ data: filteredData });
  } catch (error) {
    console.error('Error in documents API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/documents - Create new document
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      craftsman_id,
      customer_id,
      appointment_id,
      quote_id,
      invoice_id,
      title,
      description,
      tags,
      folder_type,
      document_type,
      content_data,
      notes
    } = body;

    if (!craftsman_id || !title || !folder_type || !document_type) {
      return NextResponse.json({ 
        error: 'Craftsman ID, title, folder type, and document type are required' 
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('documents')
      .insert({
        craftsman_id,
        customer_id,
        appointment_id,
        quote_id,
        invoice_id,
        title,
        description,
        tags,
        folder_type,
        document_type,
        content_data,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating document:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in documents POST API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
