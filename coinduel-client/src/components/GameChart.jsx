import React, { useEffect, useRef } from 'react';
// ZMIANA 1: Importujemy 'CandlestickSeries' z biblioteki
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

export const GameChart = ({ data = [] }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const seriesRef = useRef();

  useEffect(() => {
    // 1. Tworzymy wykres
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1F2937' },
        textColor: '#D1D5DB',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
    });

    // ZMIANA 2: Używamy addSeries(CandlestickSeries, opcje) zamiast addCandlestickSeries(opcje)
    const newSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    seriesRef.current = newSeries;

    // 3. Obsługa zmiany rozmiaru
    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  // 4. Aktualizacja danych
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);
    }
  }, [data]);

  return (
    <div className="w-full h-[400px] border border-gray-700 rounded-lg overflow-hidden shadow-xl">
      <div ref={chartContainerRef} className="w-full h-full" />
    </div>
  );
};