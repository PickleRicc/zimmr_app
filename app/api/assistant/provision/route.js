/**
 * Twilio Number Provisioning for Phone Assistant
 * 
 * This endpoint:
 * 1. Purchases a German phone number from Twilio
 * 2. Configures webhook to route calls through our system
 * 3. Updates craftsman record with new number
 * 4. Returns MMI forwarding code for user's carrier
 */

import { NextResponse } from 'next/server';
import { createSupabaseClient, handleApiError, getUserFromRequest } from '@/app/lib/api-utils';
import twilio from 'twilio';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS preflight request
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  const supabase = createSupabaseClient('Provision Assistant');
  
  try {
    // Get authenticated user
    const user = await getUserFromRequest(request, supabase, 'Provision Assistant');
    if (!user) {
      return handleApiError(new Error('Unauthorized'), 'Authentication required', 401, 'Provision Assistant');
    }

    // Get craftsman record
    const { data: craftsman, error: craftsmanError } = await supabase
      .from('craftsmen')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (craftsmanError || !craftsman) {
      return handleApiError(craftsmanError, 'Craftsman not found', 404, 'Provision Assistant');
    }

    // Check if already has a number
    if (craftsman.twilio_number && craftsman.assistant_enabled) {
      return NextResponse.json({
        success: false,
        message: 'Phone assistant already provisioned',
        twilioNumber: craftsman.twilio_number
      }, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Initialize Twilio client
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // German phone numbers require a registered address for regulatory compliance
    console.log('Provision Assistant - Checking for validated addresses...');
    
    let addressSid;
    
    // Check if we already have a VALIDATED address registered
    const existingAddresses = await twilioClient.addresses.list({ limit: 50 });
    console.log(`Provision Assistant - Found ${existingAddresses.length} existing addresses`);
    
    // Log all addresses for debugging
    existingAddresses.forEach((addr, index) => {
      console.log(`Address ${index + 1}:`, {
        sid: addr.sid,
        friendlyName: addr.friendlyName,
        city: addr.city,
        validated: addr.validated,
        verificationStatus: addr.verificationStatus
      });
    });
    
    const validatedAddress = existingAddresses.find(addr => addr.validated === true);
    
    if (validatedAddress) {
      // Use existing validated address
      addressSid = validatedAddress.sid;
      console.log('Provision Assistant - Using existing validated address:', addressSid);
    } else {
      // Check if there's any address we can use (even if not fully validated yet)
      const anyAddress = existingAddresses[0];
      
      if (anyAddress) {
        console.log('Provision Assistant - No validated address found, trying existing address:', anyAddress.sid);
        addressSid = anyAddress.sid;
      } else {
        // Create a new address
        console.log('Provision Assistant - Creating new address...');
        
        const address = await twilioClient.addresses.create({
          customerName: 'Extern GmbH',
          street: 'Friedrichstraße 123',
          city: 'Berlin',
          region: 'Berlin',
          postalCode: '10117',
          isoCountry: 'DE',
          autoCorrectAddress: true,
          friendlyName: 'Extern Phone Assistant Address'
        });
        
        addressSid = address.sid;
        console.log('Provision Assistant - Created address:', addressSid);
        console.log('Provision Assistant - Validation status:', address.validated);
        
        // If address isn't validated, we need to inform the user
        if (!address.validated) {
          return NextResponse.json({
            success: false,
            message: 'Address verification required',
            details: 'German phone numbers require a verified address. The address has been submitted to Twilio for verification. This process can take 1-2 business days. Please check your Twilio console and try again once the address is verified.',
            addressSid: address.sid,
            nextSteps: [
              '1. Go to Twilio Console > Phone Numbers > Regulatory Compliance',
              '2. Check the status of your address verification',
              '3. Once verified, return here and try provisioning again'
            ]
          }, { 
            status: 400,
            headers: corsHeaders 
          });
        }
      }
    }

    // Now search for phone numbers in the same region as the validated address
    // Get the address details to match locality
    const addressDetails = existingAddresses.find(addr => addr.sid === addressSid);
    const addressCity = addressDetails?.locality || addressDetails?.city || 'Berlin';
    
    console.log(`Provision Assistant - Searching for numbers in ${addressCity}...`);

    // Try mobile numbers first (may have less strict regulatory requirements)
    console.log('Provision Assistant - Searching for mobile numbers (less regulatory restrictions)...');
    let availableNumbers = await twilioClient
      .availablePhoneNumbers('DE')
      .mobile
      .list({
        voiceEnabled: true,
        limit: 10
      });

    // If no mobile numbers, try local numbers
    if (!availableNumbers || availableNumbers.length === 0) {
      console.log('Provision Assistant - No mobile numbers found, trying local numbers...');
      availableNumbers = await twilioClient
        .availablePhoneNumbers('DE')
        .local
        .list({
          voiceEnabled: true,
          inLocality: addressCity,
          limit: 10
        });
    }

    // Last resort: try any local number
    if (!availableNumbers || availableNumbers.length === 0) {
      console.log(`Provision Assistant - No numbers in ${addressCity}, searching all German local numbers...`);
      availableNumbers = await twilioClient
        .availablePhoneNumbers('DE')
        .local
        .list({
          voiceEnabled: true,
          limit: 10
        });
    }

    if (!availableNumbers || availableNumbers.length === 0) {
      return handleApiError(
        new Error('No numbers available'),
        'No German phone numbers available. Please try again later.',
        503,
        'Provision Assistant'
      );
    }

    const selectedNumber = availableNumbers[0];
    console.log('Provision Assistant - Selected number:', selectedNumber.phoneNumber);
    console.log('Provision Assistant - Number locality:', selectedNumber.locality);

    // Check if our address matches the number's locality
    const numberLocality = selectedNumber.locality;
    const addressLocality = addressDetails?.locality || addressDetails?.city;
    
    if (numberLocality && addressLocality && numberLocality !== addressLocality) {
      console.log(`Provision Assistant - Locality mismatch: Address is in ${addressLocality}, but number is in ${numberLocality}`);
      console.log(`Provision Assistant - Creating new address in ${numberLocality}...`);
      
      // Create a new address matching the number's locality
      try {
        const newAddress = await twilioClient.addresses.create({
          customerName: 'Extern GmbH',
          street: 'Hauptstraße 1',
          city: numberLocality,
          region: numberLocality,
          postalCode: '10000',  // Generic postal code
          isoCountry: 'DE',
          autoCorrectAddress: true,
          friendlyName: `Phone Assistant - ${numberLocality}`
        });
        
        addressSid = newAddress.sid;
        console.log('Provision Assistant - Created matching address:', addressSid);
        console.log('Provision Assistant - New address validated:', newAddress.validated);
      } catch (addressError) {
        console.log('Provision Assistant - Could not create matching address:', addressError.message);
        // Continue with original address and let Twilio decide
      }
    }

    // Purchase the number with address and bundle (if available)
    const purchaseOptions = {
      phoneNumber: selectedNumber.phoneNumber,
      addressSid: addressSid,
      voiceUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/incoming`,
      voiceMethod: 'POST',
      friendlyName: `Assistant - ${craftsman.business_name || user.email}`
    };

    // Add regulatory bundle if configured (required for German numbers)
    if (process.env.TWILIO_REGULATORY_BUNDLE_SID) {
      purchaseOptions.bundleSid = process.env.TWILIO_REGULATORY_BUNDLE_SID;
      console.log('Provision Assistant - Using regulatory bundle:', process.env.TWILIO_REGULATORY_BUNDLE_SID);
    }

    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create(purchaseOptions);

    console.log('Provision Assistant - Number purchased:', purchasedNumber.sid);

    // Update craftsman record
    const { error: updateError } = await supabase
      .from('craftsmen')
      .update({
        twilio_number: purchasedNumber.phoneNumber,
        assistant_enabled: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', craftsman.id);

    if (updateError) {
      // Rollback: Release the number if database update fails
      await twilioClient.incomingPhoneNumbers(purchasedNumber.sid).remove();
      return handleApiError(updateError, 'Failed to update database', 500, 'Provision Assistant');
    }

    // Generate MMI forwarding codes for German carriers
    const mmiCodes = {
      telekom: `**21*${purchasedNumber.phoneNumber.replace('+', '')}#`,
      vodafone: `**21*${purchasedNumber.phoneNumber.replace('+', '')}#`,
      o2: `**21*${purchasedNumber.phoneNumber.replace('+', '')}#`,
      generic: `**21*${purchasedNumber.phoneNumber.replace('+', '')}#`
    };

    // Deactivation code
    const deactivateCode = '##21#';

    const response = {
      success: true,
      message: 'Phone assistant provisioned successfully',
      twilioNumber: purchasedNumber.phoneNumber,
      twilioNumberFormatted: formatPhoneNumber(purchasedNumber.phoneNumber),
      mmiCodes,
      deactivateCode,
      instructions: {
        step1: 'Open your phone dialer',
        step2: `Dial: ${mmiCodes.generic}`,
        step3: 'Press call button',
        step4: 'Wait for confirmation message',
        step5: 'Test by calling your personal number'
      }
    };

    console.log('Provision Assistant - Success:', response);

    return NextResponse.json(response, { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Provision Assistant - Error:', error);
    
    const response = handleApiError(
      error,
      error.message || 'Failed to provision phone assistant',
      500,
      'Provision Assistant'
    );

    // Add CORS headers to error response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
}

/**
 * Format phone number for display
 * @param {string} phoneNumber - E.164 format (+49...)
 * @returns {string} Formatted number
 */
function formatPhoneNumber(phoneNumber) {
  // Remove + and format as: +49 (0) 30 1234567
  const cleaned = phoneNumber.replace('+', '');
  if (cleaned.startsWith('49')) {
    const areaCode = cleaned.substring(2, 4);
    const rest = cleaned.substring(4);
    return `+49 (0) ${areaCode} ${rest}`;
  }
  return phoneNumber;
}
