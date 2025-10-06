import { NextResponse } from 'next/server';
import {
  createSupabaseClient,
  getUserFromRequest,
  getOrCreateCraftsmanId,
  handleApiError,
  handleApiSuccess
} from '../../../lib/api-utils';

const ROUTE_NAME = 'Logo Upload API';
const supabase = createSupabaseClient(ROUTE_NAME);

export async function POST(request) {
  console.log('=== LOGO UPLOAD STARTED ===');
  try {
    // Authenticate request using shared utility
    const user = await getUserFromRequest(request, supabase, ROUTE_NAME);
    
    if (!user) {
      console.error('No user found - authentication failed');
      return handleApiError('Nicht authentifiziert', 401, ROUTE_NAME);
    }

    console.log('Authenticated user ID:', user.id);

    // Get craftsman ID using shared utility
    const craftsmanId = await getOrCreateCraftsmanId(user, supabase, ROUTE_NAME);
    
    if (!craftsmanId) {
      console.error('Craftsman not found for user:', user.id);
      return handleApiError('Handwerkerprofil nicht gefunden', 404, ROUTE_NAME);
    }

    console.log('Craftsman ID:', craftsmanId);

    const formData = await request.formData();
    const file = formData.get('logo');
    console.log('File received:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'NO FILE');

    if (!file) {
      console.error('No file in form data');
      return NextResponse.json(
        { error: 'Keine Datei hochgeladen' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Nur PNG und JPG Dateien sind erlaubt' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Datei darf maximal 5MB groß sein' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    console.log('Buffer created:', buffer.length, 'bytes');

    // Create unique filename
    const fileExt = file.name.split('.').pop();
    const fileName = `${craftsmanId}_${Date.now()}.${fileExt}`;
    const filePath = `logos/${fileName}`;
    console.log('Upload path:', filePath);

    // Check if bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    console.log('Available buckets:', buckets?.map(b => b.name));

    // Upload to Supabase Storage
    console.log('Attempting upload to company-assets bucket...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('company-assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true
      });

    console.log('Upload result:', { uploadData, uploadError });

    if (uploadError) {
      console.error('Upload error details:', uploadError);
      return NextResponse.json(
        { error: `Fehler beim Hochladen: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('company-assets')
      .getPublicUrl(filePath);

    // Update craftsman's pdf_settings
    const { data: currentSettings } = await supabase
      .from('craftsmen')
      .select('pdf_settings')
      .eq('id', craftsmanId)
      .single();

    console.log('Current PDF settings before logo update:', currentSettings?.pdf_settings);

    const updatedSettings = {
      ...(currentSettings?.pdf_settings || {}),
      logo_url: publicUrl
    };

    console.log('Updated PDF settings with logo:', updatedSettings);

    const { error: updateError } = await supabase
      .from('craftsmen')
      .update({ pdf_settings: updatedSettings })
      .eq('id', craftsmanId);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Fehler beim Speichern' },
        { status: 500 }
      );
    }

    console.log('=== LOGO UPLOAD SUCCESS ===');
    console.log('Logo URL:', publicUrl);
    
    return NextResponse.json({
      success: true,
      logo_url: publicUrl
    });

  } catch (error) {
    console.error('=== LOGO UPLOAD FAILED ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { error: `Interner Serverfehler: ${error.message}` },
      { status: 500 }
    );
  }
}
