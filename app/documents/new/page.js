'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import {
  UsersIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  ArrowUpTrayIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';

const FOLDER_TYPES = [
  { key: 'clients', label: 'Kunden', icon: 'UsersIcon' },
  { key: 'quotes', label: 'Kostenvoranschläge', icon: 'ClipboardDocumentListIcon' },
  { key: 'invoices', label: 'Rechnungen', icon: 'DocumentTextIcon' },
  { key: 'notes', label: 'Notizen', icon: 'PencilSquareIcon' },
  { key: 'comms', label: 'Kommunikation', icon: 'ChatBubbleLeftRightIcon' }
];

const DOCUMENT_TYPES = [
  { key: 'quote', label: 'Kostenvoranschlag' },
  { key: 'invoice', label: 'Rechnung' },
  { key: 'note', label: 'Notiz' },
  { key: 'communication', label: 'Kommunikation' },
  { key: 'client_info', label: 'Kundeninfo' }
];

export default function NewDocumentPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    folder_type: 'notes',
    document_type: 'note',
    customer_id: '',
    appointment_id: '',
    quote_id: '',
    invoice_id: '',
    tags: [],
    notes: '',
    content_data: {}
  });
  
  const [tagInput, setTagInput] = useState('');
  
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!authLoading && user) {
      loadRelatedData();
      
      // Handle URL parameters for pre-selecting customer
      const urlParams = new URLSearchParams(window.location.search);
      const customerId = urlParams.get('customer_id');
      if (customerId) {
        setFormData(prev => ({
          ...prev,
          customer_id: customerId
        }));
      }
    }
  }, [authLoading, user]);

  const loadRelatedData = async () => {
    try {
      setDataLoading(true);
      
      // Load customers, appointments, quotes, and invoices for linking
      const [customersRes, appointmentsRes, quotesRes, invoicesRes] = await Promise.all([
        fetcher('/api/customers'),
        fetcher('/api/appointments'),
        fetcher('/api/quotes'),
        fetcher('/api/invoices')
      ]);

      if (customersRes.ok) {
        const customersData = await customersRes.json();
        const data = customersData.data || customersData;
        // Handle new paginated format
        if (data && data.customers && Array.isArray(data.customers)) {
          setCustomers(data.customers);
        } else if (Array.isArray(data)) {
          // Fallback for old format
          setCustomers(data);
        } else {
          setCustomers([]);
        }
      } else {
        setCustomers([]);
      }

      if (appointmentsRes.ok) {
        const appointmentsData = await appointmentsRes.json();
        const apptData = appointmentsData.data || appointmentsData;
        setAppointments(Array.isArray(apptData) ? apptData : []);
      } else {
        setAppointments([]);
      }

      if (quotesRes.ok) {
        const quotesData = await quotesRes.json();
        const quoteData = quotesData.data || quotesData;
        setQuotes(Array.isArray(quoteData) ? quoteData : []);
      } else {
        setQuotes([]);
      }

      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json();
        const invoiceData = invoicesData.data || invoicesData;
        setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      } else {
        setInvoices([]);
      }
    } catch (err) {
      console.error('Error loading related data:', err);
      // Ensure arrays are set even on error
      setCustomers([]);
      setAppointments([]);
      setQuotes([]);
      setInvoices([]);
    } finally {
      setDataLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Update folder_type when document_type changes for better UX
    if (name === 'document_type') {
      let suggestedFolder = 'notes'; // default
      switch (value) {
        case 'quote':
          suggestedFolder = 'quotes';
          break;
        case 'invoice':
          suggestedFolder = 'invoices';
          break;
        case 'communication':
          suggestedFolder = 'comms';
          break;
        case 'client_info':
          suggestedFolder = 'clients';
          break;
        default:
          suggestedFolder = 'notes';
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        folder_type: suggestedFolder
      }));
    }
  };

  const getIconComponent = (iconName) => {
    const icons = {
      UsersIcon,
      ClipboardDocumentListIcon,
      DocumentTextIcon,
      ArrowUpTrayIcon,
      PencilSquareIcon,
      ChatBubbleLeftRightIcon
    };
    return icons[iconName] || PencilSquareIcon;
  };

  const getDocumentSpecificFields = () => {
    switch (formData.document_type) {
      case 'communication':
        return (
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">Kommunikationsdetails</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Kommunikationstyp
                </label>
                <select
                  name="content_data.communication_type"
                  value={formData.content_data?.communication_type || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    content_data: {
                      ...prev.content_data,
                      communication_type: e.target.value
                    }
                  }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                >
                  <option value="" className="bg-[#121212]">Typ auswählen</option>
                  <option value="email" className="bg-[#121212]">E-Mail</option>
                  <option value="phone" className="bg-[#121212]">Telefon</option>
                  <option value="meeting" className="bg-[#121212]">Besprechung</option>
                  <option value="letter" className="bg-[#121212]">Brief</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Datum/Zeit
                </label>
                <input
                  type="datetime-local"
                  name="content_data.communication_date"
                  value={formData.content_data?.communication_date || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    content_data: {
                      ...prev.content_data,
                      communication_date: e.target.value
                    }
                  }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                />
              </div>
            </div>
          </div>
        );
        
      case 'client_info':
        return (
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">Kundeninformationen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Dokumenttyp
                </label>
                <select
                  name="content_data.client_doc_type"
                  value={formData.content_data?.client_doc_type || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    content_data: {
                      ...prev.content_data,
                      client_doc_type: e.target.value
                    }
                  }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                >
                  <option value="" className="bg-[#121212]">Typ auswählen</option>
                  <option value="contract" className="bg-[#121212]">Vertrag</option>
                  <option value="agreement" className="bg-[#121212]">Vereinbarung</option>
                  <option value="profile" className="bg-[#121212]">Kundenprofil</option>
                  <option value="notes" className="bg-[#121212]">Kundennotizen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Status
                </label>
                <select
                  name="content_data.status"
                  value={formData.content_data?.status || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    content_data: {
                      ...prev.content_data,
                      status: e.target.value
                    }
                  }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                >
                  <option value="" className="bg-[#121212]">Status auswählen</option>
                  <option value="active" className="bg-[#121212]">Aktiv</option>
                  <option value="pending" className="bg-[#121212]">Ausstehend</option>
                  <option value="completed" className="bg-[#121212]">Abgeschlossen</option>
                </select>
              </div>
            </div>
          </div>
        );
        
      case 'note':
        return (
          <div className="space-y-4 p-4 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">Notizdetails</h3>
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Priorität
              </label>
              <select
                name="content_data.priority"
                value={formData.content_data?.priority || 'normal'}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  content_data: {
                    ...prev.content_data,
                    priority: e.target.value
                  }
                }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
              >
                <option value="low" className="bg-[#121212]">Niedrig</option>
                <option value="normal" className="bg-[#121212]">Normal</option>
                <option value="high" className="bg-[#121212]">Hoch</option>
                <option value="urgent" className="bg-[#121212]">Dringend</option>
              </select>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Titel ist erforderlich');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get craftsman data to get the proper craftsman_id
      const craftsmanRes = await fetcher('/api/craftsmen');
      if (!craftsmanRes.ok) {
        throw new Error('Failed to get craftsman data');
      }
      const craftsmanData = await craftsmanRes.json();
      
      const submitData = {
        ...formData,
        craftsman_id: craftsmanData.data?.id || craftsmanData.id,
        customer_id: formData.customer_id || null,
        appointment_id: formData.appointment_id || null,
        quote_id: formData.quote_id ? parseInt(formData.quote_id) : null,
        invoice_id: formData.invoice_id || null
      };

      const res = await fetcher('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Fehler beim Erstellen des Dokuments');
      }

      const responseData = await res.json();
      router.push(`/documents/${responseData.data.id}`);
    } catch (err) {
      console.error('Error creating document:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="Neues Dokument" />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-white">Neues Dokument erstellen</h1>
              <button
                onClick={() => router.back()}
                className="text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Titel *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                    placeholder="Dokumenttitel eingeben..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Ordner
                  </label>
                  <select
                    name="folder_type"
                    value={formData.folder_type}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    {FOLDER_TYPES.map((folder) => (
                      <option key={folder.key} value={folder.key} className="bg-[#121212]">
                        {folder.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Dokumenttyp
                  </label>
                  <select
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.key} value={type.key} className="bg-[#121212]">
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Kunde (optional)
                  </label>
                  <select
                    name="customer_id"
                    value={formData.customer_id}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    <option value="" className="bg-[#121212]">Kein Kunde ausgewählt</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id} className="bg-[#121212]">
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linking Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Termin (optional)
                  </label>
                  <select
                    name="appointment_id"
                    value={formData.appointment_id}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    <option value="" className="bg-[#121212]">Kein Termin</option>
                    {appointments.map((appointment) => (
                      <option key={appointment.id} value={appointment.id} className="bg-[#121212]">
                        Termin #{appointment.id} - {new Date(appointment.scheduled_at).toLocaleDateString('de-DE')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Kostenvoranschlag (optional)
                  </label>
                  <select
                    name="quote_id"
                    value={formData.quote_id}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    <option value="" className="bg-[#121212]">Kein Kostenvoranschlag</option>
                    {quotes.map((quote) => (
                      <option key={quote.id} value={quote.id} className="bg-[#121212]">
                        Kostenvoranschlag #{quote.id} - €{parseFloat(quote.total_amount || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Rechnung (optional)
                  </label>
                  <select
                    name="invoice_id"
                    value={formData.invoice_id}
                    onChange={handleInputChange}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  >
                    <option value="" className="bg-[#121212]">Keine Rechnung</option>
                    {invoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id} className="bg-[#121212]">
                        {invoice.invoice_number_formatted || `Rechnung #${invoice.id}`} - €{parseFloat(invoice.total_amount || 0).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Beschreibung
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  placeholder="Dokumentbeschreibung..."
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-[#ffcb00]/20 text-[#ffcb00] text-sm rounded-full flex items-center"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-[#ffcb00] hover:text-[#e6b800]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag(e)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                    placeholder="Tag hinzufügen..."
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-[#ffcb00]/20 text-[#ffcb00] rounded-lg hover:bg-[#ffcb00]/30 transition-colors"
                  >
                    Hinzufügen
                  </button>
                </div>
              </div>

              {/* Dynamic Document-Specific Fields */}
              {getDocumentSpecificFields()}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Notizen
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  placeholder="Interne Notizen..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-6 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                    loading
                      ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                      : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black'
                  }`}
                >
                  {loading ? (
                    <>
                      <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                      Erstellen...
                    </>
                  ) : (
                    'Dokument erstellen'
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
