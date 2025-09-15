// API route for managing notes associated with the logged-in craftsman
// GET    /api/notes                  – list all notes with filters
// POST   /api/notes                  – create new note

import { NextResponse } from 'next/server';
import { 
  createSupabaseClient, 
  getUserFromRequest, 
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

// Create a standardized Supabase client for this route
const ROUTE_NAME = 'Notes API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function GET(req) {
  try {
    console.log(`${ROUTE_NAME} - Processing GET request`);
    
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) {
      return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);
    }
    
    console.log(`${ROUTE_NAME} - User authenticated:`, user.id);
    
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';
    const customerId = searchParams.get('customer_id');
    const appointmentId = searchParams.get('appointment_id');
    const noAppointment = searchParams.get('no_appointment') === 'true';
    
    console.log(`${ROUTE_NAME} - Request parameters:`, { 
      page, 
      limit, 
      search, 
      customerId, 
      appointmentId,
      noAppointment 
    });
    
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    if (!craftsmanId) {
      return NextResponse.json({ error: 'Craftsman profile not found' }, { status: 404 });
    }
    
    console.log(`${ROUTE_NAME} - Using craftsman ID:`, craftsmanId);
    
    // Build query
    let query = supabase
      .from('notes')
      .select(`
        *,
        customers!inner(id, name),
        appointments(id, scheduled_at, status, notes)
      `)
      .eq('craftsman_id', craftsmanId);
    
    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    
    if (appointmentId) {
      query = query.eq('appointment_id', appointmentId);
    }
    
    if (noAppointment) {
      query = query.is('appointment_id', null);
    }
    
    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('craftsman_id', craftsmanId);

    if (countError) {
      return handleApiError(countError, 'Failed to get notes count', 500, ROUTE_NAME);
    }

    // Execute query with pagination and ordering
    const { data: notes, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) {
      return handleApiError(error, 'Failed to fetch notes', 500, ROUTE_NAME);
    }
    
    const totalPages = Math.ceil(totalCount / limit);
    
    console.log(`${ROUTE_NAME} - Successfully fetched ${notes ? notes.length : 0} notes (page ${page}/${totalPages})`);
    return handleApiSuccess({
      notes: notes || [],
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }, 'Notes retrieved successfully');
    
  } catch (error) {
    return handleApiError(error, 'Server error', 500, ROUTE_NAME);
  }
}

export async function POST(req) {
  try {
    console.log(`${ROUTE_NAME} - Processing POST request`);
    
    const user = await getUserFromRequest(req, supabase, ROUTE_NAME);
    if (!user) return handleApiError({ message: 'Unauthorized' }, 'Unauthorized', 401, ROUTE_NAME);

    const body = await req.json();
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);

    if (!craftsmanId) {
      return handleApiError(
        { message: 'Craftsman profile not found' }, 
        'Craftsman profile not found', 
        404, 
        ROUTE_NAME
      );
    }

    // Validate required fields
    if (!body.title || !body.content || !body.customer_id) {
      return handleApiError(
        { message: 'Title, content, and customer_id are required' }, 
        'Missing required fields', 
        400, 
        ROUTE_NAME
      );
    }

    // Verify customer belongs to this craftsman
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', body.customer_id)
      .eq('craftsman_id', craftsmanId)
      .single();

    if (customerError || !customer) {
      return handleApiError(
        { message: 'Customer not found or not authorized' },
        'Invalid customer',
        400,
        ROUTE_NAME
      );
    }

    // If appointment_id is provided, verify it belongs to this craftsman and customer
    if (body.appointment_id) {
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select('id')
        .eq('id', body.appointment_id)
        .eq('craftsman_id', craftsmanId)
        .eq('customer_id', body.customer_id)
        .single();

      if (appointmentError || !appointment) {
        return handleApiError(
          { message: 'Appointment not found or not authorized' },
          'Invalid appointment',
          400,
          ROUTE_NAME
        );
      }
    }

    const { data: note, error } = await supabase
      .from('notes')
      .insert({
        craftsman_id: craftsmanId,
        customer_id: body.customer_id || null,
        appointment_id: body.appointment_id || null,
        title: body.title,
        content: body.content,
        tags: body.tags || [],
        is_private: body.is_private || false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create corresponding entry in documents registry
    const { error: docError } = await supabase
      .from('documents')
      .insert({
        craftsman_id: craftsmanId,
        customer_id: body.customer_id || null,
        appointment_id: body.appointment_id || null,
        note_id: note.id,
        title: note.title,
        description: note.content.length > 150 ? note.content.substring(0, 150) + '...' : note.content,
        folder_type: 'notes',
        document_type: 'note',
        tags: note.tags || [],
        status: 'active'
      });

    if (docError) {
      console.error('Error creating document registry entry:', docError);
      // Don't fail the request, just log the error
    }

    console.log(`${ROUTE_NAME} - Successfully created note:`, note.id);
    return handleApiSuccess(note, 'Note created successfully', 201);
  } catch (err) {
    return handleApiError(err, 'Server error', 500, ROUTE_NAME);
  }
}
