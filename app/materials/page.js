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
        
        // Set confirmation state based on API response
        setConfirmationChecked(confirmData.confirmed || false);
        
        // Fetch materials list
        const materialsRes = await authedFetch('/api/materials');
        if (!materialsRes.ok) {
          throw new Error(`Error: ${materialsRes.status}`);
        }
        const materialsData = await materialsRes.json();
        console.log('Materials API Response:', materialsData);
        
        // Handle different response structures
        const materialsArray = Array.isArray(materialsData) 
          ? materialsData 
          : (materialsData.data && Array.isArray(materialsData.data)) 
            ? materialsData.data 
            : [];
        
        setMaterials(materialsArray);
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

  // Handle checkbox change and save confirmation
  const handleConfirmationChange = async (checked) => {
    setConfirmationChecked(checked);
    
    if (!checked || !user) return;
    
    try {
      const res = await authedFetch('/api/materials/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const errorData = await res.text();
        console.error('API Error:', errorData);
        
        // Check if it's a duplicate key error (confirmation already exists)
        if (errorData.includes('duplicate key value violates unique constraint')) {
          console.log('Confirmation already exists - treating as success');
          return; // Exit successfully
        }
        
        throw new Error('Failed to save confirmation');
      }
      
      console.log('Confirmation saved successfully');
    } catch (err) {
      console.error('Error saving confirmation:', err);
      setError('Failed to save confirmation. Please try again.');
      // Revert checkbox state on error
      setConfirmationChecked(false);
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#121212] to-[#1a1a1a] text-white">
        <div className="w-16 h-16 border-t-4 border-[#ffcb00] border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#121212] to-[#1a1a1a]">
      <Header title="Materialien" />
      
      <main className="flex-grow container mx-auto px-5 py-8">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-6 md:p-8 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-2 text-white">
                Materialien & Services
              </h1>
              <p className="text-white/70">Verwalten Sie Ihre Materialien und Dienstleistungen</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#ffcb00] hover:bg-[#ffcb00]/90 text-black font-bold py-2.5 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Material hinzufügen
            </button>
          </div>

          {/* Important Notice */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 mb-8 backdrop-blur-sm">
            <h3 className="text-xl font-bold mb-4 text-white flex items-center">
              <svg className="w-6 h-6 mr-2 text-[#ffcb00]" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Wichtiger Hinweis
            </h3>
            <div className="text-white/90 space-y-3 mb-6">
              <p>
                Die aufgeführten Preise basieren auf Standardmarktwerten und dienen nur als Orientierung. 
                Sie sind dafür verantwortlich, diese an Ihr eigenes Kalkulationsmodell anzupassen.
              </p>
              <p>
                Alle Preise und Beschreibungen können jederzeit frei bearbeitet werden.
              </p>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="topConfirmCheck"
                checked={confirmationChecked}
                onChange={(e) => handleConfirmationChange(e.target.checked)}
                className="mr-3 h-4 w-4 rounded border-white/30 bg-white/10 text-[#ffcb00] focus:ring-[#ffcb00] focus:ring-offset-0"
              />
              <label htmlFor="topConfirmCheck" className="text-white/90 cursor-pointer text-sm">
                Ich verstehe und bestätige die obigen Informationen
              </label>
            </div>
          </div>
        
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-6 backdrop-blur-sm">
              <p>{error}</p>
              <button 
                className="text-sm underline ml-2 hover:text-red-300 transition-colors"
                onClick={() => setError(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center my-12">
              <div className="w-12 h-12 border-t-4 border-[#ffcb00] border-solid rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-white/80 uppercase tracking-wider">
                        Position
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-white/80 uppercase tracking-wider">
                        Einheit
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-white/80 uppercase tracking-wider">
                        Preis
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-white/80 uppercase tracking-wider">
                        Typ
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-white/80 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {(materials || []).map((material, index) => (
                      <tr key={material.id || `material-${index}`} className="hover:bg-white/5 transition-colors text-white">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {material.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {material.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {formatPrice(material.price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {material.is_default ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Standard
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#ffcb00]/20 text-[#ffcb00] border border-[#ffcb00]/30">
                              Benutzerdefiniert
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(material)}
                            className="text-[#ffcb00] hover:text-[#ffcb00]/80 mr-4 font-medium transition-colors"
                          >
                            Bearbeiten
                          </button>
                          {!material.is_default && (
                            <button
                              onClick={() => openDeleteConfirm(material)}
                              className="text-red-400 hover:text-red-300 font-medium transition-colors"
                            >
                              Löschen
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        )}
      
      {/* Add Material Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-white">Neues Material hinzufügen</h2>
            <form onSubmit={handleAddMaterial}>
              <div className="mb-6">
                <label htmlFor="name" className="block text-sm font-medium mb-2 text-white/80">
                  Positionsname
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newMaterial.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  placeholder="z.B. Fliesen 30x30cm"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="unit" className="block text-sm font-medium mb-2 text-white/80">
                  Einheit
                </label>
                <select
                  id="unit"
                  name="unit"
                  value={newMaterial.unit}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  required
                >
                  <option value="" className="bg-gray-800">Einheit wählen</option>
                  <option value="m²" className="bg-gray-800">m² (Quadratmeter)</option>
                  <option value="lfm" className="bg-gray-800">lfm (Laufmeter)</option>
                  <option value="Stück" className="bg-gray-800">Stück</option>
                  <option value="Stunde" className="bg-gray-800">Stunde</option>
                  <option value="pauschal" className="bg-gray-800">Pauschal</option>
                </select>
              </div>
              
              <div className="mb-8">
                <label htmlFor="price" className="block text-sm font-medium mb-2 text-white/80">
                  Preis (€)
                </label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={newMaterial.price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-[#ffcb00] hover:bg-[#ffcb00]/90 text-black rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Hinzufügen...' : 'Material hinzufügen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Edit Material Modal */}
      {showEditModal && currentMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-white">
              {currentMaterial.is_default 
                ? 'Benutzerdefinierte Kopie erstellen' 
                : 'Material bearbeiten'}
            </h2>
            
            {currentMaterial.is_default && (
              <div className="bg-[#ffcb00]/10 border border-[#ffcb00]/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-[#ffcb00]">
                  Sie bearbeiten ein Standardmaterial. Dies erstellt eine benutzerdefinierte Kopie, die Sie ändern können.
                </p>
              </div>
            )}
            
            <form onSubmit={handleUpdateMaterial}>
              <div className="mb-6">
                <label htmlFor="edit-name" className="block text-sm font-medium mb-2 text-white/80">
                  Positionsname
                </label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={currentMaterial.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  required
                />
              </div>
              
              <div className="mb-6">
                <label htmlFor="edit-unit" className="block text-sm font-medium mb-2 text-white/80">
                  Einheit
                </label>
                <select
                  id="edit-unit"
                  name="unit"
                  value={currentMaterial.unit}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  required
                >
                  <option value="" className="bg-gray-800">Einheit wählen</option>
                  <option value="m²" className="bg-gray-800">m² (Quadratmeter)</option>
                  <option value="lfm" className="bg-gray-800">lfm (Laufmeter)</option>
                  <option value="Stück" className="bg-gray-800">Stück</option>
                  <option value="Stunde" className="bg-gray-800">Stunde</option>
                  <option value="pauschal" className="bg-gray-800">Pauschal</option>
                </select>
              </div>
              
              <div className="mb-8">
                <label htmlFor="edit-price" className="block text-sm font-medium mb-2 text-white/80">
                  Preis (€)
                </label>
                <input
                  type="number"
                  id="edit-price"
                  name="price"
                  value={currentMaterial.price}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#ffcb00] focus:border-transparent backdrop-blur-sm"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentMaterial(null);
                    setShowEditModal(false);
                  }}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-3 bg-[#ffcb00] hover:bg-[#ffcb00]/90 text-black rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Speichern...' : currentMaterial.is_default ? 'Kopie erstellen' : 'Änderungen speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && currentMaterial && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 max-w-md w-full p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-white">Material löschen</h2>
            <p className="mb-8 text-white/90">
              Sind Sie sicher, dass Sie{' '}
              <span className="font-bold text-[#ffcb00]">{currentMaterial.name}</span>{' '}
              löschen möchten?
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setCurrentMaterial(null);
                  setShowDeleteConfirm(false);
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all duration-200 border border-white/20"
              >
                Abbrechen
              </button>
              <button
                onClick={handleDeleteMaterial}
                disabled={saving}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Löschen...' : 'Material löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </main>
    </div>
  );
}
