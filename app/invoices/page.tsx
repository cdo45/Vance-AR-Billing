"use client";

import { useState, useEffect, useMemo } from "react";
import SiteHeader from "@/app/components/SiteHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Entry {
  id: number;
  rj_number: string;
  company_name: string;
  week_start: string;
  invoice_number: string;
  sun: number; mon: number; tue: number; wed: number;
  thu: number; fri: number; sat: number;
  week_total: number;
  work_description: string;
  prelim_date: string | null;
  notes: string;
  status: string;
}

interface InvoiceRow {
  invoice_number: string;
  company_name: string;
  rj_numbers: string[];
  week_start: string;
  total: number;
  status: string; // lowest across entries
  entries: Entry[];
}

interface Toast { msg: string; type: "success" | "error"; }

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY   = "#1F3864";
const TEAL   = "#1F6B6B";
const ORANGE = "#C8102E";
const DKGREEN = "#1E6B1E";
const LTGRAY  = "#F2F2F2";

const STATUS_ORDER = ["pending","invoiced","received"] as const;
const STATUS_BADGE: Record<string,{bg:string;color:string}> = {
  pending:  { bg:"#DBEAFE", color:"#1e40af" },
  invoiced: { bg:"#FEF9C3", color:"#92400e" },
  received: { bg:"#DCFCE7", color:"#14532d" },
};
const STATUS_STAT_BG: Record<string,string> = {
  pending:"#EFF6FF", invoiced:"#FEFCE8", received:"#F0FDF4",
};

const DAYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

function fmtCurrency(n: number) {
  return Number(n).toLocaleString("en-US",{style:"currency",currency:"USD"});
}

function lowestStatus(entries: Entry[]): string {
  let idx = STATUS_ORDER.length - 1;
  for (const e of entries) {
    const i = STATUS_ORDER.indexOf(e.status as typeof STATUS_ORDER[number]);
    if (i >= 0 && i < idx) idx = i;
  }
  return STATUS_ORDER[idx] ?? "pending";
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast|null>(null);

  // Edit modal
  const [editEntry, setEditEntry] = useState<Entry|null>(null);
  const [editFields, setEditFields] = useState({sun:"",mon:"",tue:"",wed:"",thu:"",fri:"",sat:"",invoice_number:"",notes:"",work_description:"",prelim_date:""});
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Status modal
  const [statusEntry, setStatusEntry] = useState<Entry|null>(null);
  const [statusValue, setStatusValue] = useState<string>("pending");
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/invoices")
      .then(r => r.ok ? r.json() : [])
      .then((d: Entry[]) => setAllEntries(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // Group entries by invoice_number
  const invoiceRows = useMemo<InvoiceRow[]>(() => {
    const map: Record<string, InvoiceRow> = {};
    for (const e of allEntries) {
      const key = e.invoice_number || `__no_inv_${e.id}`;
      if (!map[key]) {
        map[key] = {
          invoice_number: e.invoice_number,
          company_name: e.company_name,
          rj_numbers: [],
          week_start: e.week_start,
          total: 0,
          status: "received",
          entries: [],
        };
      }
      const row = map[key];
      row.entries.push(e);
      row.total += Number(e.week_total);
      if (!row.rj_numbers.includes(e.rj_number)) row.rj_numbers.push(e.rj_number);
    }
    // set status + apply filters
    return Object.values(map).map(row => ({
      ...row,
      status: lowestStatus(row.entries),
    }));
  }, [allEntries]);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoiceRows.filter(row => {
      if (statusFilter && row.status !== statusFilter) return false;
      if (fromDate && row.week_start < fromDate) return false;
      if (toDate && row.week_start > toDate) return false;
      if (q && !row.invoice_number.toLowerCase().includes(q) &&
              !row.company_name.toLowerCase().includes(q) &&
              !row.rj_numbers.some(r => r.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [invoiceRows, search, statusFilter, fromDate, toDate]);

  // Stats
  const stats = useMemo(() => {
    const all  = { count: invoiceRows.length, total: invoiceRows.reduce((s,r)=>s+r.total,0) };
    const byStatus = (st: string) => invoiceRows.filter(r=>r.status===st);
    return {
      all,
      pending:  { count: byStatus("pending").length,  total: byStatus("pending").reduce((s,r)=>s+r.total,0) },
      invoiced: { count: byStatus("invoiced").length, total: byStatus("invoiced").reduce((s,r)=>s+r.total,0) },
      received: { count: byStatus("received").length, total: byStatus("received").reduce((s,r)=>s+r.total,0) },
    };
  }, [invoiceRows]);

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(key)) { n.delete(key); } else { n.add(key); }
      return n;
    });
  }

  function openEdit(e: Entry) {
    setEditEntry(e);
    const p = (n: number) => n > 0 ? n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
    setEditFields({
      sun:p(Number(e.sun)),mon:p(Number(e.mon)),tue:p(Number(e.tue)),
      wed:p(Number(e.wed)),thu:p(Number(e.thu)),fri:p(Number(e.fri)),sat:p(Number(e.sat)),
      invoice_number:e.invoice_number||"",notes:e.notes||"",
      work_description:e.work_description||"",prelim_date:e.prelim_date||"",
    });
    setEditReason("");
  }

  async function handleEditSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editEntry) return;
    if (!editReason.trim()) { setToast({msg:"Reason required.",type:"error"}); return; }
    setEditSaving(true);
    const parseDollar = (v:string) => { const n=parseFloat(v.replace(/[^0-9.]/g,"")); return isNaN(n)?0:n; };
    try {
      const r = await fetch(`/api/entries/${editEntry.id}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          sun:parseDollar(editFields.sun),mon:parseDollar(editFields.mon),
          tue:parseDollar(editFields.tue),wed:parseDollar(editFields.wed),
          thu:parseDollar(editFields.thu),fri:parseDollar(editFields.fri),
          sat:parseDollar(editFields.sat),
          invoice_number:editFields.invoice_number,notes:editFields.notes,
          work_description:editFields.work_description,
          prelim_date:editFields.prelim_date||null,reason:editReason,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error||"Error");
      setToast({msg:"Entry updated.",type:"success"});
      setEditEntry(null);
      // Refresh
      const fresh = await fetch("/api/invoices").then(x=>x.json());
      setAllEntries(fresh);
    } catch(err) {
      setToast({msg:`Error: ${err instanceof Error?err.message:"Unknown"}`,type:"error"});
    } finally { setEditSaving(false); }
  }

  function openStatusModal(e: Entry) {
    setStatusEntry(e);
    setStatusValue(e.status || "pending");
    setStatusReason("");
  }

  async function handleStatusSave(ev: React.FormEvent) {
    ev.preventDefault();
    if (!statusEntry) return;
    if (!statusReason.trim()) { setToast({msg:"Reason required.",type:"error"}); return; }
    setStatusSaving(true);
    try {
      const r = await fetch(`/api/entries/${statusEntry.id}`,{
        method:"PUT",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          ...statusEntry,
          status:statusValue,reason:statusReason,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error||"Error");
      setToast({msg:"Status updated.",type:"success"});
      setStatusEntry(null);
      const fresh = await fetch("/api/invoices").then(x=>x.json());
      setAllEntries(fresh);
    } catch(err) {
      setToast({msg:`Error: ${err instanceof Error?err.message:"Unknown"}`,type:"error"});
    } finally { setStatusSaving(false); }
  }

  const footerTotal = filtered.reduce((s,r)=>s+r.total,0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{background:LTGRAY,fontFamily:"Arial,Helvetica,sans-serif"}}>

      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl px-6 py-3 text-white text-sm font-semibold shadow-2xl"
          style={{background:toast.type==="success"?DKGREEN:"#dc2626"}}>
          {toast.msg}
        </div>
      )}

      <SiteHeader />

      <div className="w-full px-2 md:px-4 lg:px-8 py-8 space-y-6">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:"Total Invoices", count:stats.all.count,    total:stats.all.total,    color:NAVY,   bg:"white" },
            { label:"Pending",        count:stats.pending.count, total:stats.pending.total, color:"#1e40af", bg:STATUS_STAT_BG.pending },
            { label:"Invoiced",       count:stats.invoiced.count,total:stats.invoiced.total,color:"#92400e",bg:STATUS_STAT_BG.invoiced },
            { label:"Received",       count:stats.received.count,total:stats.received.total,color:"#14532d",bg:STATUS_STAT_BG.received },
          ].map(card=>(
            <div key={card.label} className="rounded-2xl shadow p-5" style={{background:card.bg}}>
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{color:card.color}}>{card.label}</p>
              <p className="text-2xl font-bold" style={{color:card.color}}>{card.count}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5" style={{color:card.color}}>{fmtCurrency(card.total)}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:TEAL}}>Search</label>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Invoice #, company, RJ#…"
              className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{borderColor:search?TEAL:undefined}}/>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:TEAL}}>Status</label>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white"
              style={{borderColor:statusFilter?TEAL:undefined}}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="invoiced">Invoiced</option>
              <option value="received">Received</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:TEAL}}>From</label>
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{borderColor:fromDate?TEAL:undefined}}/>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest mb-1" style={{color:TEAL}}>To</label>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
              style={{borderColor:toDate?TEAL:undefined}}/>
          </div>
          {(search||statusFilter||fromDate||toDate) && (
            <button onClick={()=>{setSearch("");setStatusFilter("");setFromDate("");setToDate("");}}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 border-2 border-gray-200 rounded-xl hover:border-gray-400 transition">
              Clear
            </button>
          )}
        </div>

        {/* Invoice Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold text-sm">Loading…</p>
          ) : filtered.length===0 ? (
            <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold text-sm">No invoices found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white text-xs uppercase tracking-wider" style={{background:NAVY}}>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">RJ #</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Week Of</th>
                  <th className="px-4 py-3 text-center whitespace-nowrap">Days Billed</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, ri) => {
                  const key = row.invoice_number || `__no_inv_${row.entries[0]?.id}`;
                  const isOpen = expanded.has(key);
                  const badge = STATUS_BADGE[row.status] ?? STATUS_BADGE.pending;
                  const daysBilled = row.entries.reduce((s,e) =>
                    s + DAYS.filter(d=>Number(e[d])>0).length, 0);
                  return (
                    <>
                      <tr key={key}
                        className="border-b border-gray-100 hover:bg-gray-50 transition"
                        style={{background: ri%2===0?"white":LTGRAY}}>
                        <td className="px-4 py-3 font-bold" style={{color:NAVY}}>
                          {row.invoice_number || <span className="text-gray-300 font-normal italic">No invoice #</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{row.company_name}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{row.rj_numbers.join(", ")}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{row.week_start}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{daysBilled}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums" style={{color:ORANGE}}>
                          {fmtCurrency(row.total)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{background:badge.bg,color:badge.color}}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={()=>toggleExpand(key)}
                              className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition"
                              style={{color:TEAL,borderColor:TEAL}}>
                              {isOpen?"Hide":"View"}
                            </button>
                            {row.entries.length===1 && (
                              <>
                                <button onClick={()=>openStatusModal(row.entries[0])}
                                  className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition"
                                  style={{color:"#92400e",borderColor:"#fbbf24",background:"#fefce8"}}>
                                  Status
                                </button>
                                <button onClick={()=>openEdit(row.entries[0])}
                                  className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border transition"
                                  style={{color:NAVY,borderColor:NAVY}}>
                                  Edit
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail rows */}
                      {isOpen && row.entries.map(e => (
                        <tr key={`detail-${e.id}`} className="border-b border-gray-100"
                          style={{background:"#f8faff"}}>
                          <td className="pl-8 pr-2 py-2 text-xs text-gray-400 italic" colSpan={2}>
                            ↳ {e.rj_number} · {e.work_description || "—"}
                          </td>
                          <td colSpan={2} className="px-2 py-2 text-xs text-gray-500">
                            Week: {e.week_start}
                          </td>
                          <td className="px-2 py-2 text-center text-xs">
                            <div className="flex justify-center gap-0.5">
                              {DAYS.map((d,i)=>{
                                const v=Number(e[d]);
                                return v>0 ? (
                                  <span key={d} className="px-1 py-0.5 rounded text-[10px] font-semibold"
                                    style={{background:"#d1fae5",color:"#065f46"}}>
                                    {DAY_LABELS[i][0]}:{v.toLocaleString("en-US",{maximumFractionDigits:0})}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right text-xs font-semibold tabular-nums" style={{color:ORANGE}}>
                            {fmtCurrency(Number(e.week_total))}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase"
                              style={{background:STATUS_BADGE[e.status]?.bg??"#DBEAFE",color:STATUS_BADGE[e.status]?.color??"#1e40af"}}>
                              {e.status||"pending"}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={()=>openStatusModal(e)}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                                style={{color:"#92400e",borderColor:"#fbbf24",background:"#fefce8"}}>
                                Status
                              </button>
                              <button onClick={()=>openEdit(e)}
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
                                style={{color:NAVY,borderColor:NAVY}}>
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="text-white text-xs font-bold" style={{background:NAVY}}>
                  <td className="px-4 py-3" colSpan={4}>
                    {filtered.length} invoice{filtered.length!==1?"s":""} shown
                  </td>
                  <td className="px-4 py-3 text-center">
                    {filtered.reduce((s,r)=>s+r.entries.reduce((t,e)=>t+DAYS.filter(d=>Number(e[d])>0).length,0),0)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{color:"#fcd34d"}}>
                    {fmtCurrency(footerTotal)}
                  </td>
                  <td className="px-4 py-3 text-center text-[10px]">
                    {["pending","invoiced","received"].map(st=>{
                      const c=filtered.filter(r=>r.status===st).length;
                      return c>0?<span key={st} className="mr-1">{c} {st}</span>:null;
                    })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white" style={{borderColor:"#e5e7eb"}}>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wider" style={{color:NAVY}}>Edit Entry</h3>
                <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">{editEntry.rj_number} · {editEntry.company_name}</p>
              </div>
              <button onClick={()=>setEditEntry(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <form onSubmit={handleEditSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Work Description</label>
                <input type="text" value={editFields.work_description}
                  onChange={e=>setEditFields(p=>({...p,work_description:e.target.value}))}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"/>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{color:TEAL}}>Daily Amounts</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS.map((d,i)=>(
                    <div key={d} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-bold uppercase" style={{color:"#6b7280"}}>{DAY_LABELS[i]}</span>
                      <input type="text" inputMode="decimal" placeholder="—"
                        value={editFields[d]}
                        onChange={ev=>setEditFields(p=>({...p,[d]:ev.target.value}))}
                        className="w-full border-2 border-gray-300 rounded-lg px-1 py-2 text-center text-xs font-semibold focus:outline-none"/>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Invoice #</label>
                  <input type="text" value={editFields.invoice_number}
                    onChange={e=>setEditFields(p=>({...p,invoice_number:e.target.value}))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Prelim Date</label>
                  <input type="date" value={editFields.prelim_date}
                    onChange={e=>setEditFields(p=>({...p,prelim_date:e.target.value}))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:TEAL}}>Notes</label>
                <input type="text" value={editFields.notes}
                  onChange={e=>setEditFields(p=>({...p,notes:e.target.value}))}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"/>
              </div>
              <div className="rounded-xl border-2 p-4" style={{borderColor:ORANGE,background:"#fff7f7"}}>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:ORANGE}}>
                  Reason for Edit <span className="text-red-500">*</span>
                </label>
                <input type="text" value={editReason} onChange={e=>setEditReason(e.target.value)}
                  placeholder="Required"
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{borderColor:editReason.trim()?ORANGE:undefined}}/>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setEditEntry(null)}
                  className="flex-1 border-2 border-gray-300 rounded-xl py-3 font-bold uppercase tracking-wider text-gray-500 hover:border-gray-400 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm"
                  style={{background:NAVY}}>
                  {editSaving?"Saving…":"Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Status Change Modal ── */}
      {statusEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{borderColor:"#e5e7eb"}}>
              <h3 className="text-lg font-bold uppercase tracking-wider" style={{color:NAVY}}>Change Status</h3>
              <button onClick={()=>setStatusEntry(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            <form onSubmit={handleStatusSave} className="p-6 space-y-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">{statusEntry.rj_number} · {statusEntry.company_name}</p>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_ORDER.map(s=>{
                  const b = STATUS_BADGE[s];
                  return (
                    <button key={s} type="button" onClick={()=>setStatusValue(s)}
                      className="py-3 rounded-xl text-xs font-bold uppercase tracking-wider border-2 transition"
                      style={{
                        background: statusValue===s ? b.bg : "white",
                        color:      statusValue===s ? b.color : "#9ca3af",
                        borderColor:statusValue===s ? b.color : "#e5e7eb",
                      }}>
                      {s}
                    </button>
                  );
                })}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{color:ORANGE}}>
                  Reason <span className="text-red-500">*</span>
                </label>
                <input type="text" value={statusReason} onChange={e=>setStatusReason(e.target.value)}
                  placeholder="Required"
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none"
                  style={{borderColor:statusReason.trim()?ORANGE:undefined}}/>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={()=>setStatusEntry(null)}
                  className="flex-1 border-2 border-gray-300 rounded-xl py-3 font-bold uppercase tracking-wider text-gray-500 hover:border-gray-400 transition text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={statusSaving}
                  className="flex-1 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50 text-sm"
                  style={{background:NAVY}}>
                  {statusSaving?"Saving…":"Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
