'use client';

import { motion } from 'framer-motion';

export default function StepForwarding({ result, onNext }) {
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Could add a toast notification here
        alert('In die Zwischenablage kopiert!');
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
        >
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-green-500/10 border border-green-500/30 rounded-lg p-6"
            >
                <div className="flex items-center mb-4">
                    <svg className="w-6 h-6 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    <h2 className="text-xl font-semibold text-white">Nummer erfolgreich zugewiesen!</h2>
                </div>
                <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-sm text-white/60 mb-2">Ihre KI-Assistenten-Nummer:</p>
                    <div className="flex items-center gap-3">
                        <code className="flex-1 bg-white/10 px-4 py-3 rounded text-white text-lg font-mono font-bold">
                            {result.twilioNumberFormatted}
                        </code>
                        <button
                            onClick={() => copyToClipboard(result.twilioNumber)}
                            className="bg-[#ffcb00] text-black px-4 py-3 rounded hover:bg-[#e6b800] transition flex-shrink-0"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6"
            >
                <h3 className="text-lg font-semibold text-white mb-4">
                    Schritt 2: Rufweiterleitung einrichten
                </h3>
                <p className="text-white/70 mb-4">
                    Wählen Sie diesen Code auf Ihrem Handy, um alle Anrufe an den KI-Assistenten weiterzuleiten:
                </p>

                <div className="bg-white/10 rounded-lg p-5 mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-white/60">Geben Sie diesen Code ein:</p>
                        <button
                            onClick={() => copyToClipboard(result.mmiCodes.generic)}
                            className="text-[#ffcb00] hover:text-[#e6b800] transition text-sm font-medium"
                        >
                            Kopieren
                        </button>
                    </div>
                    <code className="block text-center text-3xl font-bold text-white font-mono py-3 tracking-wider">
                        {result.mmiCodes.generic}
                    </code>
                    <p className="text-xs text-white/50 text-center mt-2">
                        Funktioniert mit Telekom, Vodafone, O2
                    </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <p className="text-sm text-white/80 mb-2 flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        <span className="font-semibold">Weiterleitung deaktivieren:</span>
                    </p>
                    <code className="block text-center text-xl font-mono text-white py-2">
                        {result.deactivateCode}
                    </code>
                </div>
            </motion.div>

            <div className="flex gap-4">
                <button
                    onClick={onNext}
                    className="flex-1 bg-[#ffcb00] text-black py-3 px-6 rounded-lg font-semibold hover:bg-[#e6b800] transition shadow-lg hover:shadow-[#ffcb00]/20"
                >
                    Weiterleitung eingerichtet ✓
                </button>
            </div>
        </motion.div>
    );
}
