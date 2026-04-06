"use client";

import { useState, useEffect, useCallback } from "react";
import NavBar from "@/app/components/NavBar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: number;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  notes: string;
  job_count: number;
  total_billed_ytd: number;
  last_entry_date: string | null;
}

interface Toast { msg: string; type: "success" | "error"; }

type SortCol = "company_name" | "job_count" | "total_billed_ytd" | "last_entry_date";

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY   = "#1F3864";
const TEAL   = "#1F6B6B";
const ORANGE = "#C55A11";
const DKGREEN = "#1E6B1E";
const LTGRAY = "#F2F2F2";

const EMPTY_FORM = {
  company_name: "", contact_name: "", contact_email: "",
  contact_phone: "", address: "", notes: "",
};

function fmtCurrency(n: number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [sortCol, setSortCol]       = useState<SortCol>("company_name");
  const [sortDir, setSortDir]       = useState<"asc" | "desc">("asc");
  const [showModal, setShowModal]   = useState(false);
  const [editing, setEditing]       = useState<Customer | null>(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<Toast | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/customers");
      if (r.ok) setCustomers(await r.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }
  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      company_name:  c.company_name,
      contact_name:  c.contact_name  || "",
      contact_email: c.contact_email || "",
      contact_phone: c.contact_phone || "",
      address:       c.address       || "",
      notes:         c.notes         || "",
    });
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_name.trim()) {
      setToast({ msg: "Company name is required.", type: "error" }); return;
    }
    setSaving(true);
    try {
      const url    = editing ? `/api/customers/${editing.id}` : "/api/customers";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Server error"); }
      setToast({ msg: editing ? "Customer updated." : "Customer added.", type: "success" });
      setShowModal(false);
      await loadCustomers();
    } catch (err) {
      setToast({ msg: `Error: ${err instanceof Error ? err.message : "Unknown"}`, type: "error" });
    } finally { setSaving(false); }
  }

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const filtered = customers
    .filter(c => !search || c.company_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortCol] ?? "";
      const bv = b[sortCol] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalJobs = filtered.reduce((s, c) => s + (c.job_count || 0), 0);
  const totalYTD  = filtered.reduce((s, c) => s + Number(c.total_billed_ytd || 0), 0);

  function SortIcon({ col }: { col: SortCol }) {
    if (sortCol !== col) return <span className="opacity-30 ml-1">↕</span>;
    return <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const COLS: [SortCol, string][] = [
    ["company_name",    "Company Name"],
    ["job_count",       "# Jobs"],
    ["total_billed_ytd","Total Billed YTD"],
    ["last_entry_date", "Last Entry"],
  ];

  return (
    <div className="min-h-screen" style={{ background: LTGRAY, fontFamily: "Arial,Helvetica,sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 rounded-xl px-6 py-3 text-white text-sm font-semibold shadow-2xl"
          style={{ background: toast.type === "success" ? DKGREEN : "#dc2626" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="text-white px-8 py-4 shadow-lg" style={{ background: NAVY }}>
        <h1 className="text-2xl font-bold tracking-wider uppercase">Vance Corp — Rental Billing</h1>
      </header>
      <NavBar />

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold uppercase tracking-wider" style={{ color: NAVY }}>Customers</h2>
              <p className="text-sm text-gray-500 mt-0.5">{customers.length} total customers</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <input type="text" placeholder="Search by company name…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="border-2 border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none w-64"
                style={{ borderColor: search ? TEAL : undefined }}
              />
              <button onClick={openAdd}
                className="text-white text-sm font-bold px-5 py-2.5 rounded-xl transition hover:opacity-80 whitespace-nowrap"
                style={{ background: NAVY }}>
                + Add New Customer
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <p className="text-center text-gray-400 py-16">Loading customers…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white text-xs uppercase tracking-wider" style={{ background: NAVY }}>
                    {COLS.map(([col, label]) => (
                      <th key={col}
                        className="px-4 py-3 text-left cursor-pointer hover:opacity-80 select-none whitespace-nowrap"
                        onClick={() => handleSort(col)}>
                        {label}<SortIcon col={col} />
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-16 text-center text-gray-400">
                        {search ? "No customers match your search." : "No customers yet."}
                      </td>
                    </tr>
                  ) : filtered.map((c, i) => (
                    <tr key={c.id} style={{ background: i % 2 === 0 ? "white" : LTGRAY }}>
                      <td className="px-4 py-3 font-semibold">
                        <a href={`/customers/${c.id}`}
                          className="hover:underline transition-colors"
                          style={{ color: NAVY }}>
                          {c.company_name}
                        </a>
                        {c.contact_name && (
                          <div className="text-xs text-gray-400 mt-0.5">{c.contact_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-center">{c.job_count || 0}</td>
                      <td className="px-4 py-3 font-semibold tabular-nums" style={{ color: ORANGE }}>
                        {fmtCurrency(Number(c.total_billed_ytd || 0))}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {c.last_entry_date || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(c)}
                          className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition hover:opacity-80"
                          style={{ color: TEAL, borderColor: TEAL }}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-white text-xs font-bold" style={{ background: NAVY }}>
                    <td className="px-4 py-3">{filtered.length} customer{filtered.length !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-center">{totalJobs}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: ORANGE }}>{fmtCurrency(totalYTD)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: "#e5e7eb" }}>
              <h3 className="text-lg font-bold uppercase tracking-wider" style={{ color: NAVY }}>
                {editing ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {([
                ["company_name",  "Company Name",    true],
                ["contact_name",  "Contact Name",    false],
                ["contact_email", "Contact Email",   false],
                ["contact_phone", "Contact Phone",   false],
                ["address",       "Address",         false],
              ] as [keyof typeof EMPTY_FORM, string, boolean][]).map(([field, label, required]) => (
                <div key={field}>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: TEAL }}>
                    {label} {required && <span className="text-red-400">*</span>}
                  </label>
                  <input type="text"
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none"
                    style={{ borderColor: form[field] ? TEAL : undefined }}
                  />
                </div>
              ))}
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
                  className="flex-1 border-2 border-gray-300 rounded-xl py-3 font-bold text-gray-500 hover:border-gray-400 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 text-white font-bold py-3 rounded-xl transition hover:opacity-80 disabled:opacity-50"
                  style={{ background: NAVY }}>
                  {saving ? "Saving…" : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
