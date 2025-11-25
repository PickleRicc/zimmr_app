'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function StatsCard({ title, value, label, icon, link, color = 'text-[#ffcb00]', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10 transition-colors duration-300 hover:bg-white/10 group"
    >
      <div className="flex items-center mb-4">
        <div className={`p-3 ${color.replace('text-', 'bg-')}/20 rounded-full mr-4 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-white">{title}</h2>
      </div>
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <p className="text-white/60 mb-4">{label}</p>
      <Link href={link} className={`${color} hover:underline flex items-center text-sm group-hover:translate-x-1 transition-transform duration-300`}>
        Alle anzeigen
        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path>
        </svg>
      </Link>
    </motion.div>
  );
}
