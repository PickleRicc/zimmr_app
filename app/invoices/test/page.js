'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function InvoiceTestPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#0a1929] text-white">
        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Invoice Test Page</h1>
            <Link 
              href="/invoices" 
              className="px-4 py-2 bg-[#e91e63] hover:bg-[#d81b60] text-white font-medium rounded-xl transition-colors"
            >
              Back to Invoices
            </Link>
          </div>
          
          <div className="bg-[#132f4c] rounded-xl p-6 mb-6">
            <p className="text-lg mb-4">This is a test page to verify that the Next.js dynamic route structure is working correctly.</p>
            <p className="mb-4">If you can see this page, it means the route structure is working, and the issue with the invoice detail page is likely related to the API or data fetching.</p>
            
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-4">Test Links:</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <Link href="/invoices/1" className="text-[#e91e63] hover:underline">
                    Test Invoice #1
                  </Link>
                </li>
                <li>
                  <Link href="/invoices/21" className="text-[#e91e63] hover:underline">
                    Test Invoice #21
                  </Link>
                </li>
                <li>
                  <Link href="/invoices/999" className="text-[#e91e63] hover:underline">
                    Test Invoice #999 (likely doesn't exist)
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
      <Footer />
    </>
  );
}
