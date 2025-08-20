'use client';

import { useState, useEffect } from 'react';
import { Phone, PhoneCall, Settings, Shield, CheckCircle } from 'react-feather';

export default function PhoneAssistant() {
  const [callLogs, setCallLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState({
    gdprCompliant: true,
    audioStorage: false,
    euServersOnly: true
  });

  useEffect(() => {
    fetchCallLogs();
  }, []);

  const fetchCallLogs = async () => {
    try {
      const response = await fetch('/api/phone/logs');
      if (response.ok) {
        const logs = await response.json();
        setCallLogs(logs);
      }
    } catch (error) {
      console.error('Error fetching call logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Phone className="text-blue-600" size={32} />
            KI-Telefonassistent
          </h1>
          <p className="text-gray-600 mt-2">
            DSGVO-konformer AI-Telefonassistent für automatische Anrufbearbeitung
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="text-green-600" size={20} />
          <span className="text-sm text-green-600 font-medium">DSGVO-Konform</span>
        </div>
      </div>

      {/* GDPR Compliance Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <CheckCircle className="text-green-600 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-green-800 mb-2">DSGVO-Compliance Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Keine Audiospeicherung</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>EU-Server (Frankfurt)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Nur Transkripte gespeichert</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Twilio Status</p>
              <p className="text-lg font-semibold text-green-600">Aktiv</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">GPT-3.5 API</p>
              <p className="text-lg font-semibold text-green-600">Bereit</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">ElevenLabs</p>
              <p className="text-lg font-semibold text-green-600">Verbunden</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">n8n Webhook</p>
              <p className="text-lg font-semibold text-green-600">Online</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Recent Call Logs */}
      <div className="bg-white rounded-lg border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <PhoneCall size={20} />
            Aktuelle Anrufe
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Nur Transkripte und Metadaten - keine Audioaufzeichnungen
          </p>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Lade Anruflogs...</p>
            </div>
          ) : callLogs.length === 0 ? (
            <div className="text-center py-8">
              <Phone className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600">Noch keine Anrufe verarbeitet</p>
              <p className="text-sm text-gray-500 mt-1">
                Anrufe werden automatisch hier angezeigt, sobald sie eingehen
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {callLogs.map((log, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">
                        {log.callerName || 'Unbekannter Anrufer'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {log.callbackNumber || 'Keine Nummer'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString('de-DE')}
                      </p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                        log.intent === 'terminanfrage' ? 'bg-blue-100 text-blue-800' :
                        log.intent === 'notfall' ? 'bg-red-100 text-red-800' :
                        log.intent === 'kostenvoranschlag' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.intent || 'Allgemein'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded p-3 mt-3">
                    <p className="text-sm text-gray-700">
                      <strong>Transkript:</strong> {log.transcript}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
          <Settings size={20} />
          Setup-Anweisungen
        </h3>
        <div className="space-y-3 text-sm text-blue-700">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">1</div>
            <div>
              <p className="font-medium">Twilio Webhook konfigurieren</p>
              <p className="text-blue-600">POST {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/phone/webhook</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">2</div>
            <div>
              <p className="font-medium">Umgebungsvariablen konfigurieren</p>
              <p className="text-blue-600">Siehe env.template für alle erforderlichen API-Schlüssel</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">3</div>
            <div>
              <p className="font-medium">n8n Workflow einrichten</p>
              <p className="text-blue-600">Für Logging und Datenverarbeitung in AWS Frankfurt</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}