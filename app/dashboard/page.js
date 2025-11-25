'use client';

import { useState, useEffect } from 'react';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import Link from 'next/link';
import { motion } from 'framer-motion';
import NextAppointment from '../components/NextAppointment';
import FinanceCard from './FinanceCard';
import RevenueChart from '../components/RevenueChart';
import StatsCard from './components/StatsCard';
import QuickActionCard from './components/QuickActionCard';
import { useAuth } from '../../contexts/AuthContext';



export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [craftsman, setCraftsman] = useState(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [documentCount, setDocumentCount] = useState(0);
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

      const response = await fetcher('/api/finances');
      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }
      const responseData = await response.json();
      const stats = responseData.data || responseData;
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

  // Function to fetch customer count
  const loadCustomerCount = async () => {
    try {
      console.log('Dashboard: Fetching customer count...');
      const response = await fetcher('/api/customers');

      if (response.ok) {
        const responseData = await response.json();
        const data = responseData.data || responseData;

        // Handle paginated response structure
        let count = 0;
        if (data.pagination && typeof data.pagination.total === 'number') {
          count = data.pagination.total;
        } else if (data.customers && Array.isArray(data.customers)) {
          count = data.customers.length;
        } else if (Array.isArray(data)) {
          count = data.length;
        }

        console.log('Dashboard: Customer count received:', count);
        setCustomerCount(count);
      } else {
        console.error('Dashboard: Failed to fetch customers:', response.status);
      }
    } catch (err) {
      console.error('Dashboard: Error fetching customer count:', err);
    }
  };

  // Function to fetch invoice count
  const loadInvoiceCount = async () => {
    try {
      console.log('Dashboard: Fetching invoice count...');
      const response = await fetcher('/api/invoices');

      if (response.ok) {
        const data = await response.json();
        const invoices = data.data || data;
        const count = Array.isArray(invoices) ? invoices.length : 0;
        console.log('Dashboard: Invoice count received:', count);
        setInvoiceCount(count);
      } else {
        console.error('Dashboard: Failed to fetch invoices:', response.status);
      }
    } catch (err) {
      console.error('Dashboard: Error fetching invoice count:', err);
    }
  };

  // Function to fetch document count
  const loadDocumentCount = async () => {
    try {
      console.log('Dashboard: Fetching document count...');

      // First get the craftsman data to get the craftsman_id
      const craftsmanRes = await fetcher('/api/craftsmen');
      if (!craftsmanRes.ok) {
        console.error('Dashboard: Failed to fetch craftsman data for documents');
        return;
      }

      const craftsmanResponse = await craftsmanRes.json();
      // Handle both wrapped and direct response formats
      const craftsmanData = craftsmanResponse.data || craftsmanResponse;
      const craftsmanId = craftsmanData?.id;

      console.log('Dashboard: Craftsman data for documents:', craftsmanData);
      console.log('Dashboard: Craftsman ID for documents:', craftsmanId);

      if (!craftsmanId) {
        console.error('Dashboard: No craftsman ID available for documents');
        return;
      }

      const response = await fetcher(`/api/documents?craftsman_id=${craftsmanId}`);

      if (response.ok) {
        const data = await response.json();
        const documents = data.data || data;
        const count = Array.isArray(documents) ? documents.length : 0;
        console.log('Dashboard: Document count received:', count);
        setDocumentCount(count);
      } else {
        console.error('Dashboard: Failed to fetch documents:', response.status);
      }
    } catch (err) {
      console.error('Dashboard: Error fetching document count:', err);
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
        loadCustomerCount(); // Load customer count
        loadInvoiceCount(); // Load invoice count
        loadDocumentCount(); // Load document count
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
      const craftsmanResponse = craftsmanRes.ok ? await craftsmanRes.json() : null;

      // Handle standardized API response format
      const craftsmanData = craftsmanResponse?.data !== undefined ? craftsmanResponse.data : craftsmanResponse;

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#0a0a0a]">
      <main className="flex-grow container mx-auto px-5 py-8 max-w-7xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-screen animate-fade-in">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#ffcb00]"></div>
          </div>
        ) : !user ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center py-16"
          >
            <h1 className="text-5xl font-bold mb-6 font-heading tracking-tight">
              <span className="bg-gradient-to-r from-[#ffcb00] via-[#ffdb4d] to-[#e6b800] bg-clip-text text-transparent">Willkommen bei ZIMMR</span>
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
              Die intelligente Plattform für Fliesenleger, um Termine, Kunden und Materialien effizient zu verwalten.
            </p>
            <div className="flex gap-6 justify-center">
              <Link
                href="/auth/login"
                className="px-8 py-4 bg-[#ffcb00] hover:bg-[#e6b800] text-black font-bold rounded-xl shadow-lg hover:shadow-[#ffcb00]/20 focus:outline-none transition-all duration-300 transform hover:-translate-y-1"
              >
                Anmelden
              </Link>
              <Link
                href="/auth/register"
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl backdrop-blur-sm border border-white/10 focus:outline-none transition-all duration-300 transform hover:-translate-y-1"
              >
                Registrieren
              </Link>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-10"
            >
              <div className="mb-2">
                <h1 className="text-4xl font-bold mb-2 tracking-tight text-white">
                  {getGreeting()}
                  <span className="text-[#ffcb00]">
                    {getUserName()}
                  </span>
                </h1>
                <p className="text-white/60 text-lg">
                  {craftsman ? `Hier ist der Überblick über Ihre Projekte` : 'Willkommen in Ihrem Dashboard'}
                </p>
              </div>
            </motion.div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
              {/* Left Column: Next Appointment & Stats */}
              <div className="lg:col-span-1 flex flex-col gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                >
                  <NextAppointment appointment={upcomingAppointments && upcomingAppointments.length > 0 ? upcomingAppointments[0] : null} />
                </motion.div>

                <div className="grid grid-cols-1 gap-4">
                  <StatsCard
                    title="Kunden"
                    value={customerCount}
                    label="Aktive Kunden"
                    link="/customers"
                    delay={0.2}
                    icon={
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                      </svg>
                    }
                  />
                  <StatsCard
                    title="Rechnungen"
                    value={invoiceCount}
                    label="Erstellte Rechnungen"
                    link="/invoices"
                    delay={0.3}
                    icon={
                      <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    }
                  />
                </div>
              </div>

              {/* Middle & Right Column: Finance Chart & Finance Card */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 h-full"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                          <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-4">
                            <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                          </div>
                          <h2 className="text-xl font-semibold text-white">Jahresumsatz</h2>
                        </div>
                        <Link href="/finances" className="text-[#ffcb00] hover:text-[#e6b800] transition-colors flex items-center text-sm font-medium">
                          Details
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
                          </svg>
                        </Link>
                      </div>

                      {financeLoading ? (
                        <div className="flex justify-center items-center h-[300px]">
                          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
                        </div>
                      ) : financeStats ? (
                        <div>
                          <div style={{ width: '100%', height: '300px', marginBottom: '1rem' }}>
                            <RevenueChart
                              monthlyPaid={financeStats.monthly?.paid || []}
                              monthlyOpen={financeStats.monthly?.open || []}
                              yearlyGoal={financeStats.goal?.goal_amount || null}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-20 text-white/40">
                          Keine Finanzdaten verfügbar.
                        </div>
                      )}
                    </motion.div>
                  </div>

                  <div className="md:col-span-1">
                    <FinanceCard />
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="w-1 h-6 bg-[#ffcb00] rounded-full mr-3"></span>
                    Schnellzugriff
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickActionCard
                      title="KI-Assistent"
                      link="/onboarding/phone-assistant"
                      delay={0.4}
                      icon={
                        <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                        </svg>
                      }
                    />
                    <QuickActionCard
                      title="Neuer Termin"
                      link="/appointments/new"
                      delay={0.5}
                      icon={
                        <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                        </svg>
                      }
                    />
                    <QuickActionCard
                      title="Neuer Kunde"
                      link="/customers/new"
                      delay={0.6}
                      icon={
                        <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 0112 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
                        </svg>
                      }
                    />
                    <QuickActionCard
                      title="Neue Rechnung"
                      link="/invoices/new"
                      delay={0.7}
                      icon={
                        <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}