'use client';

import { motion } from 'framer-motion';

export default function StepComplete({ onDashboard, onAppointments }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
            className="space-y-6 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-block p-6 bg-green-500/20 rounded-full mb-4"
            >
                <svg className="w-16 h-16 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
            </motion.div>

            <h2 className="text-2xl font-bold text-white mb-2">
                Ihr KI-Assistent ist aktiv!
            </h2>
            <p className="text-white/70 text-lg mb-8">
                Alle eingehenden Anrufe werden jetzt automatisch beantwortet
            </p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/5 rounded-lg p-6 text-left border border-white/10"
            >
                <h3 className="text-lg font-semibold text-white mb-4">Testen Sie Ihren Assistenten:</h3>
                <ol className="space-y-3 text-white/80">
                    <li className="flex items-start">
                        <span className="font-bold text-[#ffcb00] mr-3">1.</span>
                        <span>Rufen Sie Ihre Nummer von einem anderen Telefon an</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-bold text-[#ffcb00] mr-3">2.</span>
                        <span>Die KI wird auf Deutsch antworten</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-bold text-[#ffcb00] mr-3">3.</span>
                        <span>Versuchen Sie, einen Termin zu buchen</span>
                    </li>
                    <li className="flex items-start">
                        <span className="font-bold text-[#ffcb00] mr-3">4.</span>
                        <span>Überprüfen Sie Ihr Dashboard für neue Termine</span>
                    </li>
                </ol>
            </motion.div>

            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="flex gap-4"
            >
                <button
                    onClick={onAppointments}
                    className="flex-1 bg-white/10 text-white py-3 px-6 rounded-lg font-medium hover:bg-white/20 transition flex items-center justify-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    Termine anzeigen
                </button>
                <button
                    onClick={onDashboard}
                    className="flex-1 bg-[#ffcb00] text-black py-3 px-6 rounded-lg font-semibold hover:bg-[#e6b800] transition shadow-lg hover:shadow-[#ffcb00]/20 flex items-center justify-center"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                    Zum Dashboard
                </button>
            </motion.div>
        </motion.div>
    );
}
