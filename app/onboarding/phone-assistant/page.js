'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useAuthedFetch } from '../../../lib/utils/useAuthedFetch';
import { motion, AnimatePresence } from 'framer-motion';
import StepSetup from './components/StepSetup';
import StepForwarding from './components/StepForwarding';
import StepComplete from './components/StepComplete';

export default function PhoneAssistantOnboarding() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const fetcher = useAuthedFetch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const setupAssistant = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetcher('/api/assistant/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Fehler beim Einrichten des Assistenten');
      }

      setResult(data);
      setCurrentStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffcb00] mx-auto mb-4"></div>
          <p className="text-white/60">Wird geladen...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] flex items-center justify-center p-4">
        <div className="text-center bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl p-8 max-w-md border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-4">Anmeldung erforderlich</h2>
          <p className="text-white/70 mb-6">Bitte melden Sie sich an, um den KI-Telefonassistenten einzurichten.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-[#ffcb00] text-black px-6 py-3 rounded-lg hover:bg-[#e6b800] transition font-medium"
          >
            Zur Anmeldung
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#121212] to-[#1a1a1a] p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 flex items-center text-white/70 hover:text-white transition group"
        >
          <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück zum Dashboard
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl p-8 border border-white/10 overflow-hidden"
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="inline-block p-4 bg-[#ffcb00]/20 rounded-full mb-4"
            >
              <svg className="w-12 h-12 text-[#ffcb00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
            </motion.div>
            <h1 className="text-3xl font-bold text-white mb-3 flex items-center justify-center gap-3">
              KI-Telefonassistent
            </h1>
            <p className="text-white/70 text-lg">
              Ihr intelligenter Assistent beantwortet Anrufe automatisch
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-4">
              {[1, 2, 3].map((step, index) => (
                <div key={step} className="flex items-center">
                  {index > 0 && (
                    <div className={`h-1 w-16 mx-2 transition-colors duration-500 ${currentStep >= step ? 'bg-[#ffcb00]' : 'bg-white/10'}`}></div>
                  )}
                  <div className={`flex items-center ${currentStep >= step ? 'text-[#ffcb00]' : 'text-white/30'}`}>
                    <motion.div
                      animate={{
                        backgroundColor: currentStep >= step ? '#ffcb00' : 'rgba(255, 255, 255, 0.1)',
                        color: currentStep >= step ? '#000000' : 'rgba(255, 255, 255, 0.5)',
                        scale: currentStep === step ? 1.1 : 1
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors duration-300"
                    >
                      {step}
                    </motion.div>
                    <span className={`ml-2 font-medium hidden sm:inline transition-opacity duration-300 ${currentStep >= step ? 'opacity-100' : 'opacity-50'}`}>
                      {step === 1 ? 'Einrichten' : step === 2 ? 'Weiterleiten' : 'Fertig'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4 overflow-hidden"
              >
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <div>
                    <p className="text-red-400 font-medium">Fehler</p>
                    <p className="text-red-300 text-sm mt-1">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Steps Content */}
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <StepSetup key="step1" onNext={setupAssistant} loading={loading} />
            )}

            {currentStep === 2 && result && (
              <StepForwarding key="step2" result={result} onNext={() => setCurrentStep(3)} />
            )}

            {currentStep === 3 && (
              <StepComplete
                key="step3"
                onDashboard={() => router.push('/dashboard')}
                onAppointments={() => router.push('/appointments')}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
