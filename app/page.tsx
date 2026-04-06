"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jobs from "@/data/jobs.json";

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface Toast {
  msg: string;
  type: "success" | "error";
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ALL_JOBS: Job[] = jobs as Job[];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type Day = typeof DAYS[number];
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const EMPTY_AMOUNTS: DayAmounts = { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSundayOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(sunday: Date): string {
  const sat = new Date(sunday);
  sat.setDate(sunday.getDate() + 6);
  const start = sunday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const end = sat.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Week of ${start} – ${end}`;
}

function formatTodayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function parseDollar(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function fmtBlur(num: number): string {
  return num > 0
    ? num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";
}

function fmtCurrency(num: number): string {
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtCell(num: number): string {
  return num > 0
    ? num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EntryForm() {
  // Week
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(new Date()));

  // Search / selection
  const [query, setQuery] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form
  const [amounts, setAmounts] = useState<DayAmounts>(EMPTY_AMOUNTS);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [notes, setNotes] = useState("");

  // UI
  const [toast, setToast] = useState<Toast | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [entries, setEntries] = useState<BillingEntry[]>([]);

  // Derived
  const filtered = query.trim() === ""
    ? ALL_JOBS.slice(0, 60)
    : ALL_JOBS.filter(j =>
        j.rj_number.toLowerCase().includes(query.toLowerCase()) ||
        j.company_name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 60);

  const weekTotal = DAYS.reduce((sum, d) => sum + parseDollar(amounts[d]), 0);

  // Fetch entries for current week
  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/entries?week=${toISO(weekStart)}`);
      if (res.ok) setEntries(await res.json());
    } catch {}
  }, [weekStart]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function pickJob(job: Job) {
    setSelectedJob(job);
    setQuery("");
    setShowDrop(false);
    inputRef.current?.blur();
  }

  function clearJob() {
    setSelectedJob(null);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleAmountFocus(day: Day) {
    const v = parseDollar(amounts[day]);
    setAmounts(p => ({ ...p, [day]: v > 0 ? String(v) : "" }));
  }

  function handleAmountBlur(day: Day) {
    const v = parseDollar(amounts[day]);
    setAmounts(p => ({ ...p, [day]: fmtBlur(v) }));
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
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Server error");
      }

      setToast({
        msg: `✓ Saved — ${selectedJob.rj_number} · ${fmtCurrency(weekTotal)}`,
        type: "success",
      });

      // Reset form, keep week
      setSelectedJob(null);
      setQuery("");
      setAmounts(EMPTY_AMOUNTS);
      setInvoiceNum("");
      setNotes("");
      await fetchEntries();
    } catch (err) {
      setToast({ msg: `Error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/entries/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setEntries(prev => prev.filter(e => e.id !== id));
      setToast({ msg: "Entry deleted.", type: "success" });
    } catch {
      setToast({ msg: "Failed to delete entry.", type: "error" });
    } finally {
      setDeleting(null);
    }
  }

  const colTotal = (day: Day) => entries.reduce((s, e) => s + Number(e[day]), 0);
  const grandTotal = entries.reduce((s, e) => s + Number(e.week_total), 0);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F2F2]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 rounded-lg px-6 py-3 text-white text-sm font-semibold shadow-2xl
            ${toast.type === "success" ? "bg-[#1E6B1E]" : "bg-red-600"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-[#1F3864] text-white px-8 py-4 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-2xl font-bold tracking-wider uppercase">Vance Corp</h1>
          <p className="text-sm text-blue-200 tracking-wide mt-0.5">Rental Billing</p>
        </div>
        <p className="text-sm text-blue-200">{formatTodayLong()}</p>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Week Selector ── */}
        <div className="bg-white rounded-2xl shadow-md px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => advanceWeek(-1)}
            className="w-10 h-10 rounded-full bg-[#1F3864] text-white text-xl font-bold
                       hover:bg-[#1F6B6B] transition flex items-center justify-center"
          >
            ‹
          </button>
          <div className="flex-1 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">Billing Period</p>
            <p className="text-xl font-bold text-[#1F3864]">{formatWeekRange(weekStart)}</p>
          </div>
          <button
            type="button"
            onClick={() => advanceWeek(1)}
            className="w-10 h-10 rounded-full bg-[#1F3864] text-white text-xl font-bold
                       hover:bg-[#1F6B6B] transition flex items-center justify-center"
          >
            ›
          </button>
        </div>

        {/* ── Entry Form ── */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-8 space-y-8">

          {/* Job Search */}
          <div>
            <label className="block text-xs font-bold text-[#1F6B6B] uppercase tracking-widest mb-2">
              RJ Number / Company
            </label>
            <div ref={searchRef} className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type RJ number or company name…"
                value={query}
                autoComplete="off"
                onChange={e => { setQuery(e.target.value); setShowDrop(true); }}
                onFocus={() => setShowDrop(true)}
                className="w-full border-2 border-gray-300 rounded-xl px-5 py-4 text-lg
                           focus:outline-none focus:border-[#1F6B6B] bg-white"
              />
              {showDrop && filtered.length > 0 && (
                <ul className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200
                               rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                  {filtered.map(job => (
                    <li
                      key={job.rj_number}
                      onMouseDown={() => pickJob(job)}
                      className="px-5 py-3 cursor-pointer hover:bg-[#F2F2F2] border-b border-gray-100 last:border-0
                                 flex items-baseline gap-3"
                    >
                      <span className="font-bold text-[#1F3864] text-sm w-28 shrink-0">{job.rj_number}</span>
                      <span className="text-gray-700 text-sm truncate">{job.company_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected job confirmation */}
            {selectedJob && (
              <div className="mt-4 flex items-center gap-4 px-5 py-4 bg-[#F2F2F2] rounded-xl border border-gray-200">
                <div className="flex-1">
                  <p className="text-2xl font-bold text-[#1F3864]">{selectedJob.rj_number}</p>
                  <p className="text-base text-gray-600 mt-0.5">{selectedJob.company_name}</p>
                </div>
                <button
                  type="button"
                  onClick={clearJob}
                  className="text-sm text-gray-400 hover:text-red-500 transition font-medium px-3 py-1
                             border border-gray-300 rounded-lg hover:border-red-400"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Daily Amounts */}
          <div>
            <label className="block text-xs font-bold text-[#1F6B6B] uppercase tracking-widest mb-3">
              Daily Amounts
            </label>
            <div className="grid grid-cols-7 gap-3">
              {DAYS.map((day, i) => (
                <div key={day} className="flex flex-col items-center gap-2">
                  <span className={`text-xs font-bold tracking-widest
                    ${day === "sun" || day === "sat" ? "text-[#C55A11]" : "text-gray-500"}`}>
                    {DAY_LABELS[i]}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={amounts[day]}
                    onChange={e => setAmounts(p => ({ ...p, [day]: e.target.value }))}
                    onFocus={() => handleAmountFocus(day)}
                    onBlur={() => handleAmountBlur(day)}
                    className="w-full border-2 border-gray-300 rounded-xl px-1 py-4 text-center text-base
                               font-semibold focus:outline-none focus:border-[#1F6B6B]
                               placeholder:text-gray-300 tabular-nums"
                  />
                </div>
              ))}
            </div>

            {/* Week Total */}
            <div className="mt-5 flex items-center justify-end gap-4 pr-1">
              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">Week Total</span>
              <span className="text-3xl font-bold text-[#C55A11] tabular-nums">
                {fmtCurrency(weekTotal)}
              </span>
            </div>
          </div>

          {/* Invoice & Notes */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-[#1F6B6B] uppercase tracking-widest mb-2">
                Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-0001"
                value={invoiceNum}
                onChange={e => setInvoiceNum(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl px-5 py-4 text-base
                           focus:outline-none focus:border-[#1F6B6B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#1F6B6B] uppercase tracking-widest mb-2">
                Notes <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Any remarks…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl px-5 py-4 text-base
                           focus:outline-none focus:border-[#1F6B6B]"
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1F3864] hover:bg-[#1F6B6B] disabled:bg-gray-400
                       text-white font-bold text-xl py-5 rounded-xl transition-colors
                       shadow-md tracking-wider uppercase"
          >
            {submitting ? "Saving…" : "Submit Entry"}
          </button>
        </form>

        {/* ── Recent Entries Table ── */}
        <section>
          <div className="flex items-baseline gap-3 mb-3 px-1">
            <h2 className="text-xs font-bold text-[#1F6B6B] uppercase tracking-widest">
              Entries This Week
            </h2>
            {entries.length > 0 && (
              <span className="text-xs text-gray-400">
                {entries.length} record{entries.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-md px-8 py-10 text-center text-gray-400 text-sm">
              No entries yet for this week.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1F3864] text-white text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">RJ #</th>
                    <th className="px-4 py-3 text-left">Company</th>
                    {DAY_LABELS.map(d => (
                      <th key={d} className="px-2 py-3 text-center">{d}</th>
                    ))}
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Invoice</th>
                    <th className="px-3 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-[#F2F2F2]"}`}
                    >
                      <td className="px-4 py-3 font-bold text-[#1F3864] whitespace-nowrap">
                        {entry.rj_number}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate whitespace-nowrap">
                        {entry.company_name}
                      </td>
                      {DAYS.map(day => (
                        <td
                          key={day}
                          className={`px-2 py-3 text-center tabular-nums
                            ${Number(entry[day]) > 0 ? "text-gray-700" : "text-gray-300"}`}
                        >
                          {fmtCell(Number(entry[day]))}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-bold text-[#C55A11] tabular-nums whitespace-nowrap">
                        {fmtCurrency(Number(entry.week_total))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {entry.invoice_number || "—"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting === entry.id}
                          className="text-xs text-gray-400 hover:text-red-600 transition font-medium
                                     px-2 py-1 rounded border border-gray-200 hover:border-red-400
                                     disabled:opacity-40"
                          title="Delete this entry"
                        >
                          {deleting === entry.id ? "…" : "Del"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1F3864] text-white font-bold text-sm">
                    <td colSpan={2} className="px-4 py-3 text-right text-xs uppercase tracking-wider">
                      Week Total
                    </td>
                    {DAYS.map(day => (
                      <td key={day} className="px-2 py-3 text-center tabular-nums text-xs">
                        {colTotal(day) > 0 ? fmtBlur(colTotal(day)) : <span className="opacity-40">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right text-[#C55A11] tabular-nums">
                      {fmtCurrency(grandTotal)}
                    </td>
                    <td colSpan={2}></td>
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
