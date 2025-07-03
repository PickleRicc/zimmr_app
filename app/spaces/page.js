'use client';

import { useState, useEffect } from 'react';
import { spacesAPI, customersAPI } from '../lib/api';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';

export default function SpacesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [spaces, setSpaces] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [craftsmanId, setCraftsmanId] = useState(null);
  const [filterCustomerId, setFilterCustomerId] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/auth/login';
      return;
    }

    // Get craftsman ID from token
    try {
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      if (tokenData.craftsmanId) {
        setCraftsmanId(tokenData.craftsmanId);
        fetchCustomers(tokenData.craftsmanId);
        fetchSpaces();
      } else {
        setError('Your account is not set up as a craftsman. Please contact support.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error parsing token:', err);
      setError('Session error. Please log in again.');
      setLoading(false);
    }
  }, []);

  const fetchCustomers = async (craftsmanId) => {
    try {
      const data = await customersAPI.getAll({ craftsman_id: craftsmanId });
      
      if (!Array.isArray(data)) {
        console.error('Customer data is not an array:', data);
        setCustomers([]);
      } else {
        setCustomers(data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to load customers. Please try again.');
      setCustomers([]);
    }
  };

  const fetchSpaces = async (filters = {}) => {
    setLoading(true);
    try {
      const data = await spacesAPI.getAll(filters);
      
      if (!Array.isArray(data)) {
        console.error('Spaces data is not an array:', data);
        setSpaces([]);
      } else {
        setSpaces(data);
      }
    } catch (err) {
      console.error('Error fetching spaces:', err);
      setError('Failed to load customer spaces. Please try again.');
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    const filters = {};
    if (filterCustomerId) filters.customer_id = filterCustomerId;
    if (filterType) filters.type = filterType;
    fetchSpaces(filters);
  };

  const handleDeleteSpace = async (id) => {
    if (!confirm('Are you sure you want to delete this space?')) {
      return;
    }

    try {
      await spacesAPI.delete(id);
      // Refresh the spaces list
      fetchSpaces();
    } catch (err) {
      console.error('Error deleting space:', err);
      setError('Failed to delete space. Please try again.');
    }
  };

  // Helper function to get customer name by ID
  const getCustomerName = (customerId) => {
    if (!Array.isArray(customers)) {
      console.error('Customers is not an array when trying to get customer name');
      return 'Unknown Customer';
    }
    
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.name : 'Unknown Customer';
  };

  // Format area size with unit
  const formatArea = (area) => {
    if (!area) return 'N/A';
    return `${area} sqm`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#0a1929] to-[#132f4c]">
      <Header />
      <main className="flex-grow container mx-auto px-5 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                <span className="bg-gradient-to-r from-[#00c2ff] to-[#7928ca] bg-clip-text text-transparent">
                  Customer Spaces
                </span>
              </h1>
              <p className="text-white/70">Manage rooms and areas for your tiling projects</p>
            </div>
            <Link 
              href="/spaces/new" 
              className="mt-4 md:mt-0 px-5 py-2.5 bg-gradient-to-r from-[#0070f3] to-[#0050d3] hover:from-[#0060df] hover:to-[#0040c0] text-white font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 transform hover:-translate-y-0.5 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              Add New Space
            </Link>
          </div>

          {/* Filters */}
          <div className="bg-white/5 backdrop-blur-xl rounded-xl p-4 mb-6 border border-white/10">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label htmlFor="customerFilter" className="block mb-2 text-sm font-medium text-white">
                  Filter by Customer
                </label>
                <select
                  id="customerFilter"
                  value={filterCustomerId}
                  onChange={(e) => {
                    setFilterCustomerId(e.target.value);
                    setTimeout(handleFilterChange, 100);
                  }}
                  className="w-full p-2.5 border border-white/10 rounded-lg bg-white/5 text-white appearance-none focus:ring-2 focus:ring-[#00c2ff]/50 focus:border-[#00c2ff]/50 transition-all"
                >
                  <option value="">All Customers</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="typeFilter" className="block mb-2 text-sm font-medium text-white">
                  Filter by Type
                </label>
                <select
                  id="typeFilter"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setTimeout(handleFilterChange, 100);
                  }}
                  className="w-full p-2.5 border border-white/10 rounded-lg bg-white/5 text-white appearance-none focus:ring-2 focus:ring-[#00c2ff]/50 focus:border-[#00c2ff]/50 transition-all"
                >
                  <option value="">All Types</option>
                  <option value="bathroom">Bathroom</option>
                  <option value="kitchen">Kitchen</option>
                  <option value="living_room">Living Room</option>
                  <option value="bedroom">Bedroom</option>
                  <option value="hallway">Hallway</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Spaces List */}
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#00c2ff]"></div>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-white">
              <p>{error}</p>
            </div>
          ) : spaces.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl rounded-xl p-8 text-center border border-white/10">
              <svg className="w-16 h-16 mx-auto text-white/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
              </svg>
              <h3 className="text-xl font-medium mb-2">No Spaces Found</h3>
              <p className="text-white/70 mb-6">You haven't added any customer spaces yet.</p>
              <Link 
                href="/spaces/new" 
                className="px-5 py-2.5 bg-gradient-to-r from-[#0070f3] to-[#0050d3] hover:from-[#0060df] hover:to-[#0040c0] text-white font-medium rounded-xl shadow-lg hover:shadow-xl focus:outline-none transition-all duration-300 inline-flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                Add Your First Space
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spaces.map((space) => (
                <div key={space.id} className="bg-white/5 backdrop-blur-xl rounded-xl overflow-hidden border border-white/10 transition-all duration-300 hover:shadow-lg hover:bg-white/10">
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-semibold mb-1">{space.name}</h3>
                        <p className="text-white/70 text-sm mb-3">
                          {getCustomerName(space.customer_id)}
                        </p>
                      </div>
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                        {space.type.replace('_', ' ')}
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-white/60">Area:</span>
                        <span className="font-medium">{formatArea(space.area_sqm)}</span>
                      </div>
                      {space.notes && (
                        <p className="text-white/80 text-sm mt-3 border-t border-white/10 pt-3">
                          {space.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex border-t border-white/10">
                    <Link 
                      href={`/spaces/${space.id}`}
                      className="flex-1 py-3 text-center text-white/80 hover:bg-white/10 transition-colors duration-200"
                    >
                      View
                    </Link>
                    <Link 
                      href={`/spaces/${space.id}/edit`}
                      className="flex-1 py-3 text-center text-white/80 hover:bg-white/10 transition-colors duration-200 border-l border-white/10"
                    >
                      Edit
                    </Link>
                    <button 
                      onClick={() => handleDeleteSpace(space.id)}
                      className="flex-1 py-3 text-center text-red-400 hover:bg-red-500/10 transition-colors duration-200 border-l border-white/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
