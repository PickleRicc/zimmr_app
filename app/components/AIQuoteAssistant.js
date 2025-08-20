'use client';

import React, { useState } from 'react';
import { Zap, Target, ChevronDown, ChevronUp } from 'react-feather';

export default function AIQuoteAssistant({ 
  serviceType, 
  projectDescription, 
  onSuggestionsReceived, 
  onTextGenerated 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  const generateSuggestions = async (type) => {
    if (!projectDescription?.trim()) {
      alert('Bitte geben Sie eine Projektbeschreibung ein, bevor Sie KI-Vorschläge anfordern.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/quotes/ai-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          projectDescription
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data);
        if (type === 'line_items') {
          console.log('Calling onSuggestionsReceived with:', data.suggestions);
          onSuggestionsReceived?.(data.suggestions);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('AI suggestions error:', error);
      alert('Fehler beim Verbinden mit der KI. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const applySuggestion = (suggestion) => {
    console.log('Applying suggestion:', suggestion);
    console.log('Unit price:', suggestion.unitPrice);
    onSuggestionsReceived?.([suggestion]);
  };

  if (!serviceType || !projectDescription) {
    return (
      <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-[#ffcb00] p-2 rounded-lg">
            <Zap className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">KI-Angebots-Assistent</h3>
            <p className="text-sm text-gray-700">Intelligente Vorschläge für Ihr Angebot</p>
          </div>
        </div>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>📋 Voraussetzungen:</strong> Bitte füllen Sie "Service-Art" und "Projektbeschreibung" aus, 
            um KI-Vorschläge zu erhalten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg overflow-hidden">
      <div 
        className="p-4 cursor-pointer flex items-center justify-between bg-yellow-100 hover:bg-yellow-150 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-[#ffcb00] p-2 rounded-lg">
            <Zap className="h-5 w-5 text-black" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">KI-Angebots-Assistent</h3>
            <p className="text-sm text-gray-700">Intelligente Vorschläge für Ihr Angebot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
            DSGVO-konform
          </span>
          {isExpanded ? <ChevronUp className="h-5 w-5 text-[#ffcb00]" /> : <ChevronDown className="h-5 w-5 text-[#ffcb00]" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 border-t border-yellow-200">
          <div className="bg-white rounded-lg border border-yellow-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-[#ffcb00]" />
              <h4 className="font-medium text-gray-900">Intelligente Positionen</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Lassen Sie die KI basierend auf Ihrer Projektbeschreibung passende Angebotspositionen vorschlagen.
            </p>
            
            <button
              onClick={() => generateSuggestions('line_items')}
              disabled={loading}
              className="w-full bg-[#ffcb00] hover:bg-yellow-500 disabled:bg-yellow-300 text-black py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <React.Fragment>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  <span>KI analysiert...</span>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Zap size={16} />
                  <span>Intelligente Positionen vorschlagen</span>
                </React.Fragment>
              )}
            </button>
          </div>

          {suggestions && suggestions.suggestions && suggestions.suggestions.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">KI-Vorschläge</h4>
                <span className="text-sm text-gray-700 font-medium">
                  Geschätzt: €{suggestions.estimatedTotal?.toFixed(2) || '0.00'}
                </span>
              </div>
              
              {suggestions.suggestions.map((suggestion, index) => (
                <div key={`suggestion-${index}`} className="bg-white border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-yellow-100 text-gray-800 px-2 py-1 rounded">
                          {suggestion.category || 'Material'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round((suggestion.confidence || 0.8) * 100)}% Vertrauen
                        </span>
                      </div>
                      <p className="font-medium text-gray-900">{suggestion.description}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {suggestion.quantity} {suggestion.unit} × €{(suggestion.unitPrice || 0).toFixed(2)} = €{(suggestion.totalPrice || 0).toFixed(2)}
                      </p>
                      {suggestion.reasoning && (
                        <p className="text-xs text-gray-600 mt-1">💡 {suggestion.reasoning}</p>
                      )}
                    </div>
                    <button
                      onClick={() => applySuggestion(suggestion)}
                      className="ml-3 bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm font-medium transition-colors"
                    >
                      Übernehmen
                    </button>
                  </div>
                </div>
              ))}

              {suggestions.recommendations && suggestions.recommendations.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
                  <h5 className="font-medium text-yellow-800 mb-2">📋 Zusätzliche Empfehlungen:</h5>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {suggestions.recommendations.map((rec, index) => (
                      <li key={`rec-${index}`}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-xs text-gray-700">
              <strong>🔒 DSGVO-konform:</strong> Alle Daten werden nur zur Verbesserung Ihrer Angebote verwendet. 
              Keine Kundendaten werden an Dritte weitergegeben.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
