'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { Icon } from '@iconify/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const PLANS = [
  {
    name: 'Starter',
    min: 1500,
    weeklyRoi: 15,
    color: '#22C55E',
    features: ['FX & Top Crypto Asset Access', 'Weekly ROI Distribution', '0% Management Fee (15% Perf Fee)'],
  },
  {
    name: 'Growth',
    min: 7500,
    weeklyRoi: 25,
    color: '#22C55E',
    recommended: true,
    features: ['FX, Crypto & US Equities Access', 'Dedicated Account Manager', 'Priority Investment Execution'],
  },
  {
    name: 'Elite',
    min: 45000,
    weeklyRoi: 35,
    color: '#22C55E',
    features: ['Full Multi-Asset VIP Access', 'Custom Risk Controls', 'Direct Portfolio Manager Insights'],
  },
];

export default function PlansPage() {
  const [selectedPlan, setSelectedPlan] = useState<number>(1);
  const [deposit, setDeposit] = useState(7500);
  const [days, setDays] = useState(14);

  const plan = PLANS[selectedPlan];
  const dailyRoiRate = plan.weeklyRoi / 7;

  const chartData = [];
  for (let i = 0; i <= days; i++) {
    chartData.push({
      day: i === 0 ? 'Now' : `D${i}`,
      value: Math.round(deposit * (1 + (plan.weeklyRoi / 100 / 7) * i)),
    });
  }
  const projected = Math.round(deposit * (1 + (plan.weeklyRoi / 100 / 7) * days));
  const profit = projected - deposit;

  return (
    <div className="min-h-screen bg-white text-[#0A0D0C] flex flex-col font-sans">
      <Navbar mode="light" />

      {/* Hero */}
      <section className="py-10 sm:py-20 bg-[#F7F7F7] border-b border-[#DEE1E6]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center space-y-4">
          <span className="text-xs font-mono uppercase tracking-widest text-[#22C55E]">Transparent Tiers</span>
          <h1 className="text-2xl sm:text-5xl lg:text-6xl font-normal text-[#0A0D0C]">
            Investment Plans
          </h1>
          <p className="text-sm sm:text-base text-[#5B616E] max-w-xl mx-auto">
            Transparent scenario assumptions, clear fees, and risk-aware portfolio reporting.
          </p>
        </div>
      </section>

      {/* Plan Cards */}
      <section className="py-10 sm:py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {PLANS.map((p, i) => (
              <button
                key={p.name}
                onClick={() => { setSelectedPlan(i); setDeposit(p.min); }}
                className={`p-5 sm:p-8 rounded-2xl text-left space-y-5 transition-all ${
                  selectedPlan === i
                    ? 'bg-[#0A0D0C] text-white border-2 border-[#22C55E] shadow-xl scale-[1.02]'
                    : 'bg-[#F7F7F7] border border-[#DEE1E6] hover:border-[#22C55E]/50'
                }`}
              >
                {p.recommended && (
                  <span className="inline-block px-3 py-1 rounded-full bg-[#22C55E] text-[#0A0D0C] font-mono text-[10px] font-bold uppercase">
                    Recommended
                  </span>
                )}
                <div>
                  <span className={`text-xs font-mono ${selectedPlan === i ? 'text-[#22C55E]' : 'text-[#5B616E]'}`}>
                    {p.name.toUpperCase()} TIER
                  </span>
                  <h3 className={`text-xl sm:text-2xl font-normal mt-1 ${selectedPlan === i ? 'text-white' : 'text-[#0A0D0C]'}`}>
                    {p.name} Plan
                  </h3>
                </div>

                <div className={`p-4 rounded-xl border ${selectedPlan === i ? 'bg-[#12161A] border-[#202722]' : 'bg-white border-[#DEE1E6]'}`}>
                  <p className={`text-[10px] uppercase font-mono ${selectedPlan === i ? 'text-[#A8ACB3]' : 'text-[#5B616E]'}`}>
                    ROI in 7 days
                  </p>
                  <p className="text-2xl sm:text-4xl font-mono font-bold text-[#22C55E] mt-1 truncate">
                    {p.weeklyRoi}%
                  </p>
                </div>

                <div className={`p-3 rounded-xl border ${selectedPlan === i ? 'bg-[#12161A] border-[#202722]' : 'bg-white border-[#DEE1E6]'}`}>
                  <p className={`text-[10px] uppercase font-mono ${selectedPlan === i ? 'text-[#A8ACB3]' : 'text-[#5B616E]'}`}>
                    Min Deposit
                  </p>
                  <p className={`text-lg font-mono font-semibold mt-0.5 ${selectedPlan === i ? 'text-white' : 'text-[#0A0D0C]'}`}>
                    ${p.min.toLocaleString()}
                  </p>
                </div>

                <ul className="space-y-2.5">
                  {p.features.map((f, fi) => (
                    <li key={fi} className={`flex items-start gap-2 text-xs ${selectedPlan === i ? 'text-[#A8ACB3]' : 'text-[#5B616E]'}`}>
                      <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E] shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signup"
                  className={`w-full block py-3.5 rounded-full text-center text-xs font-semibold transition-colors ${
                    selectedPlan === i
                      ? 'bg-[#22C55E] text-[#0A0D0C] hover:bg-[#16A34A]'
                      : 'bg-[#0A0D0C] text-white hover:bg-[#12161A]'
                  }`}
                >
                  Select {p.name} Plan (${p.min.toLocaleString()})
                </Link>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Live Calculator */}
      <section className="py-10 sm:py-20 bg-[#F7F7F7] border-t border-[#DEE1E6]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="text-center mb-6 sm:mb-12 space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-[#22C55E]">Live Calculator</span>
            <h2 className="text-xl sm:text-4xl font-normal text-[#0A0D0C]">Project Your Returns</h2>
          </div>

          <div className="bg-white border border-[#DEE1E6] rounded-2xl p-5 sm:p-8 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Controls */}
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-[#5B616E] block mb-2">
                    Investment Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-mono text-[#5B616E]">$</span>
                    <input
                      type="number"
                      min={plan.min}
                      max="1000000"
                      value={deposit}
                      onChange={e => setDeposit(Math.max(plan.min, Number(e.target.value)))}
                      className="w-full bg-[#F7F7F7] border border-[#DEE1E6] rounded-xl pl-8 pr-4 py-3 text-lg font-mono font-bold text-[#0A0D0C] focus:outline-none focus:border-[#22C55E]"
                    />
                  </div>
                  <input
                    type="range"
                    min={plan.min}
                    max={Math.max(plan.min * 10, 50000)}
                    step={500}
                    value={deposit}
                    onChange={e => setDeposit(Number(e.target.value))}
                    className="w-full accent-[#22C55E] mt-3"
                  />
                  <div className="flex justify-between text-[10px] text-[#5B616E] mt-1 font-mono">
                    <span>${plan.min.toLocaleString()}</span>
                    <span>${(plan.min * 5).toLocaleString()}</span>
                    <span>${(plan.min * 10).toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#5B616E] flex justify-between mb-2">
                    <span>Time Horizon</span>
                    <span className="font-mono text-[#22C55E]">{days} days</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[3, 7, 14, 30].map(d => (
                      <button
                        key={d}
                        onClick={() => setDays(d)}
                        className={`py-2.5 rounded-xl text-xs font-mono font-medium transition-all ${
                          days === d
                            ? 'bg-[#22C55E] text-[#0A0D0C]'
                            : 'bg-[#F7F7F7] border border-[#DEE1E6] text-[#5B616E] hover:border-[#22C55E]'
                        }`}
                      >
                        {d}D
                      </button>
                    ))}
                  </div>
                </div>

                {/* Plan summary */}
                <div className="p-4 bg-[#F7F7F7] border border-[#DEE1E6] rounded-xl space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5B616E]">Active Plan</span>
                    <span className="font-semibold text-[#22C55E]">{plan.name}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5B616E]">ROI in 7 days</span>
                    <span className="font-mono font-bold text-[#22C55E]">{plan.weeklyRoi}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5B616E]">7-Day Dollar Return</span>
                    <span className="font-mono font-semibold text-[#0A0D0C]">${(deposit * plan.weeklyRoi / 100).toLocaleString(undefined, {maximumFractionDigits: 0})}/wk</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#5B616E]">Daily Rate (est.)</span>
                    <span className="font-mono font-semibold text-[#0A0D0C]">~{dailyRoiRate.toFixed(2)}%/day</span>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 sm:p-4 bg-[#F7F7F7] border border-[#DEE1E6] rounded-xl">
                    <p className="text-[10px] text-[#5B616E] uppercase font-mono">Profit</p>
                    <p className="text-lg sm:text-2xl font-mono font-bold text-[#22C55E] mt-1 truncate">
                      +${profit.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-[#F7F7F7] border border-[#DEE1E6] rounded-xl">
                    <p className="text-[10px] text-[#5B616E] uppercase font-mono">Total</p>
                    <p className="text-lg sm:text-2xl font-mono font-bold text-[#0A0D0C] mt-1 truncate">
                      ${projected.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="h-48 sm:h-56 w-full bg-[#F7F7F7] border border-[#DEE1E6] rounded-xl p-3">
                  <p className="text-[10px] text-[#5B616E] font-mono mb-1">Growth Projection</p>
                  <ResponsiveContainer width="100%" height="85%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="planGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22C55E" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#5B616E' }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={['dataMin', 'dataMax']} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', borderColor: '#DEE1E6', borderRadius: '12px', fontSize: '11px', color: '#0A0D0C' }}
                        formatter={(val: any) => [`$${Number(val).toLocaleString()}`, 'Portfolio']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={2} fillOpacity={1} fill="url(#planGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <Link
                  href="/signup"
                  className="w-full block py-4 rounded-full text-center text-sm font-semibold bg-[#22C55E] text-[#0A0D0C] hover:bg-[#16A34A] transition-colors"
                >
                  Start with {plan.name} Plan — ${deposit.toLocaleString()}
                </Link>
                <p className="text-[10px] text-[#5B616E] text-center">
                  *Projections assume consistent plan performance over the selected period.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
