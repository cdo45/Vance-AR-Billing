"use client";

import Image from "next/image";
import NavBar from "./NavBar";

const NAVY = "#1F3864";

export default function SiteHeader() {
  return (
    <>
      <header className="text-white px-8 py-3 shadow-lg flex items-center gap-4"
        style={{ background: NAVY }}>
        {/* Logo — replace public/vance-logo.png with the real file */}
        <div className="flex-shrink-0">
          <Image
            src="/vance-logo.png"
            alt="Vance Corp"
            width={48}
            height={48}
            className="object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-wider uppercase">
            Vance Corp — Rental Billing
          </h1>
        </div>
      </header>
      <NavBar />
    </>
  );
}
