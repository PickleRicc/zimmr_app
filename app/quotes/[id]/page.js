'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { generateQuotePdf } from '../../../lib/utils/pdfGenerator';
import MaterialSelector from '../../../components/MaterialSelector';

// Format date for input fields (YYYY-MM-DD)
const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
};

// Format appointment date for display
const formatAppointmentDate = (dateString) => {
  if (!dateString) return 'Kein Datum';
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Format date for display
const formatDate = (dateString) => {
  if (!dateString) return 'Kein Datum';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Return original if parsing fails
    
    // Format: DD.MM.YYYY HH:MM (German format)
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Fehler beim Formatieren des Datums:', error);
    return dateString; // Return original if any error occurs
  }
};

export default function QuoteDetailPage({ params }) {
  
  const [formData, setFormData] = useState({
    craftsman_id: '',
    customer_id: '',
    amount: '',
    tax_amount: '',
    total_amount: '',
    notes: '',
    due_date: '',
    service_date: '',
    location: '',
    vat_exempt: false,
    type: 'quote',
    appointment_id: '',
    materials: [], // Array to store selected materials
    total_materials_price: '0.00' // Total price of materials
  });
  
  const [editMode, setEditMode] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [createdQuote, setCreatedQuote] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth();
  const fetcher = useAuthedFetch();
  const quoteId = params?.id;

  useEffect(() => {
    if (authLoading || !user || !quoteId) return;

    const init = async () => {
      try {
        // Fetch the quote details
        await fetchQuote();

        // Fetch customers & appointments in parallel
        await Promise.all([fetchCustomers(), fetchAppointments()]);
      } catch (err) {
        console.error('Error initializing quote detail page:', err);
        setError('Fehler beim Laden der Angebotsdetails. Bitte versuchen Sie es später erneut.');
        setLoading(false);
      }
    };

    init();
  }, [authLoading, user, quoteId]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const response = await fetcher(`/api/quotes/${quoteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch quote details');
      }
      const quoteData = await response.json();
      
      // Format dates for input fields
      const formattedQuote = {
        ...quoteData,
        due_date: formatDateForInput(quoteData.due_date),
        service_date: formatDateForInput(quoteData.service_date),
        materials: quoteData.materials || [],
        total_materials_price: calculateMaterialsTotal(quoteData.materials || [])
      };
      
      setFormData(formattedQuote);
      setCreatedQuote(formattedQuote);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching quote:', err);
      setError('Fehler beim Laden des Angebots');
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await fetcher('/api/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      } else {
        throw new Error('Failed to fetch customers');
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const response = await fetcher('/api/appointments');
      if (response.ok) {
        const data = await response.json();
        setAppointments(data);
        setLoadingAppointments(false);
      } else {
        throw new Error('Failed to fetch appointments');
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setLoadingAppointments(false);
    }
  };

  // Calculate total price of materials
  const calculateMaterialsTotal = (materials = []) => {
    return materials.reduce((total, material) => {
      const price = parseFloat(material.unit_price) || 0;
      const quantity = parseFloat(material.quantity) || 0;
      return total + (price * quantity);
    }, 0).toFixed(2);
  };
  
  const handleCheckboxChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
  };

  const handleVatExemptChange = (e) => {
    const isExempt = e.target.checked;
    setFormData(prev => {
      const amount = parseFloat(prev.amount) || 0;
      const taxAmount = isExempt ? 0 : (amount * 0.19).toFixed(2);
      const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

      // Calculate total with materials
      const materialsTotal = parseFloat(prev.total_materials_price) || 0;
      const grandTotal = (parseFloat(totalAmount) + materialsTotal).toFixed(2);

      return {
        ...prev,
        vat_exempt: isExempt,
        tax_amount: taxAmount,
        total_amount: grandTotal
      };
    });
  };

  const handleAmountChange = (e) => {
    const amount = parseFloat(e.target.value) || 0;
    setFormData(prev => {
      const taxAmount = prev.vat_exempt ? 0 : (amount * 0.19).toFixed(2);
      const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

      // Calculate total with materials
      const materialsTotal = parseFloat(prev.total_materials_price) || 0;
      const grandTotal = (parseFloat(totalAmount) + materialsTotal).toFixed(2);

      return {
        ...prev,
        amount: e.target.value,
        tax_amount: taxAmount,
        total_amount: grandTotal
      };
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChange = (e) => {
    // Special case handlers
    if (e.target.name === 'amount') {
      return handleAmountChange(e);
    }
    
    if (e.target.type === 'checkbox') {
      return handleCheckboxChange(e);
    }
    
    // Default handler
    return handleInputChange(e);
  };
  
  // Handle materials selection changes
  const handleMaterialsChange = (materials) => {
    const materialsTotal = calculateMaterialsTotal(materials);
    
    setFormData(prev => {
      const serviceTotal = parseFloat(prev.amount) || 0;
      const taxAmount = prev.vat_exempt ? 0 : (serviceTotal * 0.19).toFixed(2);
      const subtotal = (serviceTotal + parseFloat(taxAmount)).toFixed(2);
      const totalAmount = (parseFloat(subtotal) + parseFloat(materialsTotal)).toFixed(2);
      
      return {
        ...prev,
        materials: materials,
        total_materials_price: materialsTotal,
        total_amount: totalAmount
      };
    });
  };

  const handleAppointmentChange = (e) => {
    const appointmentId = e.target.value;
    setFormData(prev => ({ ...prev, appointment_id: appointmentId }));

    if (appointmentId) {
      const selectedAppointment = appointments.find(a => a.id.toString() === appointmentId.toString());
      if (selectedAppointment) {
        setSelectedAppointment(selectedAppointment);

        // Auto-fill fields from appointment
        const amount = parseFloat(formData.amount) || 0;
        const taxAmount = formData.vat_exempt ? 0 : (amount * 0.19).toFixed(2);
        const totalAmount = (amount + parseFloat(taxAmount)).toFixed(2);

        setFormData(prev => ({
          ...prev,
          customer_id: selectedAppointment.customer_id?.toString() || prev.customer_id,
          service_date: selectedAppointment.start_time ? new Date(selectedAppointment.start_time).toISOString().split('T')[0] : prev.service_date,
          location: selectedAppointment.location || prev.location,
          tax_amount: taxAmount,
          total_amount: totalAmount
        }));
      }
    } else {
      setSelectedAppointment(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      setError(null);

      // Prepare the payload
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount).toFixed(2),
        tax_amount: parseFloat(formData.tax_amount).toFixed(2),
        total_amount: parseFloat(formData.total_amount).toFixed(2),
        total_materials_price: parseFloat(formData.total_materials_price).toFixed(2)
      };

      // Update the quote
      const response = await fetcher(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update quote');
      }

      const updatedQuote = await response.json();
      setCreatedQuote(updatedQuote);
      setSuccess(true);
      setEditMode(false);
      
      // Refresh the quote data
      await fetchQuote();
      
    } catch (err) {
      console.error('Error updating quote:', err);
      setError(err.message || 'Fehler beim Aktualisieren des Angebots');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePdf = async () => {
    try {
      setPdfLoading(true);
      
      // Get craftsman data if needed for the PDF
      let craftsmanData = {};
      try {
        const response = await fetcher('/api/craftsman/profile');
        if (response.ok) {
          craftsmanData = await response.json();
        }
      } catch (err) {
        console.warn('Could not fetch craftsman profile for PDF:', err);
        // Continue anyway with empty craftsman data
      }
      
      // Generate PDF with the quote data
      await generateQuotePdf(formData, craftsmanData);
      
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Fehler beim Generieren des PDFs. ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleEditToggle = () => {
    setEditMode(!editMode);
  };

  const handleConvertToInvoice = async () => {
    try {
      setSubmitting(true);
      
      const response = await fetcher(`/api/quotes/${quoteId}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to convert to invoice');
      }

      const invoice = await response.json();
      router.push(`/invoices/${invoice.id}`);
      
    } catch (err) {
      console.error('Error converting to invoice:', err);
      setError(err.message || 'Fehler beim Umwandeln in eine Rechnung');
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-4 border-[#ffcb00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="flex-1 bg-gradient-to-b from-[#132f4c] to-[#0d253f]">
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white">Angebotsdetails</h1>
            <div className="flex space-x-3">
              <Link href="/quotes" className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white">
                Zurück zur Übersicht
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-xl text-white">
              {error}
            </div>
          )}

          {loading ? (
            <div className="bg-[#1e3a5f]/50 rounded-xl p-8 mb-8 flex items-center justify-center">
              <div className="h-8 w-8 border-4 border-[#ffcb00] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-[#1e3a5f]/50 rounded-xl p-8 mb-8">
              {success && !editMode && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-xl text-white">
                  Angebot erfolgreich aktualisiert!
                </div>
              )}

              {/* Action buttons row */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={handleEditToggle}
                  className={`px-4 py-2 ${editMode ? 'bg-gray-600' : 'bg-blue-600'} hover:bg-blue-700 rounded-lg text-white`}
                >
                  {editMode ? 'Bearbeitung abbrechen' : 'Angebot bearbeiten'}
                </button>
                
                <button
                  onClick={handleGeneratePdf}
                  disabled={pdfLoading}
                  className={`px-4 py-2 ${pdfLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} rounded-lg text-white flex items-center`}
                >
                  {pdfLoading ? (
                    <>
                      <span className="mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      PDF wird erstellt...
                    </>
                  ) : 'PDF erstellen'}
                </button>
                
                <button
                  onClick={handleConvertToInvoice}
                  disabled={submitting}
                  className={`px-4 py-2 ${submitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800]'} text-black font-semibold rounded-lg`}
                >
                  {submitting ? (
                    <>
                      <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                      Wird konvertiert...
                    </>
                  ) : 'In Rechnung umwandeln'}
                </button>
              </div>

              {/* Quote details form */}
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer selection */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Kunde
                    </label>
                    <select
                      name="customer_id"
                      value={formData.customer_id || ''}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      required
                      disabled={!editMode}
                    >
                      <option value="">Bitte wählen Sie einen Kunden</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name || 'Unbenannter Kunde'} {customer.email ? `(${customer.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Appointment selection */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Zugehöriger Termin (optional)
                    </label>
                    <select
                      name="appointment_id"
                      value={formData.appointment_id || ''}
                      onChange={handleAppointmentChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={loadingAppointments || !editMode}
                    >
                      <option value="">Keinen Termin auswählen</option>
                      {appointments.map(appointment => (
                        <option key={appointment.id} value={appointment.id}>
                          {formatAppointmentDate(appointment.start_time)} - {appointment.title || 'Kein Titel'}
                        </option>
                      ))}
                    </select>
                    {loadingAppointments && (
                      <p className="text-xs text-gray-400 mt-1 flex items-center">
                        <span className="mr-2 h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                        Termine werden geladen...
                      </p>
                    )}
                  </div>
                  
                  {/* Location */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Standort
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location || ''}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* Service Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Leistungsdatum
                    </label>
                    <input
                      type="date"
                      name="service_date"
                      value={formData.service_date || ''}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* VAT Exempt checkbox */}
                  <div>
                    <div className="flex items-center mt-4">
                      <input
                        type="checkbox"
                        name="vat_exempt"
                        id="vat_exempt"
                        checked={formData.vat_exempt}
                        onChange={handleVatExemptChange}
                        className="h-4 w-4 rounded border-white/10 focus:ring-[#ffcb00] bg-[#1e3a5f] text-[#ffcb00]"
                        disabled={!editMode}
                      />
                      <label htmlFor="vat_exempt" className="ml-2 text-sm">
                        Umsatzsteuerbefreit (§19 UStG)
                      </label>
                    </div>
                  </div>
                  
                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Betrag (netto) €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleAmountChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        disabled={!editMode}
                      />
                    </div>
                  </div>
                  
                  {/* Tax Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mehrwertsteuer €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="tax_amount"
                        value={formData.tax_amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        readOnly
                        disabled={true}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet (19%)
                    </p>
                  </div>
                  
                  {/* Total Amount */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Gesamtbetrag €
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                      <input
                        type="number"
                        name="total_amount"
                        value={formData.total_amount}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        required
                        readOnly
                        disabled={true}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Automatisch berechnet aus Betrag + Steuer + Materialien
                    </p>
                  </div>
                  
                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Gültig bis
                    </label>
                    <input
                      type="date"
                      name="due_date"
                      value={formData.due_date}
                      onChange={handleChange}
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={!editMode}
                    />
                  </div>
                  
                  {/* Notes */}
                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium mb-1">
                      Notizen
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows="4"
                      className="w-full bg-[#1e3a5f] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                      disabled={!editMode}
                    ></textarea>
                  </div>
                </div>
                
                {/* Materials Section */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <h3 className="text-xl font-bold mb-4">Materialien</h3>
                  
                  {editMode ? (
                    <MaterialSelector 
                      selectedMaterials={formData.materials}
                      onChange={handleMaterialsChange}
                    />
                  ) : (
                    <div className="bg-[#1e3a5f] border border-white/10 rounded-xl p-4">
                      {formData.materials && formData.materials.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-sm text-gray-400">
                              <th className="pb-2">Name</th>
                              <th className="pb-2">Menge</th>
                              <th className="pb-2">Einheit</th>
                              <th className="pb-2">Preis (€)</th>
                              <th className="pb-2">Gesamt (€)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData.materials.map((material, index) => {
                              const total = (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
                              return (
                                <tr key={index} className="border-t border-white/5">
                                  <td className="py-3">{material.name}</td>
                                  <td className="py-3">{material.quantity}</td>
                                  <td className="py-3">{material.unit}</td>
                                  <td className="py-3">€{parseFloat(material.unit_price).toFixed(2)}</td>
                                  <td className="py-3">€{total.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                            <tr className="border-t border-white/10">
                              <td colSpan="4" className="py-3 text-right font-bold">Materialien Gesamt:</td>
                              <td className="py-3 font-bold">€{parseFloat(formData.total_materials_price).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-400">Keine Materialien ausgewählt</p>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Submit Button - only show when in edit mode */}
                {editMode && (
                  <div className="mt-8 pt-6 border-t border-white/10 flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting || !formData.customer_id || !formData.amount}
                      className={`px-6 py-2.5 ${submitting ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#ffcb00] hover:bg-[#e6b800]'} text-black font-semibold rounded-xl transition-colors flex items-center justify-center disabled:opacity-60`}
                      style={{ minWidth: '150px' }}
                    >
                      {submitting ? (
                        <>
                          <span className="mr-2 h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                          Wird gespeichert...
                        </>
                      ) : 'Angebot aktualisieren'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </main>
      </div>
      <Footer />
    </>
  );
}
