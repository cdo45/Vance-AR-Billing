"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import SiteHeader from "@/app/components/SiteHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  rj_number: string;
  job_description: string;
  company_name: string;
  customer_id?: number | null;
}

interface DayAmounts {
  sun: string; mon: string; tue: string; wed: string;
  thu: string; fri: string; sat: string;
}

interface BillingEntry {
  id: number;
  rj_number: string;
  company_name: string;
  job_description: string;
  week_start: string;
  sun: number; mon: number; tue: number; wed: number;
  thu: number; fri: number; sat: number;
  week_total: number;
  invoice_number: string;
  notes: string;
  work_description: string;
  prelim_date: string | null;
  status: string;
  created_at: string;
}

interface GridRow {
  rj_number: string;
  company_name: string;
  rowStatus: string;
  invoices: string[];
  days: Record<string, { total: number; descs: string[] }>;
  rowTotal: number;
  entries: BillingEntry[];
}

interface Toast { msg: string; type: "success" | "error"; }

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
type Day = typeof DAYS[number];
const DAY_LABELS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const EMPTY_AMOUNTS: DayAmounts = { sun:"",mon:"",tue:"",wed:"",thu:"",fri:"",sat:"" };
const NAVY   = "#1F3864";
const TEAL   = "#1F6B6B";
const ORANGE = "#C8102E";
const DKGREEN = "#1E6B1E";
const LTGRAY  = "#F2F2F2";

const STATUS_ORDER = ["pending","invoiced","received"] as const;
type EntryStatus = typeof STATUS_ORDER[number];
const STATUS_ROW_BG:     Record<string,string> = { pending:"#EFF6FF", invoiced:"#FEFCE8", received:"#F0FDF4" };
const STATUS_BADGE_BG:   Record<string,string> = { pending:"#DBEAFE", invoiced:"#FEF9C3", received:"#DCFCE7" };
const STATUS_BADGE_CLR:  Record<string,string> = { pending:"#1e40af", invoiced:"#92400e", received:"#14532d" };
const STATUS_FORM_BG:    Record<string,string> = { pending:"#DBEAFE", invoiced:"#FEF9C3", received:"#DCFCE7" };
const STATUS_FORM_BORDER:Record<string,string> = { pending:"#93c5fd", invoiced:"#fbbf24", received:"#86efac" };
const STATUS_FORM_TEXT:  Record<string,string> = { pending:NAVY,      invoiced:"#78350f", received:DKGREEN  };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSundayOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0,0,0,0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}
function toISO(d: Date) { return d.toISOString().slice(0,10); }
function formatWeekRange(sun: Date) {
  const sat = new Date(sun); sat.setDate(sun.getDate()+6);
  return `Week of ${sun.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${sat.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
}
function formatTodayLong() {
  return new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
}
function parseDollar(v: string) { const n=parseFloat(v.replace(/[^0-9.]/g,"")); return isNaN(n)?0:n; }
function fmtBlur(n: number) { return n>0?n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}):""; }
function fmtCurrency(n: number) { return n.toLocaleString("en-US",{style:"currency",currency:"USD"}); }


// ─── Component ────────────────────────────────────────────────────────────────
export default function EntryForm() {
  // Jobs
  const [allJobs, setAllJobs]       = useState<Job[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);

  // Week
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(new Date()));

  // Search / selection
  const [query, setQuery]                       = useState("");
  const [showDrop, setShowDrop]                 = useState(false);
  const [selectedJob, setSelectedJob]           = useState<Job|null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number|null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Custom job flow
  const [isCustom, setIsCustom]         = useState(false);
  const [customCompany, setCustomCompany] = useState("");
  const [customDesc, setCustomDesc]       = useState("");

  // Form
  const [amounts, setAmounts]   = useState<DayAmounts>(EMPTY_AMOUNTS);
  const [invoiceNum, setInvoiceNum] = useState("");
  const [notes, setNotes]           = useState("");

  // Work description + prelim date
  const [workDesc, setWorkDesc]     = useState("");
  const [prelimDate, setPrelimDate] = useState("");

  // DB status & company autocomplete
  const [dbStatus, setDbStatus]     = useState<"loading"|"ok"|"error">("loading");
  const [companies, setCompanies]   = useState<string[]>([]);
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);

  // Entry status
  const [entryStatus, setEntryStatus] = useState<EntryStatus>("pending");

  // UI state
  const [toast, setToast]         = useState<Toast|null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [entries, setEntries]     = useState<BillingEntry[]>([]);

  // Edit entry modal state
  const [editEntry, setEditEntry]   = useState<BillingEntry|null>(null);
  const [editModalView, setEditModalView] = useState<"edit"|"history">("edit");
  const [editAmounts, setEditAmounts] = useState<DayAmounts>(EMPTY_AMOUNTS);
  const [editInvoice, setEditInvoice] = useState("");
  const [editNotes, setEditNotes]     = useState("");
  const [editWorkDesc, setEditWorkDesc] = useState("");
  const [editPrelim, setEditPrelim]   = useState("");
  const [editReason, setEditReason]   = useState("");
  const [editSaving, setEditSaving]   = useState(false);

  // Audit log inside edit modal
  interface AuditRow { id: number; entry_id: number; field_changed: string; old_value: string; new_value: string; reason: string; edited_at: string; edited_by: string; }
  const [editHistoryLog, setEditHistoryLog]       = useState<AuditRow[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);

  // Inline status dropdown
  const [openStatusRowKey, setOpenStatusRowKey] = useState<string|null>(null);

  // Hover tooltip (CHANGE 5)
  interface HoveredCell { rowKey: string; day: string; x: number; y: number; }
  const [hoveredCell, setHoveredCell] = useState<HoveredCell|null>(null);

  // Post-save "Mark as Invoiced?" prompt (CHANGE 6)
  const [showInvoicedPrompt, setShowInvoicedPrompt] = useState(false);
  const [promptEntryId, setPromptEntryId] = useState<number|null>(null);
  const [editOriginalHadAmounts, setEditOriginalHadAmounts] = useState(false);

  // ── Load jobs from API ──
  useEffect(() => {
    fetch("/api/jobs")
      .then(r => r.ok ? r.json() : [])
      .then((data: Job[]) => { setAllJobs(Array.isArray(data)?data:[]); setJobsLoaded(true); })
      .catch(() => { setAllJobs([]); setJobsLoaded(true); });
  }, []);

  // ── DB health check ──
  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(d => setDbStatus(d.status === "ok" ? "ok" : "error"))
      .catch(() => setDbStatus("error"));
  }, []);

  // ── Load company names for autocomplete ──
  useEffect(() => {
    fetch("/api/companies")
      .then(r => r.ok ? r.json() : [])
      .then((d: string[]) => setCompanies(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  // ── Fetch entries for selected week ──
  const fetchEntries = useCallback(async () => {
    try {
      const r = await fetch(`/api/entries?week=${toISO(weekStart)}`);
      if (r.ok) setEntries(await r.json());
    } catch {}
  }, [weekStart]);
  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // ── Close dropdowns on outside click ──
  useEffect(() => {
    function down(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) setShowCompanyDrop(false);
      const target = e.target as HTMLElement;
      if (!target.closest("[data-status-pill]")) setOpenStatusRowKey(null);
    }
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, []);

  // ── Toast auto-dismiss ──
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Derived ──
  const queryLc = query.toLowerCase().trim();
  const filtered = queryLc === ""
    ? allJobs.slice(0,60)
    : allJobs.filter(j =>
        j.rj_number.toLowerCase().includes(queryLc) ||
        j.company_name.toLowerCase().includes(queryLc)
      ).slice(0,59);

  const hasExactMatch = allJobs.some(j => j.rj_number.toLowerCase() === queryLc);
  const showAddNew = queryLc !== "" && !hasExactMatch && !selectedJob && !isCustom;

  const weekTotal = DAYS.reduce((s,d) => s+parseDollar(amounts[d]), 0);

  // Day dates for the selected week (used in both form labels and right panel)
  const dayDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });

  // How many entries per company this week (for orange multi-job highlight)
  const companyCount: Record<string, number> = {};
  for (const e of entries) {
    companyCount[e.company_name] = (companyCount[e.company_name] || 0) + 1;
  }

  // Invoice duplicate check (FIX 5) — purely derived from existing entries state
  const invoiceTrim = invoiceNum.trim().toUpperCase();
  const duplicateInvoice = invoiceTrim
    ? entries.find(e => e.invoice_number.trim().toUpperCase() === invoiceTrim) ?? null
    : null;

  // Chart data: daily totals for the week
  const chartData = DAYS.map((day,i) => ({
    day: DAY_LABELS[i],
    total: entries.reduce((s,e) => s+Number(e[day]), 0),
  }));
  const grandTotal = entries.reduce((s,e) => s+Number(e.week_total), 0);

  // Grouped rows: collapse multiple entries with same RJ# into one grid row
  const rowMap: Record<string, GridRow> = {};
  for (const e of entries) {
    if (!rowMap[e.rj_number]) {
      rowMap[e.rj_number] = {
        rj_number: e.rj_number, company_name: e.company_name,
        rowStatus: "received", invoices: [], days: {}, rowTotal: 0, entries: [],
      };
    }
    const g = rowMap[e.rj_number];
    g.entries.push(e);
    if (e.invoice_number && !g.invoices.includes(e.invoice_number)) g.invoices.push(e.invoice_number);
    for (const day of DAYS) {
      const amt = Number(e[day]);
      if (!g.days[day]) g.days[day] = { total: 0, descs: [] };
      g.days[day].total += amt;
      if (amt > 0 && e.work_description && !g.days[day].descs.includes(e.work_description))
        g.days[day].descs.push(e.work_description);
    }
    g.rowTotal += Number(e.week_total);
    const eStat = (e.status || "pending") as EntryStatus;
    if (STATUS_ORDER.indexOf(eStat) < STATUS_ORDER.indexOf(g.rowStatus as EntryStatus))
      g.rowStatus = eStat;
  }
  const gridRows = Object.values(rowMap);
  // CHANGE 4: Sort by RJ year asc, suffix asc, then company A-Z
  const rjSort = (a: GridRow, b: GridRow) => {
    const parse = (s: string): [number,number] => {
      const m = s.match(/RJ(\d+)-(\d+)/i);
      return m ? [parseInt(m[1]), parseInt(m[2])] : [9999, 9999];
    };
    const [ay, an] = parse(a.rj_number);
    const [by, bn] = parse(b.rj_number);
    if (ay !== by) return ay - by;
    if (an !== bn) return an - bn;
    return a.company_name.localeCompare(b.company_name);
  };
  gridRows.sort(rjSort);

  // ── Actions ──
  function pickJob(job: Job) {
    setSelectedJob(job); setQuery(""); setShowDrop(false);
    setIsCustom(false); setCustomCompany(""); setCustomDesc("");
    setSelectedCustomerId(job.customer_id ?? null);
  }
  function pickCustom() {
    setIsCustom(true); setShowDrop(false); setSelectedJob(null);
    setCustomCompany(""); setCustomDesc("");
  }
  function cancelCustom() {
    setIsCustom(false); setCustomCompany(""); setCustomDesc("");
    setWorkDesc(""); setPrelimDate(""); setSelectedCustomerId(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function clearJob() {
    setSelectedJob(null); setQuery(""); setSelectedCustomerId(null);
    setIsCustom(false); setCustomCompany(""); setCustomDesc("");
    setWorkDesc(""); setPrelimDate("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }
  function advanceWeek(delta: number) {
    setWeekStart(prev => { const d=new Date(prev); d.setDate(d.getDate()+delta*7); return d; });
  }
  function handleAmountFocus(day: Day) {
    const v = parseDollar(amounts[day]);
    setAmounts(p => ({...p,[day]:v>0?String(v):""}));
  }
  function handleAmountBlur(day: Day) {
    const v = parseDollar(amounts[day]);
    setAmounts(p => ({...p,[day]:fmtBlur(v)}));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!selectedJob && !isCustom) {
      setToast({msg:"Please select an RJ number before submitting.",type:"error"}); return;
    }
    if (isCustom && !customCompany.trim()) {
      setToast({msg:"Company Name is required for new jobs.",type:"error"}); return;
    }
    if (!workDesc.trim()) {
      setToast({msg:"Work Description is required.",type:"error"}); return;
    }

    setSubmitting(true);
    try {
      const rj = selectedJob ? selectedJob.rj_number : query.trim();
      const company = selectedJob ? selectedJob.company_name : customCompany.trim();
      const description = selectedJob ? selectedJob.job_description : customDesc.trim();
      // Auto-set status to pending when no amounts entered
      const finalStatus = weekTotal === 0 ? "pending" : entryStatus;

      // If it's a new custom job, save it to the database first
      if (isCustom) {
        await fetch("/api/jobs", {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({rj_number:rj, company_name:company, job_description:description}),
        });
        // Refresh the jobs list so it shows up next time
        fetch("/api/jobs").then(r=>r.json()).then((d:Job[])=>setAllJobs(Array.isArray(d)?d:[])).catch(()=>{});
      }

      const res = await fetch("/api/entries", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          rj_number:rj, company_name:company, job_description:description,
          week_start:toISO(weekStart),
          sun:parseDollar(amounts.sun), mon:parseDollar(amounts.mon),
          tue:parseDollar(amounts.tue), wed:parseDollar(amounts.wed),
          thu:parseDollar(amounts.thu), fri:parseDollar(amounts.fri),
          sat:parseDollar(amounts.sat),
          invoice_number:invoiceNum, notes,
          work_description:workDesc,
          prelim_date:prelimDate||null,
          customer_id:selectedCustomerId,
          status:finalStatus,
        }),
      });
      if (!res.ok) { const err=await res.json(); throw new Error(err.error||"Server error"); }

      setToast({msg:`✓ Saved — ${rj} · ${weekTotal>0?fmtCurrency(weekTotal):"TBD (pending)"}`,type:"success"});
      setSelectedJob(null); setQuery(""); setAmounts(EMPTY_AMOUNTS);
      setInvoiceNum(""); setNotes(""); setWorkDesc(""); setPrelimDate("");
      setSelectedCustomerId(null); setIsCustom(false);
      setCustomCompany(""); setCustomDesc(""); setEntryStatus("pending");
      await fetchEntries();
    } catch(err) {
      setToast({msg:`Error: ${err instanceof Error?err.message:"Unknown"}`,type:"error"});
    } finally { setSubmitting(false); }
  }


  function openEditEntry(entry: BillingEntry) {
    setEditEntry(entry);
    setEditModalView("edit");
    setOpenStatusRowKey(null);
    setEditOriginalHadAmounts(DAYS.some(d => Number(entry[d]) > 0));
    setEditAmounts({
      sun: entry.sun > 0 ? fmtBlur(Number(entry.sun)) : "",
      mon: entry.mon > 0 ? fmtBlur(Number(entry.mon)) : "",
      tue: entry.tue > 0 ? fmtBlur(Number(entry.tue)) : "",
      wed: entry.wed > 0 ? fmtBlur(Number(entry.wed)) : "",
      thu: entry.thu > 0 ? fmtBlur(Number(entry.thu)) : "",
      fri: entry.fri > 0 ? fmtBlur(Number(entry.fri)) : "",
      sat: entry.sat > 0 ? fmtBlur(Number(entry.sat)) : "",
    });
    setEditInvoice(entry.invoice_number || "");
    setEditNotes(entry.notes || "");
    setEditWorkDesc(entry.work_description || "");
    setEditPrelim(entry.prelim_date || "");
    setEditReason("");
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editEntry) return;
    if (!editReason.trim()) {
      setToast({msg:"Reason for edit is required.",type:"error"}); return;
    }
    setEditSaving(true);
    try {
      const r = await fetch(`/api/entries/${editEntry.id}`, {
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          sun:parseDollar(editAmounts.sun), mon:parseDollar(editAmounts.mon),
          tue:parseDollar(editAmounts.tue), wed:parseDollar(editAmounts.wed),
          thu:parseDollar(editAmounts.thu), fri:parseDollar(editAmounts.fri),
          sat:parseDollar(editAmounts.sat),
          invoice_number:editInvoice, notes:editNotes,
          work_description:editWorkDesc, prelim_date:editPrelim||null,
          reason:editReason,
        }),
      });
      if (!r.ok) { const err=await r.json(); throw new Error(err.error||"Server error"); }
      setToast({msg:"Entry updated.",type:"success"});
      // CHANGE 6: prompt to mark invoiced if amounts were just added to a pending entry
      const newTotal = DAYS.reduce((s,d)=>s+parseDollar(editAmounts[d]),0);
      const savedId = editEntry.id;
      const wasStillPending = (editEntry.status||"pending") === "pending";
      setEditEntry(null);
      await fetchEntries();
      if (!editOriginalHadAmounts && newTotal > 0 && wasStillPending) {
        setPromptEntryId(savedId);
        setShowInvoicedPrompt(true);
      }
    } catch(err) {
      setToast({msg:`Error: ${err instanceof Error?err.message:"Unknown"}`,type:"error"});
    } finally { setEditSaving(false); }
  }

  async function loadAndShowHistory() {
    if (!editEntry) return;
    setEditModalView("history");
    setEditHistoryLoading(true);
    setEditHistoryLog([]);
    try {
      const r = await fetch(`/api/entries/${editEntry.id}/audit`);
      if (r.ok) setEditHistoryLog(await r.json());
    } catch { /* ignore */ }
    finally { setEditHistoryLoading(false); }
  }

  async function setEntryStatusDirect(entryId: number, newStatus: EntryStatus) {
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, status: newStatus } : e));
    setOpenStatusRowKey(null);
    try {
      await fetch(`/api/entries/${entryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch { /* non-critical */ }
  }


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{background:LTGRAY,fontFamily:"Arial,Helvetica,sans-serif"}}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl px-6 py-3 text-white text-sm font-semibold shadow-2xl"
          style={{background:toast.type==="success"?DKGREEN:"#dc2626"}}>
          {toast.msg}
        </div>
      )}

      <SiteHeader />

      {/* DB status + date bar */}
      <div className="w-full px-4 md:px-6 lg:px-8 pt-3 flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
            background: dbStatus==="ok" ? "#22c55e" : dbStatus==="error" ? "#ef4444" : "#9ca3af"
          }}/>
          <span className="uppercase tracking-wider font-semibold">
            {dbStatus==="loading" ? "Connecting…" : dbStatus==="ok" ? "DB Connected" : "DB Error"}
          </span>
        </div>
        <p className="uppercase tracking-wider">{formatTodayLong()}</p>
      </div>

      {/* Week Selector — full width above both columns */}
      <div className="w-full px-2 md:px-4 lg:px-8 pt-6">
        <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center gap-4 mb-6">
          <button type="button" onClick={()=>advanceWeek(-1)}
            className="w-10 h-10 rounded-full text-white text-xl font-bold flex items-center justify-center transition hover:opacity-80"
            style={{background:NAVY}}>‹</button>
          <div className="flex-1 text-center">
            <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">Billing Period</p>
            <p className="text-xl font-bold" style={{color:NAVY}}>{formatWeekRange(weekStart)}</p>
          </div>
          <button type="button" onClick={()=>advanceWeek(1)}
            className="w-10 h-10 rounded-full text-white text-xl font-bold flex items-center justify-center transition hover:opacity-80"
            style={{background:NAVY}}>›</button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="w-full px-2 md:px-4 lg:px-8 pb-10">
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── LEFT: Entry Form ── */}
          <form onSubmit={handleSubmit} className="w-full lg:w-[40%] flex-shrink-0 bg-white rounded-2xl shadow p-6 space-y-6">

            {/* Job Search */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                RJ Number / Company
              </label>
              <div ref={searchRef} className="relative">
                <input ref={inputRef} type="text" autoComplete="off"
                  placeholder={jobsLoaded ? "Type RJ# or company name…" : "Loading jobs…"}
                  disabled={!!selectedJob || isCustom}
                  value={query}
                  onChange={e=>{setQuery(e.target.value);setShowDrop(true);}}
                  onFocus={()=>setShowDrop(true)}
                  className="w-full border-2 border-gray-300 rounded-xl px-5 py-4 text-lg
                             focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  style={{borderColor:showDrop&&(filtered.length>0||showAddNew)?"#1F6B6B":undefined}}
                />

                {/* Dropdown */}
                {showDrop && (filtered.length>0||showAddNew) && (
                  <ul className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200
                                 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
                    {filtered.map(job=>(
                      <li key={job.rj_number} onMouseDown={()=>pickJob(job)}
                        className="px-5 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-baseline gap-3">
                        <span className="font-bold text-sm w-28 shrink-0" style={{color:NAVY}}>{job.rj_number}</span>
                        <span className="text-sm text-gray-600 truncate">{job.company_name}</span>
                      </li>
                    ))}
                    {showAddNew && (
                      <li onMouseDown={pickCustom}
                        className="px-5 py-3 cursor-pointer border-t-2 flex items-center gap-2 font-semibold text-sm"
                        style={{borderColor:TEAL,color:TEAL,background:"#f0fafa"}}>
                        <span className="text-lg font-bold">+</span>
                        <span className="uppercase tracking-wider">Add New Job:</span>{" "}<span className="font-bold" style={{color:NAVY}}>{query}</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {/* Selected job confirmation */}
              {selectedJob && (
                <div className="mt-3 flex items-center gap-3 px-5 py-4 rounded-xl border"
                  style={{background:LTGRAY,borderColor:"#d1d5db"}}>
                  <div className="flex-1">
                    <p className="text-2xl font-bold" style={{color:NAVY}}>{selectedJob.rj_number}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{selectedJob.company_name}</p>
                  </div>
                  <button type="button" onClick={clearJob}
                    className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 px-3 py-1 border rounded-lg hover:border-red-400 transition"
                    style={{borderColor:"#d1d5db"}}>Change</button>
                </div>
              )}

              {/* Custom job fields */}
              {isCustom && (
                <div className="mt-3 p-4 rounded-xl border-2 space-y-3" style={{borderColor:TEAL,background:"#f0fafa"}}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold" style={{color:NAVY}}>New Job: <span style={{color:TEAL}}>{query}</span></p>
                    <button type="button" onClick={cancelCustom}
                      className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-red-500 transition">✕ Cancel</button>
                  </div>
                  <div ref={companyRef} className="relative">
                    <input type="text" placeholder="Company Name (required)"
                      value={customCompany}
                      onChange={e=>{setCustomCompany(e.target.value);setShowCompanyDrop(true);}}
                      onFocus={()=>setShowCompanyDrop(true)}
                      className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none"
                      style={{borderColor:customCompany?"#1F6B6B":undefined}}
                    />
                    {showCompanyDrop && customCompany && (() => {
                      const filtered = companies.filter(c=>c.toLowerCase().includes(customCompany.toLowerCase())).slice(0,10);
                      return filtered.length>0 ? (
                        <ul className="absolute z-40 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                          {filtered.map(c=>(
                            <li key={c} onMouseDown={()=>{setCustomCompany(c);setShowCompanyDrop(false);}}
                              className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm text-gray-700">
                              {c}
                            </li>
                          ))}
                        </ul>
                      ) : null;
                    })()}
                  </div>
                  <input type="text" placeholder="Job Description (optional)"
                    value={customDesc} onChange={e=>setCustomDesc(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Work Description */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                Work Description <span className="text-red-400 font-bold">*</span>
              </label>
              <input type="text" placeholder="Describe the work performed…"
                value={workDesc} onChange={e=>setWorkDesc(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                style={{borderColor:workDesc.trim()?TEAL:undefined}}
              />
            </div>

            {/* Prelim Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                  Prelim Date <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <input type="date"
                  value={prelimDate} onChange={e=>setPrelimDate(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                  style={{borderColor:prelimDate?TEAL:undefined}}
                />
                <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Date prelim was sent to customer</p>
              </div>
            </div>

            {/* Day Amount Inputs */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-3" style={{color:TEAL}}>
                Daily Amounts
              </label>
              <div className="grid grid-cols-7 gap-2">
                {DAYS.map((day,i)=>(
                  <div key={day} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold tracking-widest"
                      style={{color:day==="sun"||day==="sat"?ORANGE:"#6b7280"}}>
                      {DAY_LABELS[i]}
                    </span>
                    <span className="text-xs text-gray-400 leading-none mb-0.5">{dayDates[i]}</span>
                    <input type="text" inputMode="decimal" placeholder="—"
                      value={amounts[day]}
                      onChange={e=>setAmounts(p=>({...p,[day]:e.target.value}))}
                      onFocus={()=>handleAmountFocus(day)}
                      onBlur={()=>handleAmountBlur(day)}
                      className="w-full border-2 border-gray-300 rounded-xl px-1 py-4 text-center
                                 text-sm font-semibold focus:outline-none tabular-nums placeholder:text-gray-300"
                      style={{borderColor:parseDollar(amounts[day])>0?TEAL:undefined}}
                    />
                  </div>
                ))}
              </div>
              {/* Week Total */}
              <div className="mt-4 flex items-center justify-end gap-3 pr-1">
                <span className="text-sm font-bold uppercase tracking-widest text-gray-400">Week Total</span>
                <span className="text-3xl font-bold tabular-nums" style={{color:ORANGE}}>
                  {fmtCurrency(weekTotal)}
                </span>
              </div>
            </div>

            {/* Invoice # — FIX 3: prominent with helper text */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                Invoice #
              </label>
              <input type="text" placeholder="INV-2026-0001"
                value={invoiceNum} onChange={e=>setInvoiceNum(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                style={{borderColor:invoiceNum?TEAL:undefined}}
              />
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
                One invoice number covers all days billed this week for this job
              </p>
              {/* FIX 5: Duplicate invoice warning */}
              {duplicateInvoice && (
                <div className="mt-2 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium"
                  style={{background:"#fefce8",border:"1px solid #fbbf24",color:"#78350f"}}>
                  <span className="flex-shrink-0 font-bold text-sm leading-none">⚠</span>
                  <span>
                    Invoice <span className="font-bold">{invoiceNum}</span> already used this week for{" "}
                    <span className="font-bold">{duplicateInvoice.rj_number}</span> — {duplicateInvoice.company_name}.{" "}
                    Add another entry to the same invoice?
                  </span>
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_ORDER.map(s => (
                  <button key={s} type="button" onClick={()=>setEntryStatus(s)}
                    className="py-3 rounded-xl text-sm font-bold uppercase tracking-wider border-2 transition"
                    style={{
                      background:   entryStatus===s ? STATUS_FORM_BG[s]     : "white",
                      color:        entryStatus===s ? STATUS_FORM_TEXT[s]   : "#9ca3af",
                      borderColor:  entryStatus===s ? STATUS_FORM_BORDER[s] : "#e5e7eb",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>
                Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input type="text" placeholder="Any remarks…"
                value={notes} onChange={e=>setNotes(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
              />
            </div>

            {/* Submit */}
            <button type="submit" disabled={submitting}
              className="w-full text-white font-bold text-xl py-5 rounded-xl transition-colors
                         shadow-md tracking-wider uppercase disabled:opacity-50"
              style={{background:submitting?TEAL:NAVY}}>
              {submitting ? "Saving…" : "Submit Entry"}
            </button>
          </form>

          {/* ── RIGHT: Dispatch Grid (unified card) ── */}
          <div className="w-full lg:flex-1 min-w-0">
            <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">

              {/* Card header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{color:TEAL}}>
                  This Week at a Glance
                </h2>
                {entries.length>0 && (
                  <span className="text-xs text-gray-400 uppercase tracking-wider">
                    {gridRows.length} job{gridRows.length!==1?"s":""} · {entries.length} entr{entries.length===1?"y":"ies"}
                  </span>
                )}
              </div>

              {/* Dispatch grid */}
              {entries.length===0 ? (
                <p className="text-gray-400 text-xs py-10 text-center uppercase tracking-widest font-semibold">
                  No entries yet for this week.
                </p>
              ) : (
                <table className="w-full table-fixed text-xs border-collapse">
                  <colgroup>
                    <col style={{width:"26%"}}/>
                    {DAYS.map(d=><col key={d} style={{width:"8%"}}/>)}
                    <col style={{width:"10%"}}/>
                    <col style={{width:"8%"}}/>
                  </colgroup>
                  <thead>
                    <tr style={{background:NAVY}} className="text-white">
                      <th className="px-2 py-1.5 text-left uppercase tracking-wider font-bold text-[11px]">Job</th>
                      {DAYS.map((day,i)=>(
                        <th key={day} className="px-0.5 py-1.5 text-right font-bold leading-tight">
                          <div className="text-[10px] uppercase tracking-wide"
                            style={{color:day==="sun"||day==="sat"?"#fca5a5":"white"}}>
                            {DAY_LABELS[i]}
                          </div>
                          <div className="text-[9px] font-normal opacity-50">{dayDates[i]}</div>
                        </th>
                      ))}
                      <th className="px-1 py-1.5 text-left uppercase tracking-wider font-bold text-[10px]">Inv #</th>
                      <th className="px-1 py-1.5 text-right uppercase tracking-wider font-bold text-[11px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map((row)=>{
                      const bdg = { bg: STATUS_BADGE_BG[row.rowStatus]??"#DBEAFE", clr: STATUS_BADGE_CLR[row.rowStatus]??"#1e40af" };
                      const isPending = row.rowStatus === "pending";
                      const statusDot = isPending ? "●" : row.rowStatus === "invoiced" ? "●" : "●";
                      const isDropOpen = openStatusRowKey === row.rj_number;
                      return (
                        <tr key={row.rj_number}
                          style={{background: STATUS_ROW_BG[row.rowStatus]??"white"}}
                          className="border-b border-gray-100 last:border-0 cursor-pointer hover:brightness-95 transition-all"
                          onClick={()=>openEditEntry(row.entries[0])}>
                          {/* Job cell */}
                          <td className="px-2 py-1 align-top">
                            <div className="font-bold text-[11px] truncate leading-tight" style={{color:NAVY}}>{row.rj_number}</div>
                            <div className="text-[10px] truncate leading-tight text-gray-500 mb-0.5">{row.company_name}</div>
                            {/* Status pill — inline dropdown */}
                            <div className="relative inline-block" data-status-pill="true">
                              <button
                                type="button"
                                data-status-pill="true"
                                onClick={e=>{e.stopPropagation();setOpenStatusRowKey(isDropOpen?null:row.rj_number);}}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none transition hover:opacity-80"
                                style={{background:bdg.bg,color:bdg.clr}}>
                                {statusDot} {row.rowStatus.toUpperCase()}
                              </button>
                              {isDropOpen && (
                                <div className="absolute left-0 top-full mt-0.5 z-30 bg-white rounded-lg shadow-xl border border-gray-100 flex flex-col overflow-hidden"
                                  data-status-pill="true">
                                  {STATUS_ORDER.map(s=>{
                                    const b = {bg:STATUS_BADGE_BG[s]??"#DBEAFE",clr:STATUS_BADGE_CLR[s]??"#1e40af"};
                                    return (
                                      <button key={s} type="button" data-status-pill="true"
                                        onClick={e=>{e.stopPropagation();row.entries.forEach(en=>setEntryStatusDirect(en.id,s as EntryStatus));}}
                                        className="px-3 py-1.5 text-[10px] font-bold text-left hover:opacity-80 transition whitespace-nowrap"
                                        style={{background:b.bg,color:b.clr}}>
                                        ● {s.toUpperCase()}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Day cells */}
                          {DAYS.map(day=>{
                            const d = row.days[day];
                            const amt = d?.total ?? 0;
                            const hasContent = amt > 0 || isPending;
                            return (
                              <td key={day} className="px-0.5 py-1 text-right align-top tabular-nums"
                                style={{
                                  background: amt>0 ? "#d1fae5" : isPending ? "#EFF6FF" : undefined,
                                  color:      amt>0 ? "#065f46" : isPending ? "#93c5fd" : "#e5e7eb",
                                  fontWeight: amt>0 ? 600 : 400,
                                  cursor: hasContent ? "default" : undefined,
                                }}
                                onMouseEnter={hasContent ? e=>{
                                  e.stopPropagation();
                                  setHoveredCell({rowKey:row.rj_number, day, x:e.clientX, y:e.clientY});
                                } : undefined}
                                onMouseMove={hasContent ? e=>{
                                  setHoveredCell({rowKey:row.rj_number, day, x:e.clientX, y:e.clientY});
                                } : undefined}
                                onMouseLeave={hasContent ? ()=>setHoveredCell(null) : undefined}
                                onClick={e=>e.stopPropagation()}>
                                {amt>0 ? (
                                  <>
                                    <div className="text-[11px]">{amt.toLocaleString("en-US",{maximumFractionDigits:0})}</div>
                                    {d?.descs.map((desc,di)=>(
                                      <div key={di} className="text-[9px] italic text-gray-400 leading-tight truncate">{desc}</div>
                                    ))}
                                  </>
                                ) : isPending ? (
                                  <span className="text-[10px] font-semibold" style={{color:"#93c5fd"}}>TBD</span>
                                ) : <span className="text-[11px]">—</span>}
                              </td>
                            );
                          })}
                          {/* Invoices */}
                          <td className="px-1 py-1 align-top text-[10px] text-gray-600">
                            <div className="truncate leading-tight">
                              {row.invoices.length>0 ? row.invoices.join(", ") : <span className="text-gray-300">—</span>}
                            </div>
                          </td>
                          {/* Total */}
                          <td className="px-1 py-1 text-right font-bold tabular-nums align-top text-[11px]" style={{color:row.rowTotal>0?ORANGE:"#93c5fd"}}>
                            {row.rowTotal>0 ? fmtCurrency(row.rowTotal) : <span className="text-[10px]">TBD</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="text-white text-[11px] font-bold" style={{background:NAVY}}>
                      <td className="px-2 py-1.5 uppercase tracking-wider">Totals</td>
                      {DAYS.map(day=>{
                        const s=entries.reduce((t,e)=>t+Number(e[day]),0);
                        return (
                          <td key={day} className="px-0.5 py-1.5 text-right tabular-nums"
                            style={{color:s>0?"#6ee7b7":undefined}}>
                            {s>0 ? s.toLocaleString("en-US",{maximumFractionDigits:0}) : <span className="opacity-30">—</span>}
                          </td>
                        );
                      })}
                      <td className="px-1 py-1.5"></td>
                      <td className="px-1 py-1.5 text-right tabular-nums" style={{color:"#fcd34d"}}>{fmtCurrency(grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* Chart — merged inside same card */}
              {entries.length>0 && (
                <>
                  <div className="border-t border-gray-100"/>
                  <div className="px-4 pb-4 pt-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-3" style={{color:TEAL}}>Daily Totals</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={chartData} margin={{top:4,right:8,left:8,bottom:0}}>
                        <XAxis dataKey="day" tick={{fontSize:11,fontWeight:600}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false}
                          tickFormatter={v=>v===0?"":("$"+Number(v).toLocaleString())}/>
                        <Tooltip
                          formatter={(value)=>["$"+Number(value).toLocaleString("en-US",{minimumFractionDigits:2}),"Total"]}
                          contentStyle={{borderRadius:"8px",border:"1px solid #e5e7eb",fontSize:"12px"}}
                        />
                        <Bar dataKey="total" radius={[4,4,0,0]}>
                          {chartData.map((entry,i)=>(
                            <Cell key={i} fill={entry.total>0?NAVY:"#e5e7eb"}/>
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

            </div>
          </div>
          {/* end right column */}

        </div>
      </div>

      {/* ── Edit Entry Modal (unified edit + history) ── */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white" style={{borderColor:"#e5e7eb"}}>
              <div>
                {editModalView === "history" ? (
                  <button type="button" onClick={()=>setEditModalView("edit")}
                    className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider mb-0.5 hover:opacity-70 transition"
                    style={{color:TEAL}}>
                    ← Back to Edit
                  </button>
                ) : null}
                <h3 className="text-lg font-bold uppercase tracking-wider" style={{color:NAVY}}>
                  {editModalView === "history" ? "Edit History" : "Edit Entry"}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">{editEntry.rj_number} · {editEntry.company_name}</p>
              </div>
              <button onClick={()=>{setEditEntry(null);setEditModalView("edit");}} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>

            {editModalView === "edit" ? (
              <form onSubmit={handleEditSave} className="p-6 space-y-4">
                {/* CHANGE 6: Created date */}
                {editEntry.created_at && (
                  <p className="text-[10px] uppercase tracking-wider text-gray-400">
                    Created: {new Date(editEntry.created_at).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                  </p>
                )}
                {/* CHANGE 6: TBD banner — no amounts + pending */}
                {!editOriginalHadAmounts && (editEntry.status||"pending")==="pending" && (
                  <div className="rounded-xl border-2 px-4 py-3 text-xs font-bold uppercase tracking-wider leading-snug"
                    style={{borderColor:"#93c5fd",background:"#EFF6FF",color:"#1e40af"}}>
                    This entry has no amounts yet. Fill in daily amounts and change status to Invoiced when ready.
                  </div>
                )}
                {/* Work Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Work Description</label>
                  <input type="text" value={editWorkDesc} onChange={e=>setEditWorkDesc(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{borderColor:editWorkDesc?TEAL:undefined}}/>
                </div>
                {/* Daily Amounts */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>Daily Amounts</label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((day,i)=>(
                      <div key={day} className="flex flex-col items-center gap-1">
                        <span className="text-xs font-bold tracking-widest"
                          style={{color:day==="sun"||day==="sat"?ORANGE:"#6b7280"}}>{DAY_LABELS[i]}</span>
                        <input type="text" inputMode="decimal" placeholder="—"
                          value={editAmounts[day]}
                          onChange={e=>setEditAmounts(p=>({...p,[day]:e.target.value}))}
                          onFocus={()=>{const v=parseDollar(editAmounts[day]);setEditAmounts(p=>({...p,[day]:v>0?String(v):""}));}}
                          onBlur={()=>{const v=parseDollar(editAmounts[day]);setEditAmounts(p=>({...p,[day]:fmtBlur(v)}));}}
                          className="w-full border-2 border-gray-300 rounded-xl px-1 py-3 text-center text-sm font-semibold focus:outline-none tabular-nums placeholder:text-gray-300"
                          style={{borderColor:parseDollar(editAmounts[day])>0?TEAL:undefined}}/>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Week Total</span>
                    <span className="text-2xl font-bold tabular-nums" style={{color:ORANGE}}>
                      {fmtCurrency(DAYS.reduce((s,d)=>s+parseDollar(editAmounts[d]),0))}
                    </span>
                  </div>
                </div>
                {/* Invoice + Prelim */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Invoice #</label>
                    <input type="text" value={editInvoice} onChange={e=>setEditInvoice(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                      style={{borderColor:editInvoice?TEAL:undefined}}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Prelim Date</label>
                    <input type="date" value={editPrelim} onChange={e=>setEditPrelim(e.target.value)}
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                      style={{borderColor:editPrelim?TEAL:undefined}}/>
                  </div>
                </div>
                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Notes</label>
                  <input type="text" value={editNotes} onChange={e=>setEditNotes(e.target.value)}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"/>
                </div>
                {/* Reason — required */}
                <div className="rounded-xl border-2 p-4" style={{borderColor:ORANGE,background:"#fff7f7"}}>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:ORANGE}}>
                    Reason for Edit <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={editReason} onChange={e=>setEditReason(e.target.value)}
                    placeholder="Required — describe why this entry is being changed"
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{borderColor:editReason.trim()?ORANGE:undefined}}/>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={()=>setEditEntry(null)}
                    className="flex-1 border-2 border-gray-300 rounded-xl py-3 font-bold uppercase tracking-wider text-gray-500 hover:border-gray-400 transition">
                    Cancel
                  </button>
                  <button type="button" onClick={loadAndShowHistory}
                    className="border-2 rounded-xl px-4 py-3 font-bold uppercase tracking-wider text-sm transition hover:opacity-70"
                    style={{borderColor:TEAL,color:TEAL}}>
                    View History
                  </button>
                  <button type="submit" disabled={editSaving}
                    className="flex-1 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50"
                    style={{background:NAVY}}>
                    {editSaving?"Saving…":"Save Changes"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6">
                {editHistoryLoading ? (
                  <p className="text-center text-gray-400 py-8 uppercase tracking-widest text-sm font-semibold">Loading…</p>
                ) : editHistoryLog.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 uppercase tracking-widest text-sm font-semibold">No edit history for this entry.</p>
                ) : (
                  <div className="space-y-3">
                    {editHistoryLog.map(row => (
                      <div key={row.id} className="rounded-xl border p-4" style={{borderColor:"#e5e7eb"}}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold uppercase tracking-widest" style={{color:TEAL}}>{row.field_changed}</span>
                          <span className="text-xs text-gray-400 uppercase tracking-wider">
                            {new Date(row.edited_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <span className="line-through text-gray-400">{row.old_value || "—"}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-semibold" style={{color:NAVY}}>{row.new_value || "—"}</span>
                        </div>
                        <p className="text-xs text-gray-500 italic">&ldquo;{row.reason}&rdquo; — {row.edited_by}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CHANGE 5: Hover Tooltip ── */}
      {hoveredCell && (() => {
        const row = gridRows.find(r=>r.rj_number===hoveredCell.rowKey);
        if (!row) return null;
        const dayIdx = DAYS.indexOf(hoveredCell.day as typeof DAYS[number]);
        const dayLabel = DAY_LABELS[dayIdx] ?? hoveredCell.day.toUpperCase();
        const dayDate = dayDates[dayIdx] ?? "";
        // find entries that have data for this day
        const relevantEntries = row.entries.filter(en => Number(en[hoveredCell.day as Day]) > 0);
        const isPendingRow = row.rowStatus === "pending";
        const TOOLTIP_W = 260;
        const fromTop = hoveredCell.y < 220;
        const left = Math.min(hoveredCell.x + 12, window.innerWidth - TOOLTIP_W - 16);
        const top = fromTop ? hoveredCell.y + 20 : hoveredCell.y - 20;
        const transform = fromTop ? "translateY(0)" : "translateY(-100%)";
        return (
          <div className="pointer-events-none fixed z-50 rounded-xl shadow-xl border text-xs overflow-hidden"
            style={{
              left, top, transform,
              width: TOOLTIP_W,
              background:"white",
              borderColor: NAVY,
            }}>
            {/* Header */}
            <div className="px-3 py-2" style={{background:NAVY,color:"white"}}>
              <div className="font-bold text-[11px] uppercase tracking-wider">{row.rj_number} — {row.company_name}</div>
              <div className="text-[10px] opacity-70 mt-0.5">{dayLabel} · {dayDate}</div>
            </div>
            {/* Body */}
            {relevantEntries.length > 0 ? relevantEntries.map((en, i) => {
              const amt = Number(en[hoveredCell.day as Day]);
              const statusBadge = { bg: STATUS_BADGE_BG[en.status]??"#DBEAFE", clr: STATUS_BADGE_CLR[en.status]??"#1e40af" };
              return (
                <div key={en.id}>
                  {i > 0 && <div className="border-t" style={{borderColor:"#e5e7eb"}}/>}
                  <div className="px-3 py-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Amount</span>
                      <span className="font-bold tabular-nums" style={{color:ORANGE}}>{fmtCurrency(amt)}</span>
                    </div>
                    {en.work_description && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] shrink-0">Work</span>
                        <span className="text-right text-gray-700 leading-tight">{en.work_description}</span>
                      </div>
                    )}
                    {en.invoice_number && (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Invoice</span>
                        <span style={{color:NAVY,fontWeight:600}}>{en.invoice_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Status</span>
                      <span className="px-1.5 py-0.5 rounded-full font-bold text-[9px]"
                        style={{background:statusBadge.bg,color:statusBadge.clr}}>
                        ● {(en.status||"pending").toUpperCase()}
                      </span>
                    </div>
                    {en.prelim_date && (
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Prelim</span>
                        <span className="text-gray-700">{new Date(en.prelim_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
                      </div>
                    )}
                    {en.notes && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] shrink-0">Notes</span>
                        <span className="text-right text-gray-500 italic leading-tight">{en.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : isPendingRow ? (
              <div className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider" style={{color:"#93c5fd"}}>
                TBD — Amount not yet set
              </div>
            ) : null}
          </div>
        );
      })()}

      {/* ── CHANGE 6: "Mark as Invoiced?" prompt ── */}
      {showInvoicedPrompt && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-10 px-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-md p-5 pointer-events-auto"
            style={{borderColor:TEAL}}>
            <p className="text-sm font-bold uppercase tracking-wider mb-1" style={{color:NAVY}}>Amounts Added</p>
            <p className="text-xs text-gray-500 mb-4">This entry now has amounts. Mark it as Invoiced?</p>
            <div className="flex gap-3">
              <button type="button"
                onClick={async ()=>{
                  setShowInvoicedPrompt(false);
                  if (promptEntryId) await setEntryStatusDirect(promptEntryId,"invoiced");
                }}
                className="flex-1 py-2.5 rounded-xl text-white font-bold uppercase tracking-wider text-sm transition hover:opacity-80"
                style={{background:TEAL}}>
                Yes, Mark Invoiced
              </button>
              <button type="button"
                onClick={()=>setShowInvoicedPrompt(false)}
                className="flex-1 py-2.5 rounded-xl border-2 font-bold uppercase tracking-wider text-sm text-gray-500 hover:border-gray-400 transition"
                style={{borderColor:"#d1d5db"}}>
                Keep as Pending
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
