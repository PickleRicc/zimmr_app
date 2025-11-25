'use client';

import { motion } from 'framer-motion';

export default function StepSetup({ onNext, loading }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">
                    Was macht der KI-Assistent?
                </h2>
                <ul className="space-y-3 text-white/80">
                    {[
                        'Beantwortet Anrufe automatisch auf Deutsch',
                        'Prüft Ihre Verfügbarkeit in Echtzeit',
                        'Bucht Termine automatisch in Ihrem Kalender',
                        'DSGVO-konform (keine Audioaufnahmen gespeichert)'
                    ].map((item, index) => (
                        <motion.li
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + index * 0.1 }}
                            className="flex items-start"
                        >
                            <svg className="w-5 h-5 text-[#ffcb00] mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                            </svg>
                            <span>{item}</span>
                        </motion.li>
                    ))}
                </ul>
            </div>

            <div className="bg-white/5 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-3">Wie funktioniert es?</h3>
                <ol className="space-y-2 text-white/70">
                    <li className="flex">
                        <span className="font-bold text-[#ffcb00] mr-2">1.</span>
                        <span>Wir weisen Ihnen eine deutsche Telefonnummer zu</span>
                    </li>
                    <li className="flex">
                        <span className="font-bold text-[#ffcb00] mr-2">2.</span>
                        <span>Sie leiten Ihre persönliche Nummer weiter (reversibel)</span>
                    </li>
                    <li className="flex">
                        <span className="font-bold text-[#ffcb00] mr-2">3.</span>
                        <span>Anrufe werden automatisch von der KI beantwortet</span>
                    </li>
                </ol>
            </div>

            <button
                onClick={onNext}
                disabled={loading}
                className="w-full bg-[#ffcb00] text-black py-4 px-6 rounded-lg font-semibold hover:bg-[#e6b800] disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg hover:shadow-[#ffcb00]/20 transform hover:-translate-y-0.5 active:translate-y-0"
            >
                {loading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Telefonnummer wird eingerichtet...
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                        </svg>
                        Jetzt Assistenten aktivieren
                    </>
                )}
            </button >

            <p className="text-center text-white/50 text-sm">
                Einrichtung dauert nur 2 Minuten • Jederzeit deaktivierbar
            </p>
        </motion.div >
    );
}
