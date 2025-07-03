'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useRequireAuth } from '../../lib/utils/useRequireAuth';
import { useAuthedFetch } from '../../lib/utils/useAuthedFetch';

export default function MaterialsPage() {
  // Authentication hook - redirects to login if not authenticated
  const { user, loading: authLoading } = useRequireAuth();
  const router = useRouter();
  const authedFetch = useAuthedFetch();

  // State variables
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentMaterial, setCurrentMaterial] = useState(null);
  const [newMaterial, setNewMaterial] = useState({
    name: '',
    unit: '',
    price: ''
  });
  const [saving, setSaving] = useState(false);

  // Load materials and check if user has confirmed the disclaimer
  useEffect(() => {
    if (!user) return;

    const fetchMaterials = async () => {
      setLoading(true);
      try {
        // Check if user has confirmed the materials notice
        const confirmRes = await authedFetch('/api/materials/confirmation');
        const confirmData = await confirmRes.json();
        
        if (!confirmData.confirmed) {
          setShowConfirmationDialog(true);
        }
        
        // Fetch materials list
        const materialsRes = await authedFetch('/api/materials');
        if (!materialsRes.ok) {
          throw new Error(`Error: ${materialsRes.status}`);
        }
        const materialsData = await materialsRes.json();
        setMaterials(materialsData);
      } catch (err) {
        console.error('Error fetching materials:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMaterials();
    // Remove authedFetch from dependencies to prevent infinite loops
    // since authedFetch is likely a new function instance on each render
  }, [user]);

  // Handle confirmation dialog submission
  const handleConfirm = async () => {
    if (!confirmationChecked) return;
    
    try {
      setSaving(true);
      const res = await authedFetch('/api/materials/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) throw new Error('Failed to save confirmation');
      setShowConfirmationDialog(false);
    } catch (err) {
      console.error('Error saving confirmation:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle input changes for add/edit modals
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (showAddModal) {
      setNewMaterial(prev => ({ ...prev, [name]: value }));
    } else if (showEditModal && currentMaterial) {
      setCurrentMaterial(prev => ({ ...prev, [name]: value }));
    }
  };

  // Add new material
  const handleAddMaterial = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newMaterial.name || !newMaterial.unit) {
      setError('Name and unit are required');
      return;
    }
    
    try {
      setSaving(true);
      const res = await authedFetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMaterial)
      });
      
      if (!res.ok) throw new Error('Failed to add material');
      
      const addedMaterial = await res.json();
      
      // Update materials list with new material
      setMaterials(prev => [...prev, addedMaterial]);
      
      // Reset form and close modal
      setNewMaterial({ name: '', unit: '', price: '' });
      setShowAddModal(false);
    } catch (err) {
      console.error('Error adding material:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Update material
  const handleUpdateMaterial = async (e) => {
    e.preventDefault();
    
    if (!currentMaterial || !currentMaterial.id) return;
    
    // Validate required fields
    if (!currentMaterial.name || !currentMaterial.unit) {
      setError('Name and unit are required');
      return;
    }
    
    try {
      setSaving(true);
      const res = await authedFetch('/api/materials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentMaterial)
      });
      
      if (!res.ok) throw new Error('Failed to update material');
      
      const updatedMaterial = await res.json();
      
      // Update materials list with updated material
      setMaterials(prev => 
        prev.map(item => 
          item.id === updatedMaterial.id ? updatedMaterial : item
        )
      );
      
      // Reset and close modal
      setCurrentMaterial(null);
      setShowEditModal(false);
    } catch (err) {
      console.error('Error updating material:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Delete material
  const handleDeleteMaterial = async () => {
    if (!currentMaterial || !currentMaterial.id) return;
    
    try {
      setSaving(true);
      const res = await authedFetch(`/api/materials?id=${currentMaterial.id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to delete material');
      
      // Remove material from list
      setMaterials(prev => prev.filter(item => item.id !== currentMaterial.id));
      
      // Reset and close modals
      setCurrentMaterial(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Error deleting material:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Handle opening edit modal
  const openEditModal = (material) => {
    setCurrentMaterial({...material});
    setShowEditModal(true);
  };

  // Handle opening delete confirmation
  const openDeleteConfirm = (material) => {
    setCurrentMaterial({...material});
    setShowDeleteConfirm(true);
  };
  
  // Format price display
  const formatPrice = (price) => {
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR'
    }).format(price);
  };

  // If loading auth, show loading
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <div className="w-16 h-16 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Materials & Services</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Add New Material
          </button>
        </div>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-white px-4 py-3 rounded mb-4">
            <p>{error}</p>
            <button 
              className="text-sm underline ml-2"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center my-12">
            <div className="w-12 h-12 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {materials.map((material) => (
                  <tr key={material.id} className="hover:bg-gray-750">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {material.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {material.unit}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatPrice(material.price)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {material.is_default ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-200">
                          Default
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-200">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(material)}
                        className="text-blue-400 hover:text-blue-300 mr-3"
                      >
                        Edit
                      </button>
                      {!material.is_default && (
                        <button
                          onClick={() => openDeleteConfirm(material)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      
      {/* Confirmation Dialog */}
      {showConfirmationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Important Notice</h2>
            <div className="bg-blue-900/30 border border-blue-400 rounded p-4 mb-4 text-white">
              <p className="mb-4">
                The listed prices are based on standard market values and are intended as guidance only. 
                You are responsible for adjusting them to your own calculation and billing model.
              </p>
              <p>
                All prices and descriptions can be freely edited at any time.
              </p>
            </div>
            <div className="flex items-center mb-6">
              <input
                type="checkbox"
                id="confirmCheck"
                checked={confirmationChecked}
                onChange={(e) => setConfirmationChecked(e.target.checked)}
                className="mr-3 h-5 w-5"
              />
              <label htmlFor="confirmCheck">
                I understand and confirm the above information
              </label>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleConfirm}
                disabled={!confirmationChecked || saving}
                className={`px-4 py-2 rounded font-bold ${
                  !confirmationChecked
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving ? 'Confirming...' : 'Confirm & Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Add New Material</h2>
            <form onSubmit={handleAddMaterial}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Position Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newMaterial.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="unit" className="block text-sm font-medium mb-1">
                  Unit
                </label>
                <select
                  id="unit"
                  name="unit"
                  value={newMaterial.unit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                >
                  <option value="">Select a unit</option>
                  <option value="m²">m² (square meter)</option>
                  <option value="lfm">lfm (linear meter)</option>
                  <option value="Stück">Stück (piece)</option>
                  <option value="Stunde">Stunde (hour)</option>
                  <option value="pauschal">pauschal (flat rate)</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label htmlFor="price" className="block text-sm font-medium mb-1">
                  Price (€)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={newMaterial.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold"
                >
                  {saving ? 'Adding...' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Material Modal */}
      {showEditModal && currentMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              {currentMaterial.is_default 
                ? 'Create Custom Copy of Default Material' 
                : 'Edit Material'}
            </h2>
            
            {currentMaterial.is_default && (
              <div className="bg-yellow-900/30 border border-yellow-400 rounded p-3 mb-4">
                <p className="text-sm text-yellow-200">
                  You are editing a default material. This will create a custom copy that you can modify.
                </p>
              </div>
            )}
            
            <form onSubmit={handleUpdateMaterial}>
              <div className="mb-4">
                <label htmlFor="edit-name" className="block text-sm font-medium mb-1">
                  Position Name
                </label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={currentMaterial.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="edit-unit" className="block text-sm font-medium mb-1">
                  Unit
                </label>
                <select
                  id="edit-unit"
                  name="unit"
                  value={currentMaterial.unit}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  required
                >
                  <option value="">Select a unit</option>
                  <option value="m²">m² (square meter)</option>
                  <option value="lfm">lfm (linear meter)</option>
                  <option value="Stück">Stück (piece)</option>
                  <option value="Stunde">Stunde (hour)</option>
                  <option value="pauschal">pauschal (flat rate)</option>
                </select>
              </div>
              
              <div className="mb-6">
                <label htmlFor="edit-price" className="block text-sm font-medium mb-1">
                  Price (€)
                </label>
                <input
                  type="number"
                  id="edit-price"
                  name="price"
                  value={currentMaterial.price}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMaterial(null);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold"
                >
                  {saving ? 'Saving...' : currentMaterial.is_default ? 'Create Custom Copy' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && currentMaterial && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Delete Material</h2>
            <p className="mb-6">
              Are you sure you want to delete{' '}
              <span className="font-bold">{currentMaterial.name}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setCurrentMaterial(null);
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMaterial}
                disabled={saving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-bold"
              >
                {saving ? 'Deleting...' : 'Delete Material'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
