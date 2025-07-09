"use client";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useMemo } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function RevenueChart({ monthlyPaid = [], monthlyOpen = [], yearlyGoal = null }) {
  // Build the labels (Jan–Dec)
  const labels = useMemo(() => {
    return Array.from({ length: 12 }).map((_, idx) => {
      return new Date(2025, idx, 1).toLocaleString('de-DE', { month: 'short' });
    });
  }, []);

  const data = useMemo(() => {
    return {
      labels,
      datasets: [
        {
          label: 'Bezahlt',
          data: monthlyPaid,
          borderColor: '#22c55e', // green-500
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          tension: 0.3,
          fill: false
        },
        {
          label: 'Ausstehend',
          data: monthlyOpen,
          borderColor: '#eab308', // yellow-500
          backgroundColor: 'rgba(234, 179, 8, 0.2)',
          tension: 0.3,
          fill: false
        }
      ]
    };
  }, [labels, monthlyPaid, monthlyOpen]);

  const options = useMemo(() => {
    const maxPaid = Math.max(...monthlyPaid, 0);
    const maxOpen = Math.max(...monthlyOpen, 0);
    const maxY = Math.max(maxPaid, maxOpen, yearlyGoal || 0);
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#ffffff'
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => `€${Number(ctx.parsed.y).toLocaleString('de-DE')}`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#ffffff' },
          grid: { color: 'rgba(255,255,255,0.1)' }
        },
        y: {
          ticks: {
            color: '#ffffff',
            callback: value => `€${Number(value).toLocaleString('de-DE')}`
          },
          grid: { color: 'rgba(255,255,255,0.1)' },
          suggestedMax: maxY * 1.1
        }
      }
    };
  }, [monthlyPaid, monthlyOpen, yearlyGoal]);

  // Optional guideline for yearly goal
  const plugins = useMemo(() => {
    if (!yearlyGoal) return [];
    return [
      {
        id: 'goalLine',
        afterDraw: chart => {
          const { ctx, chartArea: { top, bottom, left, right }, scales: { y } } = chart;
          const yPos = y.getPixelForValue(yearlyGoal);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(left, yPos);
          ctx.lineTo(right, yPos);
          ctx.strokeStyle = '#9ca3af'; // gray-400
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.restore();
        }
      }
    ];
  }, [yearlyGoal]);

  return (
    <div className="w-full h-64 sm:h-72 md:h-80 lg:h-96">
      <Line data={data} options={options} plugins={plugins} />
    </div>
  );
}
