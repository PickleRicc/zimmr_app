'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import {
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  ChatBubbleLeftRightIcon,
  ArrowUpTrayIcon,
  UserIcon,
  DocumentIcon
} from '@heroicons/react/24/outline';

export default function DocumentDetailPage({ params }) {
  const documentId = use(params).id;
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Edit form data
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    tags: [],
    notes: ''
  });
  
  const [tagInput, setTagInput] = useState('');
  
  const router = useRouter();
  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  useEffect(() => {
    if (!authLoading && user && documentId) {
      fetchDocument();
    }
  }, [authLoading, user, documentId]);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      
      const res = await fetcher(`/api/documents/${documentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Dokument nicht gefunden');
          return;
        }
        throw new Error(await res.text());
      }
      
      const responseData = await res.json();
      const documentData = responseData.data || responseData;
      
      setDocument(documentData);
      setEditData({
        title: documentData.title || '',
        description: documentData.description || '',
        tags: documentData.tags || [],
        notes: documentData.notes || ''
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching document:', err);
      setError('Fehler beim Laden des Dokuments. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditData({
      title: document.title || '',
      description: document.description || '',
      tags: document.tags || [],
      notes: document.notes || ''
    });
    setTagInput('');
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const res = await fetcher(`/api/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Fehler beim Speichern');
      }
      
      const responseData = await res.json();
      setDocument(responseData.data || responseData);
      setEditing(false);
      setSuccess('Dokument erfolgreich aktualisiert');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Error saving document:', err);
      setError(err.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (tagInput.trim() && !editData.tags.includes(tagInput.trim())) {
      setEditData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setEditData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleDelete = async () => {
    if (!confirm('Sind Sie sicher, dass Sie dieses Dokument löschen möchten?')) {
      return;
    }
    
    try {
      const res = await fetcher(`/api/documents/${documentId}`, { method: 'DELETE' });
      
      if (res.ok) {
        router.push('/documents');
      } else {
        const errorData = await res.json();
        setError(errorData.error || 'Fehler beim Löschen des Dokuments');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      setError('Fehler beim Löschen des Dokuments');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getFolderLabel = (folderType) => {
    const folders = {
      'clients': 'Kunden',
      'quotes': 'Kostenvoranschläge',
      'invoices': 'Rechnungen',
      'notes': 'Notizen',
      'comms': 'Kommunikation'
    };
    return folders[folderType] || folderType;
  };

  if (loading) {
    return (
      <>
        <Header title="Dokument" />
        <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
          <main className="container mx-auto px-4 py-8">
            <div className="flex justify-center my-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
            </div>
          </main>
        </div>
        <Footer />
      </>
    );
  }

  if (error && !document) {
    return (
      <>
        <Header title="Dokument" />
        <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
          <main className="container mx-auto px-4 py-8">
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg">
              {error}
            </div>
            <div className="mt-6">
              <button
                onClick={() => router.push('/documents')}
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg"
              >
                Zurück zu Dokumenten
              </button>
            </div>
          </main>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header title={document?.title || 'Dokument'} />
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
          
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/documents')}
                  className="text-white/60 hover:text-white transition-colors mr-4"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
                  </svg>
                </button>
                <div className="flex items-center">
                  <div className="mr-3">
                    {(() => {
                      const IconComponent = getDocumentIcon(document?.document_type);
                      return <IconComponent className="w-8 h-8 text-white/70" />;
                    })()}
                  </div>
                  {editing ? (
                    <input
                      type="text"
                      name="title"
                      value={editData.title}
                      onChange={handleInputChange}
                      className="text-2xl font-bold bg-white/5 border border-white/10 rounded px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-white">{document?.title}</h1>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        saving
                          ? 'bg-gray-500/20 text-gray-400 cursor-not-allowed'
                          : 'bg-[#ffcb00] hover:bg-[#e6b800] text-black'
                      }`}
                    >
                      {saving ? 'Speichern...' : 'Speichern'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleEdit}
                      className="px-4 py-2 bg-white/5 text-white rounded-lg hover:bg-white/10 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                      </svg>
                      Bearbeiten
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                      Löschen
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Document Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white/60 mb-2">Ordner</h3>
                <p className="text-white">{getFolderLabel(document?.folder_type)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white/60 mb-2">Dokumenttyp</h3>
                <p className="text-white capitalize">{document?.document_type}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white/60 mb-2">Erstellt</h3>
                <p className="text-white">{formatDate(document?.created_at)}</p>
              </div>
            </div>

            {/* Linked Items */}
            {(document?.customers || document?.appointments || document?.quotes || document?.invoices || document?.notes) && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-white mb-4">Verknüpfte Elemente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {document?.customers && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white/60 mb-2">Kunde</h4>
                      <p className="text-white">{document.customers.name}</p>
                      {document.customers.email && (
                        <p className="text-white/60 text-sm">{document.customers.email}</p>
                      )}
                    </div>
                  )}
                  
                  {document?.appointments && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-white/60 mb-2">Termin</h4>
                      <p className="text-white">Termin #{document.appointments.id}</p>
                      <p className="text-white/60 text-sm">{formatDate(document.appointments.scheduled_at)}</p>
                      {document.appointments.location && (
                        <p className="text-white/60 text-sm">{document.appointments.location}</p>
                      )}
                    </div>
                  )}
                  
                  {document?.quotes && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white/60">Kostenvoranschlag</h4>
                        <button
                          onClick={() => router.push(`/quotes/${document.quotes.id}`)}
                          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-3 py-1 rounded text-xs font-medium transition-colors flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          Öffnen
                        </button>
                      </div>
                      <p className="text-white">Kostenvoranschlag #{document.quotes.id}</p>
                      <p className="text-white/60 text-sm">€{parseFloat(document.quotes.amount || 0).toFixed(2)}</p>
                    </div>
                  )}
                  
                  {document?.invoices && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white/60">Rechnung</h4>
                        <button
                          onClick={() => router.push(`/invoices/${document.invoices.id}`)}
                          className="bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 px-3 py-1 rounded text-xs font-medium transition-colors flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          Öffnen
                        </button>
                      </div>
                      <p className="text-white">{document.invoices.invoice_number_formatted || `Rechnung #${document.invoices.id}`}</p>
                      <p className="text-white/60 text-sm">€{parseFloat(document.invoices.total_amount || 0).toFixed(2)}</p>
                    </div>
                  )}
                  
                  {document?.notes && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-white/60">Notiz</h4>
                        <button
                          onClick={() => router.push(`/notes/${document.notes.id}`)}
                          className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-3 py-1 rounded text-xs font-medium transition-colors flex items-center"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                          </svg>
                          Öffnen
                        </button>
                      </div>
                      <p className="text-white">{document.notes.title}</p>
                      <p className="text-white/60 text-sm">
                        {document.notes.content && document.notes.content.length > 100 
                          ? `${document.notes.content.substring(0, 100)}...` 
                          : document.notes.content || 'Keine Vorschau verfügbar'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Beschreibung</h3>
              {editing ? (
                <textarea
                  name="description"
                  value={editData.description}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  placeholder="Dokumentbeschreibung..."
                />
              ) : (
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-white whitespace-pre-wrap">
                    {document?.description || 'Keine Beschreibung verfügbar'}
                  </p>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Tags</h3>
              {editing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {editData.tags.map((tag, index) => (
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
              ) : (
                <div className="flex flex-wrap gap-2">
                  {document?.tags && document.tags.length > 0 ? (
                    document.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-[#ffcb00]/20 text-[#ffcb00] text-sm rounded-full"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-white/60">Keine Tags</p>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-white mb-4">Notizen</h3>
              {editing ? (
                <textarea
                  name="notes"
                  value={editData.notes}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/30 focus:border-[#ffcb00]/30"
                  placeholder="Interne Notizen..."
                />
              ) : (
                <div className="bg-white/5 rounded-lg p-4">
                  <p className="text-white whitespace-pre-wrap">
                    {document?.notes || 'Keine Notizen verfügbar'}
                  </p>
                </div>
              )}
            </div>

            {/* Version Info */}
            <div className="pt-6 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/60">
                <div>
                  <span className="font-medium">Version:</span> {document?.version || 1}
                </div>
                <div>
                  <span className="font-medium">Letzte Änderung:</span> {formatDate(document?.updated_at)}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
