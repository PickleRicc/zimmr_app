import React, { useState, useEffect } from 'react';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import { useAuth } from '../../contexts/AuthContext';

export default function MaterialSelector({ selectedMaterials, onChange }) {
  // Ensure selectedMaterials is always an array
  const materials_array = Array.isArray(selectedMaterials) ? selectedMaterials : [];
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const { session } = useAuth();
  const authedFetch = useAuthedFetch();
  
  // Safe materials access function to prevent "map is not a function" errors
  const getMaterials = () => {
    return Array.isArray(materials) ? materials : [];
  };
  
  // Load all available materials once authentication is ready
  useEffect(() => {
    // Only fetch if we have an active session
    if (!session?.access_token) {
      return;
    }
    
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        const res = await authedFetch('/api/materials');
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const data = await res.json();
        
        // Handle standardized API response format
        const materialsData = data.data !== undefined ? data.data : data;
        setMaterials(Array.isArray(materialsData) ? materialsData : []);
      } catch (err) {
        console.error('Error fetching materials:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMaterials();
    // Only depend on session, not authedFetch which changes on every render
  }, [session]);

  // Add a material to the selection
  const handleAddMaterial = (materialId) => {
    console.log('handleAddMaterial called with materialId:', materialId);
    const materialsArray = getMaterials();
    const material = materialsArray.find(m => m.id === materialId);
    console.log('Found material:', material);
    if (!material) {
      console.log('Material not found!');
      return;
    }
    
    const newMaterial = {
      id: crypto.randomUUID(), // Generate a unique client-side ID for this line item
      material_id: material.id, // The actual database material ID
      name: material.name,
      unit: material.unit,
      quantity: 1,
      unit_price: material.price
    };
    
    console.log('Adding new material:', newMaterial);
    console.log('Current materials_array:', materials_array);
    const updatedMaterials = [...materials_array, newMaterial];
    console.log('Updated materials array:', updatedMaterials);
    
    onChange(updatedMaterials);
  };
  
  // Update quantity or price of a selected material
  const handleUpdateMaterial = (id, field, value) => {
    const updatedMaterials = materials_array.map(material => {
      if (material.id === id) {
        return { ...material, [field]: value };
      }
      return material;
    });
    
    // Trigger the parent component's onChange with a small delay
    // to ensure the state update is processed
    setTimeout(() => onChange(updatedMaterials), 0);
  };
  
  // Remove a material from the selection
  const handleRemoveMaterial = (id) => {
    const filteredMaterials = materials_array.filter(material => material.id !== id);
    console.log('Removing material, updated list:', filteredMaterials);
    onChange(filteredMaterials);
  };
  
  if (loading) return <div className="text-center py-4">Loading materials...</div>;
  if (error) return <div className="text-red-500 py-4">Error loading materials: {error}</div>;
  
  // Calculate subtotal
  const subtotal = materials_array.reduce((sum, material) => {
    return sum + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
  }, 0);

  // Filter materials based on search term
  const filteredMaterials = getMaterials().filter(material => 
    material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    material.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setShowDropdown(e.target.value.length > 0);
  };

  const selectMaterial = (materialId) => {
    handleAddMaterial(materialId);
    setSearchTerm('');
    setShowDropdown(false);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Materials & Services</h3>
      
      {/* Material Search & Selection */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search materials..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowDropdown(searchTerm.length > 0)}
          className="w-full bg-[#2a2a2a] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
        />
        
        {/* Dropdown with filtered results */}
        {showDropdown && filteredMaterials.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            {filteredMaterials.map(material => (
              <button
                key={material.id}
                onClick={() => selectMaterial(material.id)}
                className="w-full text-left px-4 py-3 hover:bg-[#ffcb00]/10 text-white border-b border-white/5 last:border-b-0"
              >
                <div className="font-medium">{material.name}</div>
                <div className="text-sm text-gray-400">
                  {material.unit} • €{parseFloat(material.price).toFixed(2)}
                  {material.category && <span className="ml-2 text-[#ffcb00]">({material.category})</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        
        {/* No results message */}
        {showDropdown && searchTerm && filteredMaterials.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-[#2a2a2a] border border-white/10 rounded-xl shadow-lg px-4 py-3 text-gray-400">
            No materials found for "{searchTerm}"
          </div>
        )}
      </div>
      
      {/* Selected Materials List */}
      {materials_array.length > 0 ? (
        <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0f1419]">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-[#2a2a2a]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Material</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[#ffcb00] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-[#0f1419] divide-y divide-white/10 text-white">
              {materials_array.map(material => {
                console.log('MaterialSelector rendering material:', material);
                console.log('Material unit_price:', material.unit_price);
                
                const quantity = parseFloat(material.quantity) || 0;
                const unitPrice = parseFloat(material.unit_price) || 0;
                const total = quantity * unitPrice;
                
                console.log(`Calculated: quantity=${quantity}, unitPrice=${unitPrice}, total=${total}`);
                
                return (
                  <tr key={material.id}>
                    <td className="px-4 py-2 text-white">
                      {material.name || material.description || 'Unnamed Material'}
                      {material.category && (
                        <span className="ml-2 text-xs bg-[#ffcb00] text-black px-2 py-1 rounded">
                          {material.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-20 p-2 bg-[#2a2a2a] border border-white/10 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        value={material.quantity || 0}
                        onChange={(e) => handleUpdateMaterial(material.id, 'quantity', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 text-white">{material.unit || 'Stück'}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 p-2 bg-[#2a2a2a] border border-white/10 rounded text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00]"
                        value={material.unit_price || 0}
                        onChange={(e) => handleUpdateMaterial(material.id, 'unit_price', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-white">€{total.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <button 
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="text-red-400 hover:text-red-300 font-medium px-3 py-1 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#2a2a2a] text-[#ffcb00] border-t border-white/20">
                <td colSpan="4" className="px-4 py-2 text-right font-medium">Subtotal:</td>
                <td colSpan="2" className="px-4 py-2 font-medium">€{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-400 italic py-4">No materials selected</div>
      )}
    </div>
  );
}
