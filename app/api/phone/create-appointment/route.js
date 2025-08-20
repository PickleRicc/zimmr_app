import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create appointment from AI phone assistant
export async function POST(request) {
  try {
    const { appointmentData, craftsmanId, phoneNumber } = await request.json();
    
    // First, check if customer exists or create new one
    let customer = await findOrCreateCustomer(appointmentData);
    
    // Create the appointment
    const appointment = await createAppointment(appointmentData, customer.id, craftsmanId);
    
    // Send notification to craftsman for approval
    await notifyCraftsmanForApproval(appointment, craftsmanId);
    
    // Log the successful appointment creation
    await logPhoneAppointment({
      appointmentId: appointment.id,
      customerId: customer.id,
      craftsmanId,
      phoneNumber,
      status: 'pending_approval'
    });
    
    return NextResponse.json({
      success: true,
      appointmentId: appointment.id,
      customerId: customer.id,
      status: 'pending_approval',
      message: 'Appointment created successfully, waiting for craftsman approval'
    });
    
  } catch (error) {
    console.error('Appointment creation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create appointment'
    }, { status: 500 });
  }
}

async function findOrCreateCustomer(appointmentData) {
  try {
    // Try to find existing customer by phone number
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', appointmentData.phoneNumber)
      .single();
    
    if (existingCustomer) {
      // Update customer info if we have more details
      const { data: updatedCustomer } = await supabase
        .from('customers')
        .update({
          name: appointmentData.customerName || existingCustomer.name,
          address: appointmentData.address || existingCustomer.address,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingCustomer.id)
        .select()
        .single();
      
      return updatedCustomer;
    }
    
    // Create new customer
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert([
        {
          name: appointmentData.customerName,
          phone: appointmentData.phoneNumber,
          email: null, // Will be collected later if needed
          address: appointmentData.address,
          source: 'phone_ai_assistant',
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return newCustomer;
    
  } catch (error) {
    console.error('Customer creation error:', error);
    throw error;
  }
}

async function createAppointment(appointmentData, customerId, craftsmanId) {
  try {
    // Parse preferred date/time
    const appointmentDate = parsePreferredDateTime(appointmentData.preferredDate, appointmentData.preferredTime);
    
    const { data: appointment, error } = await supabase
      .from('appointments')
      .insert([
        {
          customer_id: customerId,
          craftsman_id: craftsmanId,
          title: `${appointmentData.serviceType} - ${appointmentData.customerName}`,
          description: appointmentData.description || `${appointmentData.serviceType} Anfrage via Telefon-KI`,
          service_type: appointmentData.serviceType,
          address: appointmentData.address,
          preferred_date: appointmentDate.date,
          preferred_time: appointmentDate.time,
          urgency: appointmentData.urgency || 'normal',
          status: 'pending_approval',
          source: 'phone_ai_assistant',
          phone_booking_data: JSON.stringify(appointmentData),
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) throw error;
    return appointment;
    
  } catch (error) {
    console.error('Appointment creation error:', error);
    throw error;
  }
}

async function notifyCraftsmanForApproval(appointment, craftsmanId) {
  try {
    // Get craftsman details
    const { data: craftsman } = await supabase
      .from('users')
      .select('name, phone, email, notification_preferences')
      .eq('id', craftsmanId)
      .single();
    
    if (!craftsman) return;
    
    // Create notification record
    await supabase
      .from('notifications')
      .insert([
        {
          user_id: craftsmanId,
          type: 'appointment_approval_required',
          title: 'Neuer Termin zur Bestätigung',
          message: `Neuer Termin von ${appointment.title} wartet auf Ihre Bestätigung.`,
          data: JSON.stringify({
            appointmentId: appointment.id,
            customerName: appointment.title,
            serviceType: appointment.service_type,
            urgency: appointment.urgency,
            preferredDate: appointment.preferred_date
          }),
          created_at: new Date().toISOString()
        }
      ]);
    
    // Send SMS notification if enabled
    if (craftsman.notification_preferences?.sms_enabled && craftsman.phone) {
      await sendSMSNotification(craftsman.phone, {
        type: 'appointment_approval',
        appointment
      });
    }
    
    // Send email notification if enabled
    if (craftsman.notification_preferences?.email_enabled && craftsman.email) {
      await sendEmailNotification(craftsman.email, {
        type: 'appointment_approval',
        appointment
      });
    }
    
  } catch (error) {
    console.error('Craftsman notification error:', error);
  }
}

async function sendSMSNotification(phoneNumber, data) {
  try {
    // Use Twilio to send SMS
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const message = `Neuer Termin wartet auf Bestätigung: ${data.appointment.title}. 
Dringlichkeit: ${data.appointment.urgency}. 
Bitte in der App bestätigen.`;
    
    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
  } catch (error) {
    console.error('SMS notification error:', error);
  }
}

async function sendEmailNotification(email, data) {
  // Email notification implementation would go here
  // Could use SendGrid, AWS SES, etc.
  console.log('Email notification would be sent to:', email);
}

async function logPhoneAppointment(logData) {
  try {
    await supabase
      .from('phone_appointment_logs')
      .insert([
        {
          ...logData,
          created_at: new Date().toISOString()
        }
      ]);
  } catch (error) {
    console.error('Phone appointment logging error:', error);
  }
}

function parsePreferredDateTime(dateStr, timeStr) {
  const today = new Date();
  let appointmentDate = new Date(today);
  
  // Parse date
  if (dateStr) {
    const lowerDate = dateStr.toLowerCase();
    if (lowerDate.includes('heute')) {
      // Keep today's date
    } else if (lowerDate.includes('morgen')) {
      appointmentDate.setDate(today.getDate() + 1);
    } else if (lowerDate.includes('montag')) {
      appointmentDate = getNextWeekday(1); // Monday
    } else if (lowerDate.includes('dienstag')) {
      appointmentDate = getNextWeekday(2); // Tuesday
    } else if (lowerDate.includes('mittwoch')) {
      appointmentDate = getNextWeekday(3); // Wednesday
    } else if (lowerDate.includes('donnerstag')) {
      appointmentDate = getNextWeekday(4); // Thursday
    } else if (lowerDate.includes('freitag')) {
      appointmentDate = getNextWeekday(5); // Friday
    }
  }
  
  // Parse time (default to 9:00 AM if not specified)
  let appointmentTime = '09:00';
  if (timeStr) {
    const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0');
      const minutes = timeMatch[2] || '00';
      appointmentTime = `${hours}:${minutes}`;
    }
  }
  
  return {
    date: appointmentDate.toISOString().split('T')[0],
    time: appointmentTime
  };
}

function getNextWeekday(targetDay) {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilTarget = (targetDay - currentDay + 7) % 7;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
  return targetDate;
}
