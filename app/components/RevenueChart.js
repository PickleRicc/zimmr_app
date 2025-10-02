"use client";
import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  LineController,
  Filler,
  Tooltip,
  Legend
);

export default function RevenueChart({ monthlyPaid = [], monthlyOpen = [], yearlyGoal = null }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

    chartRef.current = new ChartJS(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Bezahlt',
            data: monthlyPaid,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.5)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Ausstehend',
            data: monthlyOpen,
            borderColor: '#ffcb00',
            backgroundColor: 'rgba(255, 203, 0, 0.5)',
            fill: true,
            tension: 0.4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#ffffff'
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          x: {
            ticks: { color: '#ffffff' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: '#ffffff',
              callback: (value) => `€${(value / 1000).toFixed(0)}k`
            },
            grid: { color: 'rgba(255, 255, 255, 0.1)' }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [monthlyPaid, monthlyOpen, yearlyGoal]);

  return (
    <div style={{ width: '100%', height: '300px', position: 'relative' }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
