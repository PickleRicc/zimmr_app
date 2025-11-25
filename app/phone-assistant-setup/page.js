'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

export default function PhoneAssistantSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState(1);

  // Use the same auth pattern as dashboard
  const { user, loading: authLoading } = useAuth();
  const fetcher = useAuthedFetch();

  const provisionNumber = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use authenticated fetch (same as dashboard)
      const response = await fetcher('/api/assistant/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to provision number');
      }

      setResult(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  // Show loading while checking authentication (same as dashboard)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated (same as dashboard)
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access the AI Phone Assistant setup.</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📞 AI Phone Assistant Setup
            </h1>
            <p className="text-gray-600">
              Set up your AI phone assistant to handle customer calls automatically
            </p>
          </div>

          {/* Step Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className={`flex items-center ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  1
                </div>
                <span className="ml-2 font-medium">Provision Number</span>
              </div>
              <div className="flex-1 h-1 mx-4 bg-gray-300">
                <div className={`h-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              </div>
              <div className={`flex items-center ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  2
                </div>
                <span className="ml-2 font-medium">Forward Calls</span>
              </div>
              <div className="flex-1 h-1 mx-4 bg-gray-300">
                <div className={`h-full ${step >= 3 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              </div>
              <div className={`flex items-center ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'}`}>
                  3
                </div>
                <span className="ml-2 font-medium">Test & Activate</span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">❌ Error</p>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Step 1: Provision Number */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Step 1: Get Your AI Assistant Number
                </h2>
                <p className="text-gray-700 mb-4">
                  We'll purchase a German phone number and configure it to work with your AI assistant.
                  This number will handle all incoming calls automatically.
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
                  <li>AI answers in German</li>
                  <li>Checks your real calendar</li>
                  <li>Books appointments automatically</li>
                  <li>No audio stored (GDPR compliant)</li>
                </ul>
                
                <button
                  onClick={provisionNumber}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Provisioning Number...
                    </span>
                  ) : (
                    '🚀 Provision Assistant Number'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Forward Calls */}
          {step === 2 && result && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  ✅ Success! Number Provisioned
                </h2>
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">Your AI Assistant Number:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white px-4 py-3 rounded border text-lg font-mono">
                      {result.twilioNumberFormatted}
                    </code>
                    <button
                      onClick={() => copyToClipboard(result.twilioNumber)}
                      className="bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Step 2: Forward Your Personal Number
                </h2>
                <p className="text-gray-700 mb-4">
                  Use your phone's dialer to forward calls to your AI assistant:
                </p>

                <div className="space-y-4">
                  {Object.entries(result.instructions).map(([key, instruction]) => (
                    <div key={key} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-yellow-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {key.replace('step', '')}
                      </div>
                      <p className="text-gray-700">{instruction}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 bg-white rounded-lg p-4 border border-yellow-300">
                  <p className="text-sm text-gray-600 mb-2">📱 Dial this code:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 px-4 py-3 rounded border text-2xl font-mono font-bold text-center">
                      {result.mmiCodes.generic}
                    </code>
                    <button
                      onClick={() => copyToClipboard(result.mmiCodes.generic)}
                      className="bg-yellow-500 text-white px-4 py-3 rounded hover:bg-yellow-600"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Works with Telekom, Vodafone, O2, and other German carriers
                  </p>
                </div>

                <div className="mt-4 bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-semibold">⚠️ To deactivate forwarding:</span>
                  </p>
                  <code className="block bg-white px-4 py-2 rounded border text-lg font-mono text-center">
                    {result.deactivateCode}
                  </code>
                </div>

                <button
                  onClick={() => setStep(3)}
                  className="w-full mt-6 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  ✓ I've Forwarded My Calls
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Test */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Step 3: Test Your AI Assistant
                </h2>
                <p className="text-gray-700 mb-4">
                  Call your personal number from another phone to test the assistant:
                </p>

                <ol className="list-decimal list-inside text-gray-700 space-y-3 mb-6">
                  <li>Call your personal number from another phone</li>
                  <li>The AI will answer in German</li>
                  <li>Try booking an appointment</li>
                  <li>Check your dashboard for the new appointment</li>
                </ol>

                <div className="bg-white rounded-lg p-4 border border-purple-200 mb-6">
                  <p className="text-sm text-gray-600 mb-2">💬 Example conversation:</p>
                  <div className="space-y-2 text-sm">
                    <p><strong>AI:</strong> "Guten Tag! Wie kann ich helfen?"</p>
                    <p><strong>You:</strong> "Ich brauche einen Termin."</p>
                    <p><strong>AI:</strong> "Gerne! Wann passt es Ihnen?"</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => router.push('/appointments')}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    📅 View Appointments
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition"
                  >
                    🏠 Go to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">ℹ️ Need Help?</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><strong>Issue with forwarding?</strong> Make sure you dial the code exactly as shown, including * and # symbols.</p>
            <p><strong>Not working?</strong> Try calling from a different phone to test. It may take a minute for forwarding to activate.</p>
            <p><strong>Want to disable?</strong> Dial the deactivation code shown above.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
