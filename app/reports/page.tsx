"use client";

import NavBar from "@/app/components/NavBar";

const NAVY   = "#1F3864";
const LTGRAY = "#F2F2F2";

export default function ReportsPage() {
  return (
    <div className="min-h-screen" style={{ background: LTGRAY, fontFamily: "Arial,Helvetica,sans-serif" }}>
      <header className="text-white px-8 py-4 shadow-lg" style={{ background: NAVY }}>
        <h1 className="text-2xl font-bold tracking-wider uppercase">Vance Corp — Rental Billing</h1>
      </header>
      <NavBar />
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h2 className="text-4xl font-bold uppercase tracking-wider mb-4" style={{ color: NAVY }}>
          Reports
        </h2>
        <p className="text-gray-400 text-lg">Coming Soon</p>
      </div>
    </div>
  );
}
