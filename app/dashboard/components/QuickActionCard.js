'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function QuickActionCard({ title, icon, link, delay = 0 }) {
    return (
        <Link href={link}>
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay }}
                whileHover={{ scale: 1.05, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                whileTap={{ scale: 0.95 }}
                className="bg-white/5 text-white p-4 rounded-xl flex flex-col items-center justify-center text-center transition-colors duration-200 h-32 border border-white/5 hover:border-white/20"
            >
                <div className="p-3 bg-[#ffcb00]/20 rounded-full mb-3">
                    {icon}
                </div>
                <span className="font-medium">{title}</span>
            </motion.div>
        </Link>
    );
}
