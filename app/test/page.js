'use client';

import { useState, useEffect } from 'react';
import { customersAPI } from '../lib/api';

export default function TestConnection() {
  const [status, setStatus] = useState('Loading...');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function testConnection() {
      try {
        setStatus('Connecting to backend...');
        const data = await customersAPI.getAll();
        setCustomers(data);
        setStatus('Connected successfully!');
      } catch (err) {
        console.error('Connection error:', err);
        setError(err.message || 'Failed to connect to the backend');
        setStatus('Connection failed');
      }
    }

    testConnection();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Backend Connection Test</h1>
      
      <div className="mb-4 p-4 border rounded">
        <h2 className="font-semibold mb-2">Connection Status:</h2>
        <div className={`p-2 rounded ${
          status === 'Connected successfully!' 
            ? 'bg-green-100 text-green-800' 
            : status === 'Connection failed' 
              ? 'bg-red-100 text-red-800' 
              : 'bg-blue-100 text-blue-800'
        }`}>
          {status}
        </div>
        
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-800 rounded">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
      </div>

      <div>
        <h2 className="font-semibold mb-2">API Configuration:</h2>
        <div className="bg-gray-100 p-2 rounded mb-4">
          <p><strong>API Base URL:</strong> {process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'}</p>
        </div>
      </div>

      {customers.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold mb-2">Customers Retrieved:</h2>
          <ul className="border rounded divide-y">
            {customers.map((customer) => (
              <li key={customer.id} className="p-2">
                <p><strong>{customer.name}</strong></p>
                <p className="text-sm text-gray-600">Phone: {customer.phone}</p>
                <p className="text-sm text-gray-600">Service: {customer.service_type}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
