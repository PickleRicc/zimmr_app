'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import { useRequireAuth } from '../../../lib/utils/useRequireAuth';
import {
  UserIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

export default function CustomersDocumentsPage() {
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [cache, setCache] = useState(new Map());
  const [lastFetch, setLastFetch] = useState(null);
  const [searchFilters, setSearchFilters] = useState({
    serviceType: '',
    minDocuments: '',
    maxDocuments: ''
  });
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  const fetcher = useAuthedFetch();
  const { user, loading: authLoading } = useRequireAuth();

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch customers when authentication state is ready
  useEffect(() => {
    if (!authLoading && user && mounted) {
      fetchCustomers();
    }
  }, [authLoading, user, mounted]);

  // Filter customers based on search term and advanced filters
  useEffect(() => {
    let filtered = [...customers];
    
    // Text search
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(customer => 
        customer.name?.toLowerCase().includes(search) ||
        customer.email?.toLowerCase().includes(search) ||
        customer.service_type?.toLowerCase().includes(search) ||
        customer.phone?.toLowerCase().includes(search) ||
        customer.address?.toLowerCase().includes(search)
      );
    }
    
    // Service type filter
    if (searchFilters.serviceType) {
      filtered = filtered.filter(customer => 
        customer.service_type?.toLowerCase().includes(searchFilters.serviceType.toLowerCase())
      );
    }
    
    // Document count filters
    if (searchFilters.minDocuments) {
      const min = parseInt(searchFilters.minDocuments);
      if (!isNaN(min)) {
        filtered = filtered.filter(customer => (customer.document_count || 0) >= min);
      }
    }
    
    if (searchFilters.maxDocuments) {
      const max = parseInt(searchFilters.maxDocuments);
      if (!isNaN(max)) {
        filtered = filtered.filter(customer => (customer.document_count || 0) <= max);
      }
    }
    
    setFilteredCustomers(filtered);
  }, [customers, searchTerm, searchFilters]);

  const fetchCustomers = async (page = 1, forceRefresh = false) => {
    const cacheKey = `customers-page-${page}`;
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    // Check cache first
    if (!forceRefresh && cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (now - cachedData.timestamp < cacheExpiry) {
        setCustomers(cachedData.customers);
        setPagination(cachedData.pagination);
        return;
      }
    }

    try {
      setLoading(true);
      
      const res = await fetcher(`/api/customers?page=${page}&limit=${pagination.limit}`);
      if (!res.ok) throw new Error(await res.text());
      
      const responseData = await res.json();
      const data = responseData.data || responseData;
      
      if (data.customers) {
        // New paginated response format
        setCustomers(data.customers);
        setPagination(data.pagination);
        
        // Cache the response
        setCache(prev => new Map(prev).set(cacheKey, {
          customers: data.customers,
          pagination: data.pagination,
          timestamp: now
        }));
      } else {
        // Fallback for old response format
        setCustomers(data);
        
        // Cache fallback response
        setCache(prev => new Map(prev).set(cacheKey, {
          customers: data,
          pagination: pagination,
          timestamp: now
        }));
      }
      
      setLastFetch(now);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Fehler beim Laden der Kunden. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchCustomers(newPage);
    }
  };

  const handleRefresh = () => {
    setCache(new Map()); // Clear cache
    fetchCustomers(pagination.page, true); // Force refresh
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSearchFilters({
      serviceType: '',
      minDocuments: '',
      maxDocuments: ''
    });
  };

  const getUniqueServiceTypes = () => {
    const types = customers.map(customer => customer.service_type).filter(Boolean);
    return [...new Set(types)].sort();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (authLoading || !mounted) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
      <div className="text-white">Laden...</div>
    </div>;
  }

  return (
    <>
      <Header title="Kundendokumente" />
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <main className="container mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-100/10 border border-red-200/20 text-red-400 p-4 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
              <h1 className="text-2xl font-bold text-white">Dokumentenverwaltung</h1>
              <Link 
                href="/documents/new" 
                className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Neues Dokument
              </Link>
            </div>
            
            {/* Search Bar and Controls */}
            <div className="space-y-4 mb-8">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/40" />
                  <input
                    type="text"
                    placeholder="Kunden suchen (Name, E-Mail, Service, Telefon, Adresse)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                  className={`px-4 py-3 border border-white/10 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-colors ${
                    showAdvancedSearch ? 'bg-white/10' : 'bg-white/5'
                  }`}
                  title="Erweiterte Suche"
                >
                  <AdjustmentsHorizontalIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className={`px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent transition-colors ${
                    loading ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  title="Daten aktualisieren"
                >
                  <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Advanced Search Panel */}
              {showAdvancedSearch && (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-medium">Erweiterte Filter</h3>
                    <button
                      onClick={clearFilters}
                      className="text-[#ffcb00] hover:text-[#e6b800] text-sm font-medium"
                    >
                      Filter zurücksetzen
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        Service-Art
                      </label>
                      <select
                        value={searchFilters.serviceType}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, serviceType: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent"
                      >
                        <option value="">Alle Service-Arten</option>
                        {getUniqueServiceTypes().map(type => (
                          <option key={type} value={type} className="bg-gray-800">
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        Min. Dokumente
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={searchFilters.minDocuments}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, minDocuments: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">
                        Max. Dokumente
                      </label>
                      <input
                        type="number"
                        min="0"
                        placeholder="∞"
                        value={searchFilters.maxDocuments}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, maxDocuments: e.target.value }))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center my-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12">
                {searchTerm ? (
                  <div>
                    <p className="text-white/70 text-lg mb-3">Keine Kunden entsprechen Ihrer Suche</p>
                    <button
                      onClick={() => setSearchTerm('')}
                      className="text-[#ffcb00] hover:underline"
                    >
                      Suche zurücksetzen
                    </button>
                  </div>
                ) : (
                  <div>
                    <UserIcon className="w-16 h-16 text-white/30 mx-auto mb-4" />
                    <p className="text-white/70 text-lg mb-4">Sie haben noch keine Kunden</p>
                    <Link
                      href="/customers/new"
                      className="bg-[#ffcb00] hover:bg-[#e6b800] text-black px-4 py-2 rounded-lg shadow text-sm font-medium inline-flex items-center"
                    >
                      <UserIcon className="w-4 h-4 mr-2" />
                      Ersten Kunden erstellen
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/documents/customers/${customer.id}`}
                    className="bg-white/5 rounded-lg p-5 border border-white/10 hover:bg-white/10 transition-all group cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div className="bg-[#ffcb00]/20 rounded-full p-2 mr-3">
                          <UserIcon className="w-6 h-6 text-[#ffcb00]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-white font-medium text-lg truncate">{customer.name}</h3>
                          {customer.email && (
                            <p className="text-white/60 text-sm truncate">{customer.email}</p>
                          )}
                        </div>
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      {customer.service_type && (
                        <div className="text-sm">
                          <span className="text-white/40">Service:</span>
                          <span className="text-white/70 ml-2">{customer.service_type}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="text-sm">
                          <span className="text-white/40">Telefon:</span>
                          <span className="text-white/70 ml-2">{customer.phone}</span>
                        </div>
                      )}
                      <div className="text-sm">
                        <span className="text-white/40">Erstellt:</span>
                        <span className="text-white/70 ml-2">{formatDate(customer.created_at)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-white/60 text-sm">Dokumente anzeigen</span>
                        <div className="bg-[#ffcb00]/20 text-[#ffcb00] px-2 py-1 rounded text-xs font-medium">
                          {customer.document_count || 0} Dokumente
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pagination.hasPrev
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                  }`}
                >
                  Vorherige
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 3) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = pagination.page - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          pageNum === pagination.page
                            ? 'bg-[#ffcb00] text-black'
                            : 'bg-white/5 hover:bg-white/10 text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    pagination.hasNext
                      ? 'bg-white/5 hover:bg-white/10 text-white'
                      : 'bg-white/5 text-white/40 cursor-not-allowed'
                  }`}
                >
                  Nächste
                </button>
              </div>
            )}

            {/* Pagination Info */}
            {pagination.total > 0 && (
              <div className="text-center mt-4 text-white/60 text-sm">
                Zeige {((pagination.page - 1) * pagination.limit) + 1} bis {Math.min(pagination.page * pagination.limit, pagination.total)} von {pagination.total} Kunden
              </div>
            )}
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
