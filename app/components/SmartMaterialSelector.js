'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, TrendingUp, Clock } from 'react-feather';

export default function SmartMaterialSelector({ 
  serviceType,
  projectDescription,
  craftsmanId,
  onMaterialSelected,
  selectedMaterials = []
}) {
  const [materials, setMaterials] = useState([]);
  const [smartSuggestions, setSmartSuggestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    fetchMaterials();
    if (serviceType && projectDescription) {
      fetchSmartSuggestions();
    }
  }, [serviceType, projectDescription, craftsmanId]);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/materials');
      const data = await response.json();
      setMaterials(data.data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
    }
  };

  const fetchSmartSuggestions = async () => {
    if (!serviceType || !projectDescription) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/materials/smart-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          projectDescription,
          craftsmanId
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setSmartSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching smart suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(material =>
    material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleMaterialSelect = (material, quantity = 1) => {
    const materialWithQuantity = {
      ...material,
      quantity,
      totalPrice: material.price_per_unit * quantity
    };
    onMaterialSelected?.(materialWithQuantity);
  };

  const isSelected = (materialId) => {
    return selectedMaterials.some(m => m.id === materialId);
  };

  return (
    <div className="space-y-4">
      {/* Smart Suggestions */}
      {showSuggestions && smartSuggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-blue-600" size={20} />
              <h3 className="font-semibold text-blue-900">Intelligente Material-Vorschläge</h3>
            </div>
            <button
              onClick={() => setShowSuggestions(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Ausblenden
            </button>
          </div>
          
          {loading ? (
            <div className="flex items-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm">Analysiere ähnliche Projekte...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {smartSuggestions.map((suggestion, index) => (
                <div key={index} className="bg-white border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{suggestion.name}</h4>
                      <p className="text-sm text-gray-600">{suggestion.category}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-sm font-medium text-blue-600">
                          €{suggestion.price_per_unit?.toFixed(2)}/{suggestion.unit}
                        </span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          {suggestion.usage_frequency}% der ähnlichen Projekte
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMaterialSelect(suggestion, suggestion.suggested_quantity || 1)}
                      disabled={isSelected(suggestion.id)}
                      className={`ml-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        isSelected(suggestion.id)
                          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isSelected(suggestion.id) ? 'Ausgewählt' : 'Hinzufügen'}
                    </button>
                  </div>
                  {suggestion.reasoning && (
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      💡 {suggestion.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search and Material List */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Search className="text-gray-400" size={20} />
            <h3 className="font-semibold text-gray-900">Material-Katalog</h3>
          </div>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Materialien suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredMaterials.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Keine Materialien gefunden</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:underline text-sm mt-2"
                >
                  Suche zurücksetzen
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredMaterials.map((material) => (
                <div key={material.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{material.name}</h4>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          {material.category}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium text-green-600">
                          €{material.price_per_unit?.toFixed(2)}/{material.unit}
                        </span>
                        {material.stock_quantity !== undefined && (
                          <span className={`${
                            material.stock_quantity > 10 ? 'text-green-600' : 
                            material.stock_quantity > 0 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {material.stock_quantity > 0 ? `${material.stock_quantity} verfügbar` : 'Nicht verfügbar'}
                          </span>
                        )}
                      </div>
                      
                      {material.description && (
                        <p className="text-sm text-gray-500 mt-1">{material.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <input
                        type="number"
                        min="1"
                        defaultValue="1"
                        className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center"
                        id={`quantity-${material.id}`}
                      />
                      <button
                        onClick={() => {
                          const quantity = parseInt(document.getElementById(`quantity-${material.id}`).value) || 1;
                          handleMaterialSelect(material, quantity);
                        }}
                        disabled={isSelected(material.id) || (material.stock_quantity !== undefined && material.stock_quantity === 0)}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                          isSelected(material.id)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : material.stock_quantity === 0
                            ? 'bg-red-100 text-red-500 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        <Plus size={14} />
                        {isSelected(material.id) ? 'Ausgewählt' : 'Hinzufügen'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently Used Materials */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="text-gray-400" size={16} />
          <h4 className="font-medium text-gray-700">Zuletzt verwendet</h4>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* This would be populated with recently used materials */}
          <span className="text-sm text-gray-500">Keine kürzlich verwendeten Materialien</span>
        </div>
      </div>
    </div>
  );
}
