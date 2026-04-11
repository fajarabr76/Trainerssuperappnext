'use client';

import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import html2canvas from 'html2canvas';
import { prepareHtml2CanvasClone } from '@/app/lib/html2canvas-tailwind-fix';
import {
  ComposedChart,
  Bar,
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import type { ParetoData, CriticalVsNonCriticalData } from '../../lib/qa-types';

const PARETO_COLORS = { critical: '#f43f5e', non_critical: '#64748b' };
const DONUT_COLORS = ['#f43f5e', '#64748b'];

export type ReportChartCaptureHandle = {
  captureService: () => Promise<{ pareto: string | null; donut: string | null }>;
  captureIndividual: () => Promise<{ trend: string | null }>;
};

type Props = {
  paretoData: ParetoData[];
  donutData: CriticalVsNonCriticalData | null;
  trendPoints: Array<{ label: string; score: number; findings: number }>;
};

const HTML2CANVAS_BASE = {
  backgroundColor: '#ffffff',
  scale: 2,
  logging: false,
  useCORS: true,
  allowTaint: true,
  foreignObjectRendering: true,
} as const;

function chartCaptureOptions(root: HTMLElement) {
  return {
    ...HTML2CANVAS_BASE,
    onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
      prepareHtml2CanvasClone(clonedDoc, clonedElement, root);
    },
  };
}

const ReportChartCapture = forwardRef<ReportChartCaptureHandle, Props>(
  function ReportChartCapture({ paretoData, donutData, trendPoints }, ref) {
    const paretoEl = useRef<HTMLDivElement>(null);
    const donutEl = useRef<HTMLDivElement>(null);
    const trendEl = useRef<HTMLDivElement>(null);

    const donutChartData =
      donutData && donutData.total > 0
        ? [
            { name: 'Critical', value: donutData.critical },
            { name: 'Non-Critical', value: donutData.nonCritical },
          ]
        : [];

    useImperativeHandle(ref, () => ({
      async captureService() {
        const pareto = paretoEl.current
          ? (await html2canvas(paretoEl.current, chartCaptureOptions(paretoEl.current))).toDataURL(
              'image/png'
            )
          : null;
        const donut =
          donutEl.current && donutChartData.length
            ? (await html2canvas(donutEl.current, chartCaptureOptions(donutEl.current))).toDataURL(
                'image/png'
              )
            : null;
        return { pareto, donut };
      },
      async captureIndividual() {
        const trend = trendEl.current
          ? (await html2canvas(trendEl.current, chartCaptureOptions(trendEl.current))).toDataURL(
              'image/png'
            )
          : null;
        return { trend };
      },
    }));

    const paretoSlice = paretoData.slice(0, 12);

    return (
      <div
        aria-hidden
        className="pointer-events-none fixed -left-[10000px] top-0 z-0 w-[720px] bg-white p-6 text-slate-900"
      >
        <div ref={paretoEl} className="h-[320px] w-full">
          {paretoSlice.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <ComposedChart data={paretoSlice} margin={{ top: 16, right: 12, bottom: 48, left: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#64748b' }}
                  angle={-25}
                  textAnchor="end"
                  height={70}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                />
                <Tooltip />
                <Bar yAxisId="left" dataKey="count" maxBarSize={36}>
                  {paretoSlice.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.category === 'critical' ? PARETO_COLORS.critical : PARETO_COLORS.non_critical}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Tidak ada data Pareto</div>
          )}
        </div>

        <div ref={donutEl} className="mt-4 h-[300px] w-full">
          {donutChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={donutChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={4}
                >
                  {donutChartData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Tidak ada data donut</div>
          )}
        </div>

        <div ref={trendEl} className="mt-4 h-[300px] w-full">
          {trendPoints.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={trendPoints} margin={{ top: 16, right: 12, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  name="Skor QA"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">Tidak ada tren</div>
          )}
        </div>
      </div>
    );
  }
);

export default ReportChartCapture;
