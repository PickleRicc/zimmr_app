// FinanceCard.js - Dashboard finance summary card
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

export default function FinanceCard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const fetcher = useAuthedFetch();

  useEffect(() => {
    const loadFinanceStats = async () => {
      try {
        setLoading(true);
        const response = await fetcher('/api/finances');
        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}`);
        }
        const responseData = await response.json();
        const financeData = responseData.data || responseData;
        setStats(financeData);
      } catch (err) {
        console.error('FinanceCard: Error fetching finance stats:', err);
        setError('Kann Finanzen nicht laden');
      } finally {
        setLoading(false);
      }
    };

    loadFinanceStats();
  }, []);

  const progress = stats?.goal && stats.totalRevenue
    ? Math.min(100, Math.round((Number(stats.totalRevenue) / Number(stats.goal.goal_amount)) * 100))
    : 0;
  let progressColor = 'bg-green-500';
  if (progress < 50) progressColor = 'bg-red-500';
  else if (progress < 80) progressColor = 'bg-orange-400';

  return (
    <Link href="/finances" className="bg-white/5 hover:bg-white/10 transition-colors rounded-2xl shadow-xl border border-white/10 p-5 flex flex-col gap-3 min-w-[220px] flex-1">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-2 bg-[#ffcb00]/20 rounded-full">
          <svg className="w-5 h-5 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </div>
        <span className="font-bold text-white text-lg">Finanzen</span>
      </div>
      {/* TODO: replace placeholder once /api/finances/stats is implemented */}
      {loading ? (
        <div className="text-white/60 text-sm">Lädt...</div>
      ) : error ? (
        <div className="text-red-400 text-sm">{error}</div>
      ) : (stats && stats.goal) ? (
        <>
          <div className="text-white/80 text-sm mb-1">Ziel: €{Number(stats.goal.goal_amount).toLocaleString('de-DE')}</div>
          <div className="w-full h-2 bg-white/10 rounded overflow-hidden mb-1">
            <div className={`${progressColor} h-2 transition-all duration-500`} style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-white mb-1">{progress}% erreicht</div>
          <div className="flex gap-2 text-xs">
            <span className="text-green-400">Einnahmen: €{Number(stats.totalRevenue).toLocaleString('de-DE')}</span>
            <span className="text-orange-300">Offen: €{Number(stats.totalOpen).toLocaleString('de-DE')}</span>
          </div>
        </>
      ) : (
        <div className="text-white/60 text-sm">Kein Ziel gesetzt</div>
      )}
    </Link>
  );
}
