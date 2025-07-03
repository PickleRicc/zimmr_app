import React, { useState, useEffect } from 'react';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';
import { useAuth } from '../../contexts/AuthContext';

export default function MaterialSelector({ selectedMaterials = [], onChange }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session } = useAuth();
  const authedFetch = useAuthedFetch();
  
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
        setMaterials(data);
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
    const material = materials.find(m => m.id === materialId);
    if (!material) return;
    
    const newMaterial = {
      id: crypto.randomUUID(), // Generate a unique client-side ID for this line item
      material_id: material.id, // The actual database material ID
      name: material.name,
      unit: material.unit,
      quantity: 1,
      unit_price: material.price
    };
    
    onChange([...selectedMaterials, newMaterial]);
  };
  
  // Update quantity or price of a selected material
  const handleUpdateMaterial = (id, field, value) => {
    const updatedMaterials = selectedMaterials.map(material => {
      if (material.id === id) {
        return { ...material, [field]: value };
      }
      return material;
    });
    
    onChange(updatedMaterials);
  };
  
  // Remove a material from the selection
  const handleRemoveMaterial = (id) => {
    onChange(selectedMaterials.filter(material => material.id !== id));
  };
  
  if (loading) return <div className="text-center py-4">Loading materials...</div>;
  if (error) return <div className="text-red-500 py-4">Error loading materials: {error}</div>;
  
  // Calculate subtotal
  const subtotal = selectedMaterials.reduce((sum, material) => {
    return sum + (parseFloat(material.quantity) || 0) * (parseFloat(material.unit_price) || 0);
  }, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Materials & Services</h3>
      
      {/* Material Selection */}
      <div className="flex space-x-2">
        <select 
          className="flex-1 p-2 border rounded"
          onChange={(e) => e.target.value && handleAddMaterial(e.target.value)}
          value=""
        >
          <option value="">Select material to add...</option>
          {materials.map(material => (
            <option key={material.id} value={material.id}>
              {material.name} ({material.unit}) - €{parseFloat(material.price).toFixed(2)}
            </option>
          ))}
        </select>
      </div>
      
      {/* Selected Materials List */}
      {selectedMaterials.length > 0 ? (
        <div className="border rounded overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedMaterials.map(material => {
                const quantity = parseFloat(material.quantity) || 0;
                const unitPrice = parseFloat(material.unit_price) || 0;
                const total = quantity * unitPrice;
                
                return (
                  <tr key={material.id}>
                    <td className="px-4 py-2">{material.name}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-20 p-1 border rounded"
                        value={material.quantity}
                        onChange={(e) => handleUpdateMaterial(material.id, 'quantity', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">{material.unit}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-24 p-1 border rounded"
                        value={material.unit_price}
                        onChange={(e) => handleUpdateMaterial(material.id, 'unit_price', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">€{total.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <button 
                        onClick={() => handleRemoveMaterial(material.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50">
                <td colSpan="4" className="px-4 py-2 text-right font-medium">Subtotal:</td>
                <td colSpan="2" className="px-4 py-2">€{subtotal.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-500 italic py-4">No materials selected</div>
      )}
    </div>
  );
}
