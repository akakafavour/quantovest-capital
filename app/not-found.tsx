import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white text-[#0A0D0C] flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center">
        <span className="text-sm font-semibold tracking-wider uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          404 Not Found
        </span>
        <h1 className="text-4xl font-extrabold mt-6 mb-3 tracking-tight">
          Page does not exist
        </h1>
        <p className="text-gray-600 text-sm mb-8 leading-relaxed">
          The requested page could not be found or may have been relocated.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-xl transition duration-150 shadow-sm"
        >
          Return to Homepage
        </Link>
      </div>
    </div>
  );
}
