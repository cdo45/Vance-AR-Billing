"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jobs from "@/data/jobs.json";

// ── Types ──────────────────────────────────────────────────────────────────
interface Job {
  rj_number: string;
  job_description: string;
  company_name: string;
}

interface DayAmounts {
  sun: string;
  mon: string;
  tue: string;
  wed: string;
  thu: string;
  fri: string;
  sat: string;
}

interface BillingEntry {
  id: number;
  rj_number: string;
  company_name: string;
  job_description: string;
  week_start: string;
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  week_total: number;
  invoice_number: string;
  notes: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const ALL_JOBS: Job[] = jobs as Job[];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function getSundayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function formatWeekRange(sunday: Date): string {
  const sat = new Date(sunday);
  sat.setDate(sunday.getDate() + 6);
  const startStr = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr = sat.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Week of ${startStr} – ${endStr}`;
}

function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDollar(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function formatDollar(num: number): string {
  if (num === 0) return "";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCurrency(num: number): string {
  return num.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function EntryForm() {
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(new Date()));

  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const [amounts, setAmounts] = useState<DayAmounts>({ sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" });
  const [invoiceNum, setInvoiceNum] = useState("");
  const [notes, setNotes] = useState("");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recentEntries, setRecentEntries] = useState<BillingEntry[]>([]);

  const filtered = query.trim().length === 0
    ? ALL_JOBS.slice(0, 50)
    : ALL_JOBS.filter(j =>
        j.rj_number.toLowerCase().includes(query.toLowerCase()) ||
        j.company_name.toLowerCase().includes(query.toLowerCase()) ||
        j.job_description.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50);

  const weekTotal = DAYS.reduce((sum, d) => sum + parseDollar(amounts[d]), 0);

  const fetchRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/entries?week=${toISO(weekStart)}`);
      if (res.ok) setRecentEntries(await res.json());
    } catch {}
  }, [weekStart]);

  useEffect(() => { fetchRecent(); }, [fetchRecent]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function selectJob(job: Job) {
    setSelectedJob(job);
    setQuery(job.rj_number);
    setShowDropdown(false);
  }

  function handleAmountBlur(day: keyof DayAmounts) {
    const val = parseDollar(amounts[day]);
    setAmounts(prev => ({ ...prev, [day]: val > 0 ? formatDollar(val) : "" }));
  }

  function handleAmountFocus(day: keyof DayAmounts) {
    const val = parseDollar(amounts[day]);
    setAmounts(prev => ({ ...prev, [day]: val > 0 ? String(val) : "" }));
  }

  function advanceWeek(delta: number) {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedJob) {
      setToast({ msg: "Please select an RJ number before submitting.", type: "error" });
      return;
    }
    if (weekTotal === 0) {
      setToast({ msg: "Enter at least one day amount before submitting.", type: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        rj_number: selectedJob.rj_number,
        company_name: selectedJob.company_name,
        job_description: selectedJob.job_description,
        week_start: toISO(weekStart),
        sun: parseDollar(amounts.sun),
        mon: parseDollar(amounts.mon),
        tue: parseDollar(amounts.tue),
        wed: parseDollar(amounts.wed),
        thu: parseDollar(amounts.thu),
        fri: parseDollar(amounts.fri),
        sat: parseDollar(amounts.sat),
        invoice_number: invoiceNum,
        notes,
      };

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      setToast({ msg: `Entry saved — ${selectedJob.rj_number} · ${formatCurrency(weekTotal)}`, type: "success" });

      setSelectedJob(null);
      setQuery("");
      setAmounts({ sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" });
      setInvoiceNum("");
      setNotes("");

      await fetchRecent();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setToast({ msg: `Error: ${msg}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-ltgray">
      {/* Header */}
      <header className="bg-navy text-white px-6 py-4 flex items-center justify-between shadow-md">
        <div>
          <h1 className="text-xl font-bold tracking-wide">VANCE CORP</h1>
          <p className="text-sm text-blue-200">AR Billing Tracker</p>
        </div>
        <span className="text-sm text-blue-200 italic">Dispatcher Entry</span>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 z-50 rounded-lg px-5 py-3 text-white text-sm font-medium shadow-xl
              ${toast.type === "success" ? "bg-dkgreen" : "bg-red-600"}`}
          >
            {toast.msg}
          </div>
        )}

        {/* Week Selector */}
        <section className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => advanceWeek(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-navy text-white hover:bg-teal transition text-lg font-bold"
            aria-label="Previous week"
          >
            ‹
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-0.5">Billing Period</p>
            <p className="text-lg font-semibold text-navy">{formatWeekRange(weekStart)}</p>
          </div>
          <button
            type="button"
            onClick={() => advanceWeek(1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-navy text-white hover:bg-teal transition text-lg font-bold"
            aria-label="Next week"
          >
            ›
          </button>
        </section>

        {/* Entry Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-6">

          {/* RJ Number search */}
          <div>
            <label className="block text-xs font-semibold text-teal uppercase tracking-widest mb-1">
              RJ Number
            </label>
            <div ref={searchRef} className="relative">
              <input
                type="text"
                placeholder="Type RJ# or company name…"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) setSelectedJob(null);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-teal"
                autoComplete="off"
              />
              {showDropdown && filtered.length > 0 && (
                <ul className="absolute z-30 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-xl max-h-64 overflow-y-auto">
                  {filtered.map(job => (
                    <li
                      key={job.rj_number}
                      className="px-4 py-2.5 cursor-pointer hover:bg-ltgray border-b border-gray-100 last:border-0"
                      onMouseDown={() => selectJob(job)}
                    >
                      <span className="font-semibold text-navy text-sm">{job.rj_number}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      <span className="text-sm text-gray-700">{job.company_name}</span>
                      <p className="text-xs text-gray-400 mt-0.5">{job.job_description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Auto-filled job info */}
          {selectedJob && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Company</label>
                <div className="bg-ltgray border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 font-medium">
                  {selectedJob.company_name}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Job Description</label>
                <div className="bg-ltgray border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
                  {selectedJob.job_description}
                </div>
              </div>
            </div>
          )}

          {/* Day amounts */}
          <div>
            <label className="block text-xs font-semibold text-teal uppercase tracking-widest mb-2">
              Daily Amounts
            </label>
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className={`text-xs font-bold tracking-widest
                    ${day === "sun" || day === "sat" ? "text-orange" : "text-gray-500"}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amounts[day]}
                    onChange={e => setAmounts(prev => ({ ...prev, [day]: e.target.value }))}
                    onFocus={() => handleAmountFocus(day)}
                    onBlur={() => handleAmountBlur(day)}
                    className="w-full border-2 border-gray-300 rounded-lg px-2 py-3 text-center text-base font-medium
                               focus:outline-none focus:border-teal placeholder:text-gray-300"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Week Total */}
          <div className="flex items-center justify-end gap-3 px-1">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Week Total</span>
            <span className="text-2xl font-bold text-orange tabular-nums">
              {formatCurrency(weekTotal)}
            </span>
          </div>

          {/* Invoice # and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-teal uppercase tracking-widest mb-1">
                Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-0042"
                value={invoiceNum}
                onChange={e => setInvoiceNum(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-teal"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-teal uppercase tracking-widest mb-1">
                Notes <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Any remarks…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:border-teal"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy hover:bg-teal disabled:bg-gray-400 text-white font-bold text-lg
                       py-4 rounded-xl transition-colors shadow-md tracking-wide uppercase"
          >
            {submitting ? "Saving…" : "Submit Entry"}
          </button>
        </form>

        {/* Recent Entries Table */}
        <section>
          <h2 className="text-xs font-bold text-teal uppercase tracking-widest mb-2 px-1">
            Entries This Week
            {recentEntries.length > 0 && (
              <span className="ml-2 text-gray-400 font-normal normal-case">
                ({recentEntries.length} record{recentEntries.length !== 1 ? "s" : ""})
              </span>
            )}
          </h2>

          {recentEntries.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-6 py-8 text-center text-gray-400 text-sm">
              No entries yet for this week.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy text-white text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">RJ #</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    <th className="px-3 py-3 text-center">Sun</th>
                    <th className="px-3 py-3 text-center">Mon</th>
                    <th className="px-3 py-3 text-center">Tue</th>
                    <th className="px-3 py-3 text-center">Wed</th>
                    <th className="px-3 py-3 text-center">Thu</th>
                    <th className="px-3 py-3 text-center">Fri</th>
                    <th className="px-3 py-3 text-center">Sat</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((entry, i) => (
                    <tr key={entry.id} className={i % 2 === 0 ? "bg-white" : "bg-ltgray"}>
                      <td className="px-4 py-2.5 font-semibold text-navy whitespace-nowrap">{entry.rj_number}</td>
                      <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[180px] truncate">{entry.company_name}</td>
                      {DAYS.map(day => (
                        <td key={day} className="px-3 py-2.5 text-center tabular-nums text-gray-600">
                          {entry[day] > 0 ? formatDollar(entry[day]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-right font-bold text-orange tabular-nums whitespace-nowrap">
                        {formatCurrency(entry.week_total)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{entry.invoice_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-navy text-white font-bold text-sm">
                    <td colSpan={2} className="px-4 py-2.5 text-right text-xs uppercase tracking-wider">Week Total</td>
                    {DAYS.map(day => (
                      <td key={day} className="px-3 py-2.5 text-center tabular-nums">
                        {(() => {
                          const s = recentEntries.reduce((sum, e) => sum + e[day], 0);
                          return s > 0 ? formatDollar(s) : <span className="opacity-40">—</span>;
                        })()}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-orange tabular-nums">
                      {formatCurrency(recentEntries.reduce((s, e) => s + e.week_total, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
