'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ThreeDPhoneHero from '@/components/ThreeDPhoneHero';
import CountUpNumber from '@/components/CountUpNumber';
import SignalLine from '@/components/SignalLine';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const DynamicRoiCalculatorModal = dynamic(() => import('@/components/RoiCalculatorModal'), { ssr: false });

interface TickerItem {
  pair: string;
  price: string;
  change: string;
  up: boolean;
}

const STATIC_TICKERS: TickerItem[] = [
  { pair: 'EUR/USD', price: '1.0894', change: '+0.42%', up: true },
  { pair: 'GBP/USD', price: '1.2740', change: '-0.12%', up: false },
  { pair: 'NVDA', price: '$128.40', change: '+4.90%', up: true },
  { pair: 'AAPL', price: '$224.30', change: '-0.45%', up: false },
  { pair: 'XAU/USD', price: '$2,415.20', change: '+0.85%', up: true },
  { pair: 'TSLA', price: '$210.80', change: '+5.20%', up: true },
];

export default function Homepage() {
  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [tickers, setTickers] = useState<TickerItem[]>([
    ...STATIC_TICKERS,
    { pair: 'BTC/USD', price: '$64,250.00', change: '+3.15%', up: true },
    { pair: 'ETH/USD', price: '$3,480.50', change: '+2.80%', up: true },
    { pair: 'SOL/USD', price: '$178.40', change: '+6.10%', up: true },
    { pair: 'XRP/USD', price: '$0.6240', change: '+1.50%', up: true },
  ]);

  // Fetch real crypto prices from CoinGecko
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple&vs_currencies=usd&include_24hr_change=true'
        );
        if (!res.ok) return;
        const data = await res.json();

        const cryptoTickers: TickerItem[] = [];
        if (data.bitcoin) {
          cryptoTickers.push({
            pair: 'BTC/USD',
            price: `$${Number(data.bitcoin.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${data.bitcoin.usd_24h_change >= 0 ? '+' : ''}${data.bitcoin.usd_24h_change.toFixed(2)}%`,
            up: data.bitcoin.usd_24h_change >= 0,
          });
        }
        if (data.ethereum) {
          cryptoTickers.push({
            pair: 'ETH/USD',
            price: `$${Number(data.ethereum.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${data.ethereum.usd_24h_change >= 0 ? '+' : ''}${data.ethereum.usd_24h_change.toFixed(2)}%`,
            up: data.ethereum.usd_24h_change >= 0,
          });
        }
        if (data.solana) {
          cryptoTickers.push({
            pair: 'SOL/USD',
            price: `$${Number(data.solana.usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            change: `${data.solana.usd_24h_change >= 0 ? '+' : ''}${data.solana.usd_24h_change.toFixed(2)}%`,
            up: data.solana.usd_24h_change >= 0,
          });
        }
        if (data.ripple) {
          cryptoTickers.push({
            pair: 'XRP/USD',
            price: `$${Number(data.ripple.usd).toFixed(4)}`,
            change: `${data.ripple.usd_24h_change >= 0 ? '+' : ''}${data.ripple.usd_24h_change.toFixed(2)}%`,
            up: data.ripple.usd_24h_change >= 0,
          });
        }

        if (cryptoTickers.length > 0) {
          setTickers([...STATIC_TICKERS, ...cryptoTickers]);
        }
      } catch {
        // Keep fallback static prices
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { step: '01', title: 'Pick Your Plan', desc: 'Choose Starter ($1.5k), Growth ($7.5k), or Elite ($45k) tier.', icon: 'solar:card-search-bold' },
    { step: '02', title: '2-Doc KYC', desc: 'Upload Government ID & Proof of Address in 2 minutes.', icon: 'solar:shield-check-bold' },
    { step: '03', title: 'Fund Account', desc: 'Deposit via Crypto Wallet or Bank Wire Transfer.', icon: 'solar:wallet-bold' },
    { step: '04', title: 'Invest & Earn', desc: 'Select top strategy experts and track daily ROI live.', icon: 'solar:graph-up-bold' },
  ];

  // Duplicate tickers for seamless marquee loop
  const marqueeItems = [...tickers, ...tickers];

  return (
    <div className="min-h-screen bg-[#0A0D0C] text-white flex flex-col font-sans">
      <Navbar mode="dark" onOpenCalculator={() => setIsCalcOpen(true)} />

      {/* 1. Hero Band */}
      <section className="relative overflow-hidden pt-4 pb-16 bg-[#0A0D0C] border-b border-[#202722]">
        <ThreeDPhoneHero />
      </section>

      {/* 2. Live Market Ticker */}
      <div className="bg-[#12161A] border-y border-[#202722] py-3 overflow-hidden font-mono text-xs text-[#A8ACB3]">
        <div className="flex space-x-12 animate-marquee whitespace-nowrap">
          {marqueeItems.map((item, idx) => (
            <div key={idx} className="inline-flex items-center gap-2">
              <span className="text-white font-semibold">{item.pair}</span>
              <span>{item.price}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${item.up ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-[#CF202F]/15 text-[#CF202F]'}`}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Stats Bar */}
      <section className="py-10 sm:py-16 bg-[#0A0D0C] border-b border-[#202722]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="p-6 bg-[#12161A] border border-[#202722] rounded-2xl">
              <p className="text-[10px] sm:text-xs uppercase font-mono text-[#A8ACB3] mb-2">Total AUM Managed</p>
              <h3 className="text-3xl sm:text-4xl font-mono font-normal text-white">
                <CountUpNumber end={4000000000} prefix="$" suffix="+" duration={2400} />
              </h3>
              <div className="mt-4 flex justify-center"><SignalLine width={96} delay={200} /></div>
            </div>
            <div className="p-6 bg-[#12161A] border border-[#202722] rounded-2xl">
              <p className="text-[10px] sm:text-xs uppercase font-mono text-[#A8ACB3] mb-2">Strategy Win Rate</p>
              <h3 className="text-3xl sm:text-4xl font-mono font-normal text-[#22C55E]">
                <CountUpNumber end={94.2} suffix="%" decimals={1} duration={2000} />
              </h3>
              <div className="mt-4 flex justify-center"><SignalLine width={96} delay={400} /></div>
            </div>
            <div className="p-6 bg-[#12161A] border border-[#202722] rounded-2xl">
              <p className="text-[10px] sm:text-xs uppercase font-mono text-[#A8ACB3] mb-2">Active Investors</p>
              <h3 className="text-3xl sm:text-4xl font-mono font-normal text-white">
                <CountUpNumber end={3000000} prefix="" suffix="+" duration={2200} />
              </h3>
              <div className="mt-4 flex justify-center"><SignalLine width={96} delay={600} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section className="py-16 sm:py-24 bg-white text-[#0A0D0C]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16 space-y-4">
            <h2 className="text-2xl sm:text-5xl font-normal text-[#0A0D0C]">
              Invest Smarter, Not Harder
            </h2>
            <p className="text-sm sm:text-base text-[#5B616E]">
              You deposit capital. Our verified experts execute strategies. Quantovest automatically manages your returns.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8">
            {steps.map((st, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                viewport={{ once: true }}
                className="p-5 sm:p-6 rounded-2xl bg-[#F7F7F7] border border-[#DEE1E6] space-y-4 relative"
              >
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-[#22C55E] bg-[#22C55E]/10 px-2.5 py-1 rounded-full">
                  STEP {st.step}
                </span>
                <div className="w-12 h-12 rounded-xl bg-[#0A0D0C] flex items-center justify-center">
                  <Icon icon={st.icon} className="w-6 h-6 text-[#22C55E]" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-[#0A0D0C]">{st.title}</h3>
                <p className="text-xs text-[#5B616E] leading-relaxed">{st.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10 sm:mt-12">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-[#0A0D0C] text-white text-sm font-semibold hover:bg-[#12161A] transition-colors"
            >
              Learn More About Our Investment Process
              <Icon icon="solar:alt-arrow-right-bold" className="w-4 h-4 text-[#22C55E]" />
            </Link>
          </div>
        </div>
      </section>

      {/* 5. Investment Plans Preview */}
      <section className="py-16 sm:py-24 bg-[#0A0D0C] text-white border-t border-[#202722]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-16 space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#22C55E]">Tailored Plans</span>
            <h2 className="text-2xl sm:text-5xl font-normal text-white">
              Transparent Capital Tiers
            </h2>
            <p className="text-sm sm:text-base text-[#A8ACB3]">
              Every tier is presented with transparent assumptions, risk context, and portfolio reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Starter */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#12161A] border border-[#202722] space-y-6">
              <div>
                <span className="text-xs font-mono text-[#A8ACB3]">TIER 1</span>
                <h3 className="text-xl sm:text-2xl font-normal text-white mt-1">Starter Plan</h3>
                <p className="text-2xl sm:text-3xl font-mono font-semibold text-[#22C55E] mt-3">$1,500 <span className="text-xs font-sans text-[#A8ACB3]">Min Deposit</span></p>
              </div>
              <div className="p-4 bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/30 space-y-1">
                <p className="text-xs text-[#A8ACB3]">ROI in 7 days</p>
                <p className="text-3xl font-mono text-[#22C55E] font-bold">15%</p>
              </div>
              <ul className="space-y-3 text-xs text-[#A8ACB3]">
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> FX & Top Crypto Asset Access</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Weekly ROI Distribution</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Standard Support Desk Access</li>
              </ul>
              <Link href="/signup" className="w-full block py-3.5 rounded-full text-center text-xs font-semibold bg-[#1A1F24] border border-[#202722] text-white hover:bg-[#202722] transition-colors">
                Select Starter Plan ($1,500)
              </Link>
            </div>

            {/* Growth */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#12161A] border-2 border-[#22C55E] space-y-6 relative shadow-2xl md:scale-105">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#22C55E] text-[#0A0D0C] font-mono text-[10px] font-bold uppercase tracking-wider">
                Most Popular
              </span>
              <div>
                <span className="text-xs font-mono text-[#22C55E]">TIER 2</span>
                <h3 className="text-xl sm:text-2xl font-normal text-white mt-1">Growth Plan</h3>
                <p className="text-2xl sm:text-3xl font-mono font-semibold text-[#22C55E] mt-3">$7,500 <span className="text-xs font-sans text-[#A8ACB3]">Min Deposit</span></p>
              </div>
              <div className="p-4 bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/30 space-y-1">
                <p className="text-xs text-[#A8ACB3]">ROI in 7 days</p>
                <p className="text-3xl font-mono text-[#22C55E] font-bold">25%</p>
              </div>
              <ul className="space-y-3 text-xs text-[#A8ACB3]">
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> FX, Crypto & US Stock Equities</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Dedicated Account Manager</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Priority Investment Execution</li>
              </ul>
              <Link href="/signup" className="w-full block py-3.5 rounded-full text-center text-xs font-semibold bg-[#22C55E] text-[#0A0D0C] hover:bg-[#16A34A] transition-colors shadow-lg">
                Select Growth Plan ($7,500)
              </Link>
            </div>

            {/* Elite */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#12161A] border border-[#202722] space-y-6">
              <div>
                <span className="text-xs font-mono text-[#A8ACB3]">TIER 3</span>
                <h3 className="text-xl sm:text-2xl font-normal text-white mt-1">Elite Plan</h3>
                <p className="text-2xl sm:text-3xl font-mono font-semibold text-[#22C55E] mt-3">$45,000 <span className="text-xs font-sans text-[#A8ACB3]">Min Deposit</span></p>
              </div>
              <div className="p-4 bg-[#22C55E]/10 rounded-xl border border-[#22C55E]/30 space-y-1">
                <p className="text-xs text-[#A8ACB3]">ROI in 7 days</p>
                <p className="text-3xl font-mono text-[#22C55E] font-bold">35%</p>
              </div>
              <ul className="space-y-3 text-xs text-[#A8ACB3]">
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Full Multi-Asset VIP Access</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> Custom Risk Control Directives</li>
                <li className="flex items-center gap-2"><Icon icon="solar:check-circle-bold" className="w-4 h-4 text-[#22C55E]" /> VIP Concierge & Direct Portfolio Manager Access</li>
              </ul>
              <Link href="/signup" className="w-full block py-3.5 rounded-full text-center text-xs font-semibold bg-[#1A1F24] border border-[#202722] text-white hover:bg-[#202722] transition-colors">
                Select Elite Plan ($45,000)
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <DynamicRoiCalculatorModal isOpen={isCalcOpen} onClose={() => setIsCalcOpen(false)} />
    </div>
  );
}
