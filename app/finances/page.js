"use client";
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const PERIODS = [
  { label: 'Jahr', value: 'year' },
  { label: 'Alle', value: 'all' },
];

// Helper to format month names for the chart
const formatMonth = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('de-DE', { month: 'short' });
};

export default function FinancesPage() {
  const [period, setPeriod] = useState('year');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalInput, setGoalInput] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    getFinanceStats(period)
      .then(data => {
        if (!data || !data.goal) {
          setStats({
            ...data,
            goal: null
          });
          setGoalInput('');
          setError('Noch kein Finanzziel festgelegt. Bitte fügen Sie unten Ihr Umsatzziel hinzu.');
        } else {
          setStats(data);
          setGoalInput(data.goal.goal_amount || '');
          setError('');
        }
      })
      .catch(() => setError('Finanzstatistiken konnten nicht geladen werden'))
      .finally(() => setLoading(false));
  }, [period]);

  const handleGoalSave = async () => {
    if (!goalInput || isNaN(goalInput)) {
      setError('Bitte geben Sie eine gültige Zahl ein');
      return;
    }
    setLoading(true);
    try {
      await setFinanceGoal(goalInput, period);
      setEditing(false);
      setError('');
      // Refresh stats
      const data = await getFinanceStats(period);
      setStats(data);
      setGoalInput(data.goal?.goal_amount || '');
    } catch {
      setError('Ziel konnte nicht aktualisiert werden');
    } finally {
      setLoading(false);
    }
  };

  // Progress calculation
  const progress = stats?.goal && stats.totalRevenue
    ? Math.min(100, Math.round((Number(stats.totalRevenue) / Number(stats.goal.goal_amount)) * 100))
    : 0;
  
  // Use consistent brand colors for progress bar
  let progressColor = 'bg-[#ffcb00]';
  if (progress < 30) progressColor = 'bg-red-500';
  else if (progress < 70) progressColor = 'bg-amber-500';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
      <Header title="Finanzen" />
      <main className="flex-grow container mx-auto px-5 py-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 md:p-8 max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">
                Finanzen
              </h1>
              <p className="text-white/70">Verfolgen Sie Ihre Umsatzziele & Einnahmen</p>
            </div>
            <div className="flex gap-2 mt-3 md:mt-0">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium focus:outline-none transition-colors ${period === p.value ? 'bg-[#ffcb00] text-black' : 'bg-white/5 text-white hover:bg-[#ffcb00]/20'}`}
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Revenue Target Setting */}
          <div className="bg-white/10 rounded-xl p-5 shadow-md mb-6 border border-white/10">
            <h2 className="text-lg font-medium text-white mb-3">Umsatzziel festlegen</h2>
            <div className="flex items-center gap-3">
              {editing ? (
                <div key="editing-mode" className="w-full flex items-center gap-3">
                  <div className="relative rounded-md flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-white/70 sm:text-sm">€</span>
                    </div>
                    <input
                      type="text"
                      className="bg-white/5 border border-white/10 text-white block w-full rounded-md pl-7 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#ffcb00]/50 focus:border-[#ffcb00]/50"
                      placeholder="0.00"
                      value={goalInput}
                      onChange={(e) => setGoalInput(e.target.value)}
                    />
                  </div>
                  <button
                    className="px-4 py-2 bg-[#ffcb00] hover:bg-[#e6b800] text-black rounded-md text-sm font-medium"
                    onClick={handleGoalSave}
                  >
                    Speichern
                  </button>
                  <button
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded text-sm font-medium"
                    onClick={() => {
                      setEditing(false);
                      setGoalInput(stats?.goal?.goal_amount || '');
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <div key="display-mode" className="w-full flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-white/70 mb-1">{period === 'year' ? 'Jährliches' : 'Gesamtes'} Ziel:</div>
                    <div className="text-xl font-bold text-white">
                      {stats?.goal ? `€${Number(stats.goal.goal_amount).toLocaleString('de-DE')}` : 'Kein Ziel festgelegt'}
                    </div>
                  </div>
                  <button 
                    className="px-4 py-2 bg-[#ffcb00] hover:bg-[#e6b800] text-black rounded-md text-sm font-medium flex items-center" 
                    onClick={() => setEditing(true)}
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Ziel anpassen
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 backdrop-blur-sm text-white rounded-xl border border-red-500/30 shadow-lg flex items-center">
              <svg className="w-5 h-5 mr-2 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffcb00]"></div>
            </div>
          ) : (
            <>
              <div className="bg-white/5 rounded-xl p-5 shadow-md mb-6">
                {stats?.goal && (
                  <>
                    <h2 className="text-lg font-medium text-white mb-3">Fortschritt zum Umsatzziel</h2>
                    <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden mb-2">
                      <div
                        className={`${progressColor} h-4 transition-all duration-500`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-sm text-white/80 mb-4">
                      <span className="font-medium text-white">{progress}%</span> erreicht (
                      €{Number(stats.totalRevenue).toLocaleString('de-DE')} von €{Number(stats.goal.goal_amount).toLocaleString('de-DE')}
                      )
                    </div>
                  </>
                )}
                <div className="flex flex-col sm:flex-row gap-4 mt-6">
                  <div className="flex-1 bg-white/5 rounded-lg p-4 text-center">
                    <div className="text-xs text-white/70 mb-1 uppercase tracking-wider">Umsatz (bezahlt)</div>
                    <div className="text-xl font-bold text-[#ffcb00]">€{stats ? Number(stats.totalRevenue).toLocaleString('de-DE') : '0'}</div>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-lg p-4 text-center">
                    <div className="text-xs text-white/70 mb-1 uppercase tracking-wider">Ausstehend (unbezahlt)</div>
                    <div className="text-xl font-bold text-[#ffcb00]">€{stats && stats.totalOpen ? Number(stats.totalOpen).toLocaleString('de-DE') : '0'}</div>
                  </div>
                </div>
              </div>

              {/* Monthly breakdown chart removed per client request */}
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}