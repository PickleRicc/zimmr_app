'use client';
import { useEffect, useState } from 'react';

export default function TestChart() {
  const [mounted, setMounted] = useState(false);
  const [Chart, setChart] = useState(null);

  useEffect(() => {
    // Load Recharts only on client side
    import('recharts').then((recharts) => {
      setChart({
        LineChart: recharts.LineChart,
        Line: recharts.Line,
        XAxis: recharts.XAxis,
        YAxis: recharts.YAxis,
        CartesianGrid: recharts.CartesianGrid,
        Tooltip: recharts.Tooltip,
        Legend: recharts.Legend,
        ResponsiveContainer: recharts.ResponsiveContainer,
      });
      setMounted(true);
    });
  }, []);

  const data = [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 200 },
    { name: 'Mar', value: 300 },
    { name: 'Apr', value: 400 },
  ];

  if (!mounted || !Chart) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <h1 className="text-3xl mb-4">Chart Test Page</h1>
        <div className="bg-gray-800 p-4 rounded">Loading chart...</div>
      </div>
    );
  }

  const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Chart;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl mb-4">Chart Test Page</h1>
      
      <div className="bg-gray-800 p-4 rounded mb-4">
        <h2 className="text-xl mb-2">Data:</h2>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>

      <div className="bg-gray-800 p-4 rounded">
        <h2 className="text-xl mb-4">Chart:</h2>
        <div style={{ width: '100%', height: '400px', backgroundColor: '#1f2937' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis dataKey="name" stroke="#fff" />
              <YAxis stroke="#fff" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
