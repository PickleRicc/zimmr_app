import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Approve appointment and send SMS confirmation to customer
export async function POST(request) {
  try {
    const { appointmentId, craftsmanId, approved, scheduledDate, scheduledTime, notes } = await request.json();
    
    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          name,
          phone,
          email
        )
      `)
      .eq('id', appointmentId)
      .eq('craftsman_id', craftsmanId)
      .single();
    
    if (appointmentError || !appointment) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }
    
    if (approved) {
      // Approve and schedule the appointment
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          scheduled_date: scheduledDate || appointment.preferred_date,
          scheduled_time: scheduledTime || appointment.preferred_time,
          craftsman_notes: notes,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();
      
      if (updateError) {
        return NextResponse.json({ error: 'Failed to approve appointment' }, { status: 500 });
      }
      
      // Send SMS confirmation to customer
      await sendCustomerConfirmationSMS(appointment.customers, updatedAppointment);
      
      // Log the approval
      await logAppointmentApproval(appointmentId, craftsmanId, 'approved', notes);
      
      return NextResponse.json({
        success: true,
        message: 'Appointment approved and customer notified',
        appointment: updatedAppointment
      });
      
    } else {
      // Reject the appointment
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          craftsman_notes: notes,
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();
      
      if (updateError) {
        return NextResponse.json({ error: 'Failed to reject appointment' }, { status: 500 });
      }
      
      // Send SMS rejection to customer
      await sendCustomerRejectionSMS(appointment.customers, updatedAppointment, notes);
      
      // Log the rejection
      await logAppointmentApproval(appointmentId, craftsmanId, 'rejected', notes);
      
      return NextResponse.json({
        success: true,
        message: 'Appointment rejected and customer notified',
        appointment: updatedAppointment
      });
    }
    
  } catch (error) {
    console.error('Appointment approval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function sendCustomerConfirmationSMS(customer, appointment) {
  try {
    if (!customer.phone) {
      console.log('No phone number available for customer');
      return;
    }
    
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const appointmentDate = new Date(appointment.scheduled_date).toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const message = `✅ Ihr Termin wurde bestätigt!

📅 Datum: ${appointmentDate}
🕐 Zeit: ${appointment.scheduled_time}
🔧 Service: ${appointment.service_type}
📍 Adresse: ${appointment.address}

${appointment.craftsman_notes ? `💬 Hinweis: ${appointment.craftsman_notes}` : ''}

Bei Fragen erreichen Sie uns unter dieser Nummer.`;
    
    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: customer.phone
    });
    
    console.log(`Confirmation SMS sent to ${customer.phone}`);
    
  } catch (error) {
    console.error('SMS confirmation error:', error);
  }
}

async function sendCustomerRejectionSMS(customer, appointment, reason) {
  try {
    if (!customer.phone) {
      console.log('No phone number available for customer');
      return;
    }
    
    const twilio = require('twilio')(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    const message = `❌ Leider können wir Ihren Termin nicht wie gewünscht durchführen.

🔧 Service: ${appointment.service_type}
📅 Gewünschter Termin: ${new Date(appointment.preferred_date).toLocaleDateString('de-DE')}

${reason ? `💬 Grund: ${reason}` : ''}

Bitte rufen Sie uns an, um einen alternativen Termin zu vereinbaren.`;
    
    await twilio.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: customer.phone
    });
    
    console.log(`Rejection SMS sent to ${customer.phone}`);
    
  } catch (error) {
    console.error('SMS rejection error:', error);
  }
}

async function logAppointmentApproval(appointmentId, craftsmanId, action, notes) {
  try {
    await supabase
      .from('appointment_approval_logs')
      .insert([
        {
          appointment_id: appointmentId,
          craftsman_id: craftsmanId,
          action,
          notes,
          created_at: new Date().toISOString()
        }
      ]);
  } catch (error) {
    console.error('Approval logging error:', error);
  }
}
