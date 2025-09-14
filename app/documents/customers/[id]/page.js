'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../../../lib/utils/useAuthedFetch';
import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import { useRequireAuth } from '../../../../lib/utils/useRequireAuth';
import {
  UserIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  DocumentIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
  FolderIcon,
  UsersIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';

const FOLDER_TYPES = [
  { key: 'all', label: 'Alle Dokumente', icon: FolderIcon },
  { key: 'quotes', label: 'Kostenvoranschläge', icon: ClipboardDocumentListIcon },
  { key: 'invoices', label: 'Rechnungen', icon: DocumentTextIcon },
  { key: 'notes', label: 'Notizen', icon: PencilSquareIcon },
  { key: 'comms', label: 'Kommunikation', icon: ChatBubbleLeftRightIcon },
  { key: 'clients', label: 'Kundeninfo', icon: UserIcon }
];

const DOCUMENT_TYPES = [
  { key: 'all', label: 'Alle Typen' },
  { key: 'quote', label: 'Kostenvoranschlag' },
  { key: 'invoice', label: 'Rechnung' },
  { key: 'note', label: 'Notiz' },
  { key: 'communication', label: 'Kommunikation' },
  { key: 'client_info', label: 'Kundeninfo' }
];

export default function CustomerDocumentsPage({ params }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  
  const [customer, setCustomer] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grouped'
  
  // Actions
  const [deletingId, setDeletingId] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(null);
  
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data when authentication state is ready
  useEffect(() => {
    if (!authLoading && user && mounted && resolvedParams.id) {
      fetchCustomer();
      fetchDocuments();
    }
  }, [authLoading, user, mounted, resolvedParams.id]);

  // Filter documents based on search and filters
  useEffect(() => {
    if (!Array.isArray(documents)) {
      setFilteredDocuments([]);
      return;
    }

    let filtered = [...documents];
    
    if (selectedFolder !== 'all') {
      filtered = filtered.filter(doc => doc.folder_type === selectedFolder);
    }
    
    if (documentTypeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.document_type === documentTypeFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title?.toLowerCase().includes(search) ||
        doc.description?.toLowerCase().includes(search) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(search))
      );
    }
    
    setFilteredDocuments(filtered);
  }, [documents, selectedFolder, documentTypeFilter, searchTerm]);

  const fetchCustomer = async () => {
    try {
      setCustomerLoading(true);
      
      const res = await fetcher(`/api/customers?id=${resolvedParams.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Kunde nicht gefunden');
          return;
        }
        throw new Error(await res.text());
      }
      
      const responseData = await res.json();
      const customerData = responseData.data || responseData;
      
      setCustomer(customerData);
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError('Fehler beim Laden des Kunden. Bitte versuchen Sie es erneut.');
    } finally {
      setCustomerLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // Get craftsman data first to get the craftsman_id
      const craftsmanRes = await fetcher('/api/craftsmen');
      if (!craftsmanRes.ok) {
        throw new Error('Failed to get craftsman data');
      }
      const craftsmanData = await craftsmanRes.json();
      const craftsmanId = craftsmanData.data?.id || craftsmanData.id;
      
      const res = await fetcher(`/api/documents?craftsman_id=${craftsmanId}&customer_id=${resolvedParams.id}`);
      if (!res.ok) throw new Error(await res.text());
      
      const responseData = await res.json();
      const documentsArray = responseData.data || responseData;
      
      setDocuments(documentsArray);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Fehler beim Laden der Dokumente. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (!confirm('Sind Sie sicher, dass Sie dieses Dokument löschen möchten?')) {
      return;
    }
    
    try {
      setDeletingId(id);

      const res = await fetcher(`/api/documents/${id}`, { method: 'DELETE' });
      const responseData = res.ok ? await res.json() : null;

      const document = documents.find(doc => doc.id === id);
      const successMessage = responseData?.message || `Dokument "${document?.title}" erfolgreich gelöscht`;
      setSuccess(successMessage);
      
      await fetchDocuments();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(`Fehler beim Löschen des Dokuments: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleGeneratePdf = async (document) => {
    try {
      setGeneratingPdf(document.id);
      
      // Generate PDF based on document type
      if (document.document_type === 'quote' && document.quote_id) {
        window.open(`/quotes/${document.quote_id}?pdf=true`, '_blank');
      } else if (document.document_type === 'invoice' && document.invoice_id) {
        window.open(`/invoices/${document.invoice_id}?pdf=true`, '_blank');
      } else {
        const { generateDocumentPdf } = await import('../../../../lib/utils/pdfGenerator');
        
        const craftsmanRes = await fetcher('/api/craftsmen');
        let craftsmanData = {};
        if (craftsmanRes.ok) {
          const craftsmanResponse = await craftsmanRes.json();
          craftsmanData = craftsmanResponse.data || craftsmanResponse;
        }
        
        generateDocumentPdf(document, craftsmanData);
        setSuccess('PDF erfolgreich generiert und heruntergeladen.');
        setTimeout(() => setSuccess(''), 5000);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError('Fehler beim Erstellen des PDFs. Bitte versuchen Sie es erneut.');
      setTimeout(() => setError(null), 5000);
    } finally {
      setGeneratingPdf(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const getDocumentIcon = (documentType) => {
    switch (documentType) {
      case 'quote': return ClipboardDocumentListIcon;
      case 'invoice': return DocumentTextIcon;
      case 'note': return PencilSquareIcon;
      case 'communication': return ChatBubbleLeftRightIcon;
      case 'client_info': return UserIcon;
      default: return DocumentIcon;
    }
  };

  const getDocumentTypeLabel = (documentType) => {
    const type = DOCUMENT_TYPES.find(t => t.key === documentType);
    return type?.label || documentType;
  };

  const getFolderCount = (folderType) => {
    if (folderType === 'all') return documents.length;
    return documents.filter(doc => doc.folder_type === folderType).length;
  };

  const getGroupedDocuments = () => {
    const grouped = {};
    
    filteredDocuments.forEach(doc => {
      const type = doc.document_type || 'other';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(doc);
    });
    
    // Sort groups by type priority and documents within groups by date
    const typeOrder = ['quote', 'invoice', 'note', 'communication', 'client_info', 'other'];
    const sortedGroups = {};
    
    typeOrder.forEach(type => {
      if (grouped[type]) {
        sortedGroups[type] = grouped[type].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
      }
    });
    
    // Add any remaining types not in the order
    Object.keys(grouped).forEach(type => {
      if (!typeOrder.includes(type)) {
        sortedGroups[type] = grouped[type].sort((a, b) => 
          new Date(b.created_at) - new Date(a.created_at)
        );
      }
    });
    
    return sortedGroups;
  };

  if (authLoading || !mounted) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
      <div className="text-white">Laden...</div>
    </div>;
  }

  if (error && !customer) {
    return (
      <>
        <Header title="Kundendokumente" />
        <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
          <main className="container mx-auto px-4 py-8">
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg">
              {error}
            </div>
            <div className="mt-6">
              <Link
                href="/documents/customers"
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg"
              >
                Zurück zur Kundenliste
              </Link>
            </div>
          </main>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header title={customer?.name ? `Dokumente - ${customer.name}` : 'Kundendokumente'} />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-100/10 border border-green-200/20 text-green-400 p-4 rounded-lg mb-6">
              {success}
            </div>
          )}
          
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Link 
                  href="/documents"
                  className="text-white/60 hover:text-white transition-colors mr-4"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </Link>
                <div className="flex items-center">
                  <div className="bg-[#ffcb00]/20 rounded-full p-2 mr-3">
                    <UserIcon className="w-6 h-6 text-[#ffcb00]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">
                      {customerLoading ? 'Laden...' : customer?.name || 'Kunde'}
                    </h1>
                    {customer?.email && (
                      <p className="text-white/60 text-sm">{customer.email}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Link 
                  href={`/documents/new?customer_id=${resolvedParams.id}`}
                  className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                  </svg>
                  Neues Dokument
                </Link>
                <Link 
                  href={`/quotes/new?customer_id=${resolvedParams.id}`}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center border border-white/20"
                >
                  <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />
                  Kostenvoranschlag
                </Link>
              </div>
            </div>

            {/* Customer Info */}
            {customer && (
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {customer.service_type && (
                    <div>
                      <span className="text-white/40">Service:</span>
                      <span className="text-white/70 ml-2">{customer.service_type}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <span className="text-white/40">Telefon:</span>
                      <span className="text-white/70 ml-2">{customer.phone}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-white/40">Kunde seit:</span>
                    <span className="text-white/70 ml-2">{formatDate(customer.created_at)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Folder Navigation */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-3">Dokumenttypen</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {FOLDER_TYPES.map((folder) => {
                  const IconComponent = folder.icon;
                  return (
                    <button
                      key={folder.key}
                      onClick={() => setSelectedFolder(folder.key)}
                      className={`p-3 rounded-lg text-center transition-all ${
                        selectedFolder === folder.key
                          ? 'bg-[#ffcb00]/20 border-2 border-[#ffcb00] text-[#ffcb00]'
                          : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                      }`}
                    >
                      <div className="flex justify-center mb-2">
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="text-xs font-medium">{folder.label}</div>
                      <div className="text-xs text-white/60 mt-1">
                        {getFolderCount(folder.key)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="Dokumente suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 pl-10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MagnifyingGlassIcon className="w-5 h-5 text-white/50" />
                </div>
              </div>
              
              <select
                value={documentTypeFilter}
                onChange={(e) => setDocumentTypeFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30 w-full sm:w-auto"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
              
              {/* View Mode Toggle */}
              <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-[#ffcb00] text-black'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <ListBulletIcon className="w-4 h-4 mr-2" />
                  Liste
                </button>
                <button
                  onClick={() => setViewMode('grouped')}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'grouped'
                      ? 'bg-[#ffcb00] text-black'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Squares2X2Icon className="w-4 h-4 mr-2" />
                  Gruppiert
                </button>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center my-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm || selectedFolder !== 'all' || documentTypeFilter !== 'all' ? (
                  <div>
                    <p className="text-white/70 text-lg mb-3">Keine Dokumente entsprechen Ihren Suchkriterien</p>
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedFolder('all');
                        setDocumentTypeFilter('all');
                      }}
                      className="text-[#ffcb00] hover:underline"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                ) : (
                  <div>
                    <DocumentIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/70 text-lg mb-4">Noch keine Dokumente für diesen Kunden</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Link
                        href={`/documents/new?customer_id=${resolvedParams.id}`}
                        className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                        Dokument erstellen
                      </Link>
                      <Link
                        href={`/quotes/new?customer_id=${resolvedParams.id}`}
                        className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center justify-center border border-white/20"
                      >
                        <ClipboardDocumentListIcon className="w-4 h-4 mr-2" />
                        Kostenvoranschlag
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            ) : viewMode === 'grouped' ? (
              // Grouped View
              <div className="space-y-8">
                {Object.entries(getGroupedDocuments()).map(([type, docs]) => (
                  <div key={type} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                    <div className="bg-white/5 px-6 py-4 border-b border-white/10">
                      <div className="flex items-center">
                        <div className="mr-3">
                          {(() => {
                            const IconComponent = getDocumentIcon(type);
                            return <IconComponent className="w-6 h-6 text-[#ffcb00]" />;
                          })()}
                        </div>
                        <h3 className="text-lg font-semibold text-white">
                          {getDocumentTypeLabel(type)}
                        </h3>
                        <span className="ml-3 bg-[#ffcb00]/20 text-[#ffcb00] px-2 py-1 rounded-full text-sm font-medium">
                          {docs.length}
                        </span>
                      </div>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {docs.map((document, index) => (
                          <div key={`grouped-${document.id}-${index}`} className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <h4 className="text-white font-medium text-base truncate mb-1">{document.title}</h4>
                                {document.description && (
                                  <p className="text-white/50 text-sm line-clamp-2">{document.description}</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="text-sm text-white/60 mb-3">
                              <span className="text-white/40">Erstellt:</span>
                              <div>{formatDate(document.created_at)}</div>
                            </div>
                            
                            {document.tags && document.tags.length > 0 && (
                              <div className="mb-3">
                                <div className="flex flex-wrap gap-1">
                                  {document.tags.slice(0, 2).map((tag, index) => (
                                    <span key={index} className="px-2 py-1 bg-[#ffcb00]/20 text-[#ffcb00] text-xs rounded">
                                      {tag}
                                    </span>
                                  ))}
                                  {document.tags.length > 2 && (
                                    <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded">
                                      +{document.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2">
                              <Link 
                                href={`/documents/${document.id}`}
                                className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                              >
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                                </svg>
                                Details
                              </Link>
                              <button
                                onClick={() => handleGeneratePdf(document)}
                                disabled={generatingPdf === document.id}
                                className={`px-3 py-1.5 ${
                                  generatingPdf === document.id 
                                    ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed' 
                                    : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black cursor-pointer'
                                } text-sm font-medium rounded-lg transition-colors flex items-center justify-center`}
                              >
                                {generatingPdf === document.id ? (
                                  <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // List View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((document, index) => (
                  <div key={`document-${document.id}-${index}`} className="bg-white/5 rounded-lg p-5 border border-white/10 hover:bg-white/10 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <div className="mr-3">
                            {(() => {
                              const IconComponent = getDocumentIcon(document.document_type);
                              return <IconComponent className="w-5 h-5 text-white/70" />;
                            })()}
                          </div>
                          <h3 className="text-white font-medium text-lg truncate">{document.title}</h3>
                        </div>
                        {document.description && (
                          <p className="text-white/50 text-sm line-clamp-2">{document.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                      <div className="text-white/60">
                        <span className="text-white/40">Typ:</span>
                        <div className="capitalize">{getDocumentTypeLabel(document.document_type)}</div>
                      </div>
                      <div className="text-white/60">
                        <span className="text-white/40">Erstellt:</span>
                        <div>{formatDate(document.created_at)}</div>
                      </div>
                    </div>
                    
                    {document.tags && document.tags.length > 0 && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {document.tags.slice(0, 3).map((tag, index) => (
                            <span key={index} className="px-2 py-1 bg-[#ffcb00]/20 text-[#ffcb00] text-xs rounded">
                              {tag}
                            </span>
                          ))}
                          {document.tags.length > 3 && (
                            <span className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded">
                              +{document.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row justify-between gap-2 pt-3 border-t border-white/10">
                      <Link 
                        href={`/documents/${document.id}`}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Details
                      </Link>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGeneratePdf(document)}
                          disabled={generatingPdf === document.id}
                          className={`px-3 py-1.5 flex-1 ${
                            generatingPdf === document.id 
                              ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed' 
                              : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black cursor-pointer'
                          } text-sm font-medium rounded-lg transition-colors flex items-center justify-center`}
                        >
                          {generatingPdf === document.id ? (
                            <>
                              <span className="mr-2 h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></span>
                              PDF...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                              </svg>
                              PDF
                            </>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleDelete(document.id, e)}
                          disabled={deletingId === document.id}
                          className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors flex items-center justify-center"
                        >
                          {deletingId === document.id ? (
                            <span className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
