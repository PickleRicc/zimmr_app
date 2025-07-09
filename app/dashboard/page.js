'use client';

import { useState, useEffect } from 'react';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import Link from 'next/link';
import NextAppointment from '../components/NextAppointment';
import FinanceCard from './FinanceCard';
import RevenueChart from '../components/RevenueChart';
import { useAuth } from '../../contexts/AuthContext';
import { getFinanceStats } from '../../lib/finances-client';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [craftsman, setCraftsman] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [customerCount] = useState(0);
  const [invoiceCount] = useState(0);
  const [financeStats, setFinanceStats] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(true);

  // Use the AuthContext to get user data
  const { user, loading: authLoading } = useAuth();
  const fetcher = useAuthedFetch();

  // Function to fetch finance stats
  const loadFinanceStats = async () => {
    try {
      setFinanceLoading(true);
      console.log('Dashboard: Fetching finance stats...');
      
      // Make sure we have a user session before trying to get finance stats
      if (!user) {
        console.log('Dashboard: No user session available, skipping finance stats fetch');
        return;
      }
      
      const stats = await getFinanceStats();
      console.log('Dashboard: Finance stats received:', stats);
      console.log('Dashboard: Monthly paid data:', stats?.monthly?.paid);
      console.log('Dashboard: Monthly open data:', stats?.monthly?.open);
      console.log('Dashboard: Goal amount:', stats?.goal?.goal_amount);
      setFinanceStats(stats);
    } catch (err) {
      console.error('Dashboard: Error fetching finance stats:', err);
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      if (authLoading) {
        return; // Still loading auth state
      }
      
      if (!user) {
        console.log('No authenticated user found');
        setError('Sie müssen angemeldet sein, um auf das Dashboard zuzugreifen.');
        return;
      }
      
      console.log('User data from Supabase:', user);
      
      try {
        fetchCraftsmanData();
        loadFinanceStats(); // Load finance stats
      } catch (error) {
        console.error('Error getting craftsman ID:', error);
        setError('Fehler bei der Benutzerauthentifizierung. Bitte versuchen Sie es später erneut.');
        setLoading(false);
      } 
      setLoading(false);
    };
    
    // Call the async function
    loadDashboard();
  }, [user, authLoading]);

  const fetchCraftsmanData = async () => {
    try {
      
      const craftsmanRes = await fetcher('/api/craftsmen');
      const craftsmanData = craftsmanRes.ok ? await craftsmanRes.json() : null;
      
      // Debug the craftsman data structure
      console.log('Craftsman data received:', craftsmanData);
      
      setCraftsman(craftsmanData);
      
      try {
        // Fetch upcoming appointments with explicit error handling
                console.log('Fetching appointments for /*removedLegacyId*/');
        const appointmentsRes = await fetcher('/api/appointments');
        const appointmentsResponse = appointmentsRes.ok ? await appointmentsRes.json() : [];
        console.log('Raw appointments response:', appointmentsResponse);
        
        // Handle different response formats safely
        let appointmentsData;
        if (Array.isArray(appointmentsResponse)) {
          appointmentsData = appointmentsResponse;
        } else if (appointmentsResponse && typeof appointmentsResponse === 'object') {
          if (Array.isArray(appointmentsResponse.data)) {
            appointmentsData = appointmentsResponse.data;
          } else if (appointmentsResponse.error) {
            console.error('API returned error:', appointmentsResponse.error);
            setError(`Fehler: ${appointmentsResponse.error}`);
            appointmentsData = [];
          } else {
            console.warn('Unexpected appointments response format:', appointmentsResponse);
            appointmentsData = [];
          }
        } else {
          appointmentsData = [];
        }
        
        if (Array.isArray(appointmentsData)) {
          // Sort appointments by date and take only future ones
          const now = new Date();
          const upcoming = appointmentsData
            .filter(apt => new Date(apt.scheduled_at) > now)
            .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
            .slice(0, 5); // Take only the next 5 appointments
          
          console.log(`Found ${upcoming.length} upcoming appointments out of ${appointmentsData.length} total`);
          setUpcomingAppointments(upcoming);
        } else {
          // Not an array, which should be handled by the code above
          console.error('Appointments data is not an array after processing');
          setUpcomingAppointments([]);
        }
      } catch (appointmentError) {
        console.error('Error fetching appointments:', appointmentError);
        setUpcomingAppointments([]);
      }
      
      // TODO: migrate customers count to new API
      // try {
      //   const customersData = await fetcher('/api/customers');
      //   setCustomerCount(Array.isArray(customersData) ? customersData.length : 0);
      // } catch (e) { setCustomerCount(0); }
      // TODO: migrate invoices count to new API
      // try {
      //   const invoicesData = await fetcher('/api/invoices');
      //   setInvoiceCount(Array.isArray(invoicesData) ? invoicesData.length : 0);
      // } catch (e) { setInvoiceCount(0); }
    } catch (err) {
      console.error('Error fetching craftsman data:', err);
      setError('Failed to load your data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Get user name from various possible sources
  const getUserName = () => {
    // Log all possible sources for debugging
    console.log('Checking name sources:');
    console.log('- craftsman:', craftsman);
    console.log('- user:', user);
    
    // Try to get name from different sources in order of preference
    
    // 1. Try craftsman object from API
    if (craftsman && craftsman.name) {
      return `, ${craftsman.name}`;
    }
    
    // 2. Try craftsman first_name and last_name
    if (craftsman && craftsman.first_name) {
      return `, ${craftsman.first_name}${craftsman.last_name ? ' ' + craftsman.last_name : ''}`;
    }
    
    // 3. Try user object from Supabase
    if (user) {
      // Try user metadata
      if (user.user_metadata && user.user_metadata.name) {
        return `, ${user.user_metadata.name}`;
      }
      
      // Try email (remove domain)
      if (user.email) {
        const emailName = user.email.split('@')[0];
        return `, ${emailName}`;
      }
    }
    
    // If all else fails, return empty string (just shows "Willkommen")
    return '';
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
      <main className="flex-grow container mx-auto px-5 py-8 max-w-7xl overflow-hidden bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
        {loading ? (
          <div className="flex items-center justify-center h-screen animate-fade-in">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#ffcb00]"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-16 animate-fade-in">
            <h1 className="text-4xl font-bold mb-6 font-heading">
              <span className="bg-gradient-to-r from-[#ffcb00] to-[#e6b800] bg-clip-text text-transparent">Willkommen bei ZIMMR</span>
            </h1>
            <p className="text-xl text-white/80 max-w-3xl mx-auto mb-10">
              Die intelligente Plattform für Fliesenleger, um Termine, Kunden und Materialien zu verwalten.
            </p>
            <div className="flex gap-4 justify-center">
              <Link 
                href="/auth/login" 
                className="px-8 py-3 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Anmelden
              </Link>
              <Link 
                href="/auth/register" 
                className="px-8 py-3 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5"
              >
                Registrieren
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 animate-fade-in">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">
                  <span className="bg-gradient-to-r from-[#ffcb00] to-[#e6b800] bg-clip-text text-transparent">
                    {/* Try multiple sources for the user name */}
                    {`Willkommen${getUserName()}`}
                  </span>
                </h1>
                <p className="text-white/70 mb-6">
                  {craftsman ? `Fliesenleger` : 'Handwerker-Dashboard'}
                </p>
              </div>

              {/* Two-column layout for appointment and finance chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Next Appointment Section - 1/3 width on large screens */}
                <div className="lg:col-span-1">
                  <NextAppointment appointment={upcomingAppointments && upcomingAppointments.length > 0 ? upcomingAppointments[0] : null} />
                </div>
                
                {/* Finance Chart Section - 2/3 width on large screens */}
                <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-4">
                    <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white">Jahresumsatz</h2>
                  <Link href="/finances" className="ml-auto text-[#ffcb00] hover:underline flex items-center text-sm">
                    Details anzeigen
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
                
                {financeLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
                  </div>
                ) : financeStats ? (
                  <div>
                    {/* Chart container with height matching appointment card */}
                    <div className="h-72 mb-8" style={{ position: 'relative' }}>
                      <RevenueChart 
                        monthlyPaid={financeStats.monthly?.paid || []} 
                        monthlyOpen={financeStats.monthly?.open || []} 
                        yearlyGoal={financeStats.goal?.goal_amount || null} 
                      />
                    </div>
                    
                    {/* Manual legend to ensure visibility */}
                    <div className="flex items-center justify-center gap-6 mb-6">
                      <div className="flex items-center">
                        <span className="inline-block w-3 h-3 mr-2 bg-green-500 rounded-full"></span>
                        <span className="text-white text-sm">Bezahlt</span>
                      </div>
                      <div className="flex items-center">
                        <span className="inline-block w-3 h-3 mr-2 bg-yellow-500 rounded-full"></span>
                        <span className="text-white text-sm">Ausstehend</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between mt-8 gap-4">
                      <div className="bg-white/5 rounded-lg p-4">
                        <span className="text-white/70 text-sm">Bezahlt</span>
                        <p className="text-lg font-medium text-green-500">€{Number(financeStats.totalRevenue || 0).toLocaleString('de-DE')}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <span className="text-white/70 text-sm">Ausstehend</span>
                        <p className="text-lg font-medium text-yellow-500">€{Number(financeStats.totalOpen || 0).toLocaleString('de-DE')}</p>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <span className="text-white/70 text-sm">Jahresziel</span>
                        <p className="text-lg font-medium text-white">
                          {financeStats.goal ? 
                            `€${Number(financeStats.goal.goal_amount).toLocaleString('de-DE')}` : 
                            'Kein Ziel festgelegt'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-white/70">
                    Keine Finanzdaten verfügbar. <Link href="/finances" className="text-[#ffcb00] hover:underline">Finanzen verwalten</Link>
                  </div>
                )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 hover:bg-white/10">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-4">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Kommende Termine</h2>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">{upcomingAppointments.length}</div>
                  <p className="text-white/60 mb-4">Geplante Fliesenprojekte</p>
                  <Link href="/appointments" className="text-[#ffcb00] hover:underline flex items-center text-sm">
                    Alle Termine anzeigen
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
                
                <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 hover:bg-white/10">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-4">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Kunden</h2>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">{customerCount}</div>
                  <p className="text-white/60 mb-4">Aktive Kunden</p>
                  <Link href="/customers" className="text-[#ffcb00] hover:underline flex items-center text-sm">
                    Alle Kunden anzeigen
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
                
                <FinanceCard />
                
                <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-all duration-300 hover:bg-white/10">
                  <div className="flex items-center mb-4">
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-4">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Rechnungen</h2>
                  </div>
                  <div className="text-3xl font-bold text-white mb-2">{invoiceCount}</div>
                  <p className="text-white/60 mb-4">Kundenrechnungen</p>
                  <Link href="/invoices" className="text-[#ffcb00] hover:underline flex items-center text-sm">
                    Alle Rechnungen anzeigen
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                  </Link>
                </div>
              </div>
              
              <div className="mb-8">
                {/* Quick actions title section - currently disabled 
                <div className="flex items-center mb-6">
                  <div className="p-2 bg-[#ffcb00]/20 rounded-full">
                    <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                  </div>
                </div>
                */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Link 
                    href="/appointments/new" 
                    className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 h-32"
                  >
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                      </svg>
                    </div>
                    <span className="font-medium">Neuen Termin hinzufügen</span>
                  </Link>
                  <Link 
                    href="/time-tracking" 
                    className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 h-32"
                  >
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2"></path>
                      </svg>
                    </div>
                    <span className="font-medium">Zeiterfassung</span>
                  </Link>
                  <Link 
                    href="/customers/new" 
                    className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 h-32"
                  >
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 0112 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                      </svg>
                    </div>
                    <span className="font-medium">Neuen Kunden hinzufügen</span>
                  </Link>
                  <Link 
                    href="/materials/new" 
                    className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 h-32"
                  >
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4"></path>
                      </svg>
                    </div>
                    <span className="font-medium">Neues Fliesenmaterial hinzufügen</span>
                  </Link>
                  <Link 
                    href="/invoices/new" 
                    className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 h-32"
                  >
                    <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <span className="font-medium">Neue Rechnung erstellen</span>
                  </Link>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}