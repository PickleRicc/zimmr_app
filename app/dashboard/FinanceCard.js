// FinanceCard.js - Dashboard finance summary card
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

import { motion } from 'framer-motion';

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
    <Link href="/finances" className="block h-full">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        whileHover={{ y: -5, transition: { duration: 0.2 } }}
        className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-colors duration-300 hover:bg-white/10 h-full flex flex-col"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="p-3 bg-[#ffcb00]/20 rounded-full mr-2">
            <svg className="w-6 h-6 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <span className="font-semibold text-white text-xl">Finanzen</span>
        </div>

        <div className="flex-grow flex flex-col justify-center">
          {loading ? (
            <div className="text-white/60 text-sm animate-pulse">Lädt Finanzdaten...</div>
          ) : error ? (
            <div className="text-red-400 text-sm flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              {error}
            </div>
          ) : (stats && stats.goal) ? (
            <>
              <div className="flex justify-between items-end mb-2">
                <span className="text-white/60 text-sm">Jahresziel</span>
                <span className="text-white font-bold">€{Number(stats.goal.goal_amount).toLocaleString('de-DE')}</span>
              </div>

              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, delay: 0.5, type: "spring" }}
                  className={`${progressColor} h-full rounded-full`}
                />
              </div>

              <div className="flex justify-between text-xs mb-4">
                <span className="text-white/80">{progress}% erreicht</span>
                <span className="text-white/80">noch €{Math.max(0, Number(stats.goal.goal_amount) - Number(stats.totalRevenue)).toLocaleString('de-DE')}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-xs text-white/50">Einnahmen</div>
                  <div className="text-green-400 font-medium">€{Number(stats.totalRevenue).toLocaleString('de-DE')}</div>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <div className="text-xs text-white/50">Offen</div>
                  <div className="text-orange-300 font-medium">€{Number(stats.totalOpen).toLocaleString('de-DE')}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/60 text-sm text-center py-4">
              Kein Umsatzziel festgelegt.
              <br />
              <span className="text-[#ffcb00] text-xs">Tippen zum Einrichten</span>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
