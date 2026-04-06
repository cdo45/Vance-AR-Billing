"use client";

import { useState, useEffect, useCallback } from "react";
import SiteHeader from "@/app/components/SiteHeader";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: number;
  rj_number: string;
  job_description: string;
  company_name: string;
  customer_id: number | null;
  location: string;
  contract_amount: number | null;
  start_date: string | null;
  status: string;
  certified_payroll: boolean;
  notes: string;
  total_billed: number;
  last_entry_date: string | null;
}

interface Toast { msg: string; type: "success" | "error"; }

type SortCol = "rj_number" | "company_name" | "status" | "total_billed" | "last_entry_date";

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY    = "#1F3864";
const TEAL    = "#1F6B6B";
const ORANGE  = "#C8102E";
const DKGREEN = "#1E6B1E";
const LTGRAY  = "#F2F2F2";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:    { bg: "#dcfce7", text: "#166534" },
  completed: { bg: "#dbeafe", text: "#1e40af" },
  inactive:  { bg: "#f3f4f6", text: "#4b5563" },
};

const EMPTY_FORM = {
  rj_number: "", job_description: "", company_name: "", location: "",
  contract_amount: "", start_date: "", status: "active",
  certified_payroll: false, notes: "",
};

function fmtCurrency(n: number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function JobsPage() {
  const [jobs, setJobs]           = useState<Job[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortCol, setSortCol]     = useState<SortCol>("rj_number");
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Job | null>(null);
  const [form, setForm]           = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<Toast | null>(null);
  const [customers, setCustomers] = useState<{id: number; company_name: string}[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [showCompanyDrop, setShowCompanyDrop] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ stats: "1" });
      if (search)       params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/jobs?${params}`);
      if (r.ok) setJobs(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => loadJobs(), 300);
    return () => clearTimeout(t);
  }, [loadJobs]);

  useEffect(() => {
    fetch("/api/customers")
      .then(r => r.ok ? r.json() : [])
      .then((d: {id: number; company_name: string}[]) => setCustomers(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setCompanySearch("");
    setShowModal(true);
  }
  function openEdit(j: Job) {
    setEditing(j);
    setForm({
      rj_number:         j.rj_number,
      job_description:   j.job_description || "",
      company_name:      j.company_name,
      location:          j.location || "",
      contract_amount:   j.contract_amount != null ? String(j.contract_amount) : "",
      start_date:        j.start_date || "",
      status:            j.status || "active",
      certified_payroll: j.certified_payroll,
      notes:             j.notes || "",
    });
    setCompanySearch(j.company_name);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rj_number.trim() || !form.company_name.trim()) {
      setToast({ msg: "RJ Number and Customer are required.", type: "error" }); return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/jobs/${encodeURIComponent(editing.rj_number)}` : "/api/jobs";
      const method = editing ? "PUT" : "POST";
      const payload = {
        ...form,
        contract_amount: form.contract_amount ? Number(form.contract_amount) : null,
      };
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Server error"); }
      setToast({ msg: editing ? "Job updated." : "Job added.", type: "success" });
      setShowModal(false);
      await loadJobs();
    } catch (err) {
      setToast({ msg: `Error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
    } finally { setSaving(false); }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sorted = [...jobs].sort((a, b) => {
    const av = a[sortCol] ?? "";
    const bv = b[sortCol] ?? "";
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalBilled  = sorted.reduce((s, j) => s + Number(j.total_billed || 0), 0);
  const activeCount  = jobs.filter(j => j.status === "active").length;

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  function StatusBadge({ status }: { status: string }) {
    const c = STATUS_COLORS[status] ?? STATUS_COLORS.inactive;
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full capitalize"
        style={{ background: c.bg, color: c.text }}>
        {status}
      </span>
    );
  }

  const filteredCustomers = customers
    .filter(c => !companySearch || c.company_name.toLowerCase().includes(companySearch.toLowerCase()))
    .slice(0, 10);

  return (
    <div className="min-h-screen" style={{ background: LTGRAY, fontFamily: "Arial,Helvetica,sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl px-6 py-3 text-white text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? DKGREEN : "#dc2626" }}>
          {toast.msg}
        </div>
      )}

      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                Jobs / RJ Numbers
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 uppercase tracking-wider">{activeCount} active jobs</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Search RJ#, company, or description…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none w-72"
                style={{ borderColor: search ? TEAL : undefined }}
              />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
                style={{ borderColor: statusFilter ? TEAL : undefined }}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="inactive">Inactive</option>
              </select>
              <button onClick={openAdd}
                className="text-white text-sm font-bold uppercase tracking-wider px-5 py-2.5 rounded-xl transition hover:opacity-80 whitespace-nowrap"
                style={{ background: NAVY }}>
                + Add New Job
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold">Loading jobs…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white text-xs uppercase tracking-wider" style={{ background: NAVY }}>
                    <th className="px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none whitespace-nowrap"
                      onClick={() => handleSort("rj_number")}>
                      RJ #<SortIcon col="rj_number" />
                    </th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none whitespace-nowrap"
                      onClick={() => handleSort("company_name")}>
                      Customer<SortIcon col="company_name" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none"
                      onClick={() => handleSort("status")}>
                      Status<SortIcon col="status" />
                    </th>
                    <th className="px-4 py-3 text-center">Cert. Payroll</th>
                    <th className="px-4 py-3 text-right cursor-pointer hover:opacity-80 select-none whitespace-nowrap"
                      onClick={() => handleSort("total_billed")}>
                      Total Billed<SortIcon col="total_billed" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none whitespace-nowrap"
                      onClick={() => handleSort("last_entry_date")}>
                      Last Entry<SortIcon col="last_entry_date" />
                    </th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-16 text-center text-gray-400 uppercase tracking-widest font-semibold">
                        {search || statusFilter ? "No jobs match your filters." : "No jobs yet."}
                      </td>
                    </tr>
                  ) : sorted.map((j, i) => (
                    <tr key={j.id} style={{ background: i % 2 === 0 ? "white" : LTGRAY }}>
                      <td className="px-4 py-3 font-bold whitespace-nowrap">
                        <a href={`/jobs/${encodeURIComponent(j.rj_number)}`}
                          className="hover:underline"
                          style={{ color: NAVY }}>
                          {j.rj_number}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                        {j.job_description || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                        {j.company_name}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={j.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${j.certified_payroll ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>
                          {j.certified_payroll ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums" style={{ color: ORANGE }}>
                        {fmtCurrency(Number(j.total_billed || 0))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {j.last_entry_date || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(j)}
                          className="text-xs px-3 py-1.5 rounded-lg border font-bold uppercase tracking-wider transition hover:opacity-80"
                          style={{ color: TEAL, borderColor: TEAL }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-white text-xs font-bold" style={{ background: NAVY }}>
                    <td className="px-4 py-3" colSpan={2}>
                      {sorted.length} job{sorted.length !== 1 ? "s" : ""}
                    </td>
                    <td colSpan={3}></td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: ORANGE }}>
                      {fmtCurrency(totalBilled)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Job Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white"
              style={{ borderColor: "#e5e7eb" }}>
              <h3 className="text-lg font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                {editing ? "Edit Job" : "Add New Job"}
              </h3>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">

              {/* RJ Number */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                  RJ Number <span className="text-red-400">*</span>
                </label>
                <input type="text"
                  value={form.rj_number}
                  onChange={e => setForm(p => ({ ...p, rj_number: e.target.value }))}
                  disabled={!!editing}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  style={{ borderColor: form.rj_number ? TEAL : undefined }}
                />
              </div>

              {/* Job Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                  Job Description
                </label>
                <input type="text"
                  value={form.job_description}
                  onChange={e => setForm(p => ({ ...p, job_description: e.target.value }))}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                />
              </div>

              {/* Customer Name with autocomplete */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                  Customer <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input type="text"
                    value={companySearch}
                    onChange={e => {
                      setCompanySearch(e.target.value);
                      setForm(p => ({ ...p, company_name: e.target.value }));
                      setShowCompanyDrop(true);
                    }}
                    onFocus={() => setShowCompanyDrop(true)}
                    onBlur={() => setTimeout(() => setShowCompanyDrop(false), 150)}
                    placeholder="Type customer name…"
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{ borderColor: form.company_name ? TEAL : undefined }}
                  />
                  {showCompanyDrop && filteredCustomers.length > 0 && (
                    <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                      {filteredCustomers.map(c => (
                        <li key={c.id}
                          onMouseDown={() => {
                            setCompanySearch(c.company_name);
                            setForm(p => ({ ...p, company_name: c.company_name }));
                            setShowCompanyDrop(false);
                          }}
                          className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0 text-sm text-gray-700">
                          {c.company_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Location + Contract Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                    Location
                  </label>
                  <input type="text"
                    value={form.location}
                    onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                    Contract Amount
                  </label>
                  <input type="number" inputMode="decimal" step="0.01" min="0"
                    value={form.contract_amount}
                    onChange={e => setForm(p => ({ ...p, contract_amount: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Start Date + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                    Start Date
                  </label>
                  <input type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                    Status
                  </label>
                  <select value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none bg-white">
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Certified Payroll */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="cert_payroll"
                  checked={form.certified_payroll}
                  onChange={e => setForm(p => ({ ...p, certified_payroll: e.target.checked }))}
                  className="w-4 h-4 accent-teal-700"
                />
                <label htmlFor="cert_payroll"
                  className="text-sm font-semibold uppercase tracking-wider cursor-pointer"
                  style={{ color: NAVY }}>
                  Certified Payroll Required
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: TEAL }}>
                  Notes
                </label>
                <textarea value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border-2 border-gray-300 rounded-xl py-3 font-bold uppercase tracking-wider text-gray-500 hover:border-gray-400 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50"
                  style={{ background: NAVY }}>
                  {saving ? "Saving…" : "Save Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
