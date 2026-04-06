"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import SiteHeader from "@/app/components/SiteHeader";

// ─── Constants ────────────────────────────────────────────────────────────────
const NAVY    = "#1F3864";
const TEAL    = "#1F6B6B";
const ORANGE  = "#C8102E";
const LTGRAY  = "#F2F2F2";
const DKGREEN = "#1E6B1E";

const CHART_COLORS = [
  "#1F3864","#1F6B6B","#C8102E","#1E6B1E","#7c3aed",
  "#b45309","#0369a1","#be185d","#065f46","#92400e",
];

const DAYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Tab = "weekly" | "monthly" | "ytd";

interface WeeklyEntry {
  id: number; rj_number: string; company_name: string; work_description: string;
  invoice_number: string;
  sun: number; mon: number; tue: number; wed: number; thu: number; fri: number; sat: number;
  week_total: number;
}

interface MonthlyEntry extends WeeklyEntry { week_start: string; }

interface YtdEntry { rj_number: string; company_name: string; week_start: string; week_total: number; }

function fmtCurrency(n: number) {
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function getSundayOfWeek(d: Date): Date {
  const out = new Date(d); out.setHours(0,0,0,0);
  out.setDate(out.getDate() - out.getDay()); return out;
}
function toISO(d: Date) { return d.toISOString().slice(0,10); }
function formatWeekRange(sun: Date) {
  const sat = new Date(sun); sat.setDate(sun.getDate()+6);
  return `${sun.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${sat.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("weekly");

  // ── Weekly state ──
  const [weekStart, setWeekStart] = useState<Date>(() => getSundayOfWeek(new Date()));
  const [weeklyEntries, setWeeklyEntries] = useState<WeeklyEntry[]>([]);
  const [weeklyLoading, setWeeklyLoading] = useState(false);

  // ── Monthly state ──
  const today = new Date();
  const [monthYear, setMonthYear] = useState(today.getFullYear());
  const [monthMonth, setMonthMonth] = useState(today.getMonth() + 1);
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyEntry[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);

  // ── YTD state ──
  const [ytdYear, setYtdYear] = useState(today.getFullYear());
  const [ytdEntries, setYtdEntries] = useState<YtdEntry[]>([]);
  const [ytdActiveJobs, setYtdActiveJobs] = useState(0);
  const [ytdLoading, setYtdLoading] = useState(false);

  // ── Fetch weekly ──
  const fetchWeekly = useCallback(async () => {
    setWeeklyLoading(true);
    try {
      const r = await fetch(`/api/reports/weekly?week=${toISO(weekStart)}`);
      if (r.ok) setWeeklyEntries(await r.json());
    } catch { /* ignore */ }
    finally { setWeeklyLoading(false); }
  }, [weekStart]);

  useEffect(() => { if (tab === "weekly") fetchWeekly(); }, [tab, fetchWeekly]);

  // ── Fetch monthly ──
  const fetchMonthly = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const r = await fetch(`/api/reports/monthly?year=${monthYear}&month=${monthMonth}`);
      if (r.ok) setMonthlyEntries(await r.json());
    } catch { /* ignore */ }
    finally { setMonthlyLoading(false); }
  }, [monthYear, monthMonth]);

  useEffect(() => { if (tab === "monthly") fetchMonthly(); }, [tab, fetchMonthly]);

  // ── Fetch YTD ──
  const fetchYtd = useCallback(async () => {
    setYtdLoading(true);
    try {
      const r = await fetch(`/api/reports/ytd?year=${ytdYear}`);
      if (r.ok) {
        const d = await r.json();
        setYtdEntries(d.entries || []);
        setYtdActiveJobs(d.activeJobs || 0);
      }
    } catch { /* ignore */ }
    finally { setYtdLoading(false); }
  }, [ytdYear]);

  useEffect(() => { if (tab === "ytd") fetchYtd(); }, [tab, fetchYtd]);

  // ─── WEEKLY COMPUTATIONS ──────────────────────────────────────────────────
  const weeklyCompanies = Array.from(new Set(weeklyEntries.map(e => e.company_name)));
  const weeklyBarData = DAY_LABELS.map((label, i) => {
    const day = DAYS[i];
    const obj: Record<string, unknown> = { day: label };
    for (const co of weeklyCompanies) {
      obj[co] = weeklyEntries
        .filter(e => e.company_name === co)
        .reduce((s, e) => s + Number(e[day] || 0), 0);
    }
    return obj;
  });
  const weekGrandTotal = weeklyEntries.reduce((s, e) => s + Number(e.week_total), 0);

  // ─── MONTHLY COMPUTATIONS ─────────────────────────────────────────────────
  const monthWeeks = Array.from(new Set(monthlyEntries.map(e => e.week_start))).sort();
  const monthlyBarData = monthWeeks.map(w => ({
    week: w.slice(5), // MM-DD
    total: monthlyEntries.filter(e => e.week_start === w).reduce((s, e) => s + Number(e.week_total), 0),
  }));
  const monthGrandTotal = monthlyEntries.reduce((s, e) => s + Number(e.week_total), 0);

  // Customer rollup
  const monthCustomers: Record<string, { total: number; weeks: Record<string, number>; jobCount: number }> = {};
  for (const e of monthlyEntries) {
    if (!monthCustomers[e.company_name]) {
      monthCustomers[e.company_name] = { total: 0, weeks: {}, jobCount: 0 };
    }
    monthCustomers[e.company_name].total += Number(e.week_total);
    monthCustomers[e.company_name].weeks[e.week_start] = (monthCustomers[e.company_name].weeks[e.week_start] || 0) + Number(e.week_total);
    monthCustomers[e.company_name].jobCount++;
  }
  const monthCustomerRows = Object.entries(monthCustomers)
    .sort((a, b) => b[1].total - a[1].total);

  // ─── YTD COMPUTATIONS ────────────────────────────────────────────────────
  const ytdTotal = ytdEntries.reduce((s, e) => s + Number(e.week_total), 0);

  // Monthly totals
  const ytdByMonth: number[] = new Array(12).fill(0);
  for (const e of ytdEntries) {
    const m = parseInt(e.week_start.slice(5, 7), 10) - 1;
    if (m >= 0 && m < 12) ytdByMonth[m] += Number(e.week_total);
  }
  const highestMonthIdx = ytdByMonth.indexOf(Math.max(...ytdByMonth));
  const highestMonthName = ytdByMonth[highestMonthIdx] > 0 ? MONTHS[highestMonthIdx] : "—";

  const ytdBarData = MONTHS.map((m, i) => ({ month: m, total: ytdByMonth[i] }));

  const ytdCustomers: Record<string, { months: number[]; total: number }> = {};
  for (const e of ytdEntries) {
    const m = parseInt(e.week_start.slice(5, 7), 10) - 1;
    if (!ytdCustomers[e.company_name]) ytdCustomers[e.company_name] = { months: new Array(12).fill(0), total: 0 };
    ytdCustomers[e.company_name].months[m] += Number(e.week_total);
    ytdCustomers[e.company_name].total += Number(e.week_total);
  }
  const ytdCustomerRows = Object.entries(ytdCustomers).sort((a, b) => b[1].total - a[1].total);
  const ytdCustomerCount = ytdCustomerRows.length;

  const currentMonth = today.getMonth();

  return (
    <div className="min-h-screen" style={{ background: LTGRAY, fontFamily: "Arial,Helvetica,sans-serif" }}>
      <SiteHeader />

      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Page Title */}
        <div className="bg-white rounded-2xl shadow p-6 mb-6">
          <h2 className="text-2xl font-bold uppercase tracking-wider" style={{ color: NAVY }}>Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5 uppercase tracking-wider">Billing analytics & summaries</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-2xl shadow p-2">
          {(["weekly","monthly","ytd"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3 text-sm font-bold uppercase tracking-widest rounded-xl transition"
              style={{
                background: tab === t ? NAVY : "transparent",
                color: tab === t ? "white" : TEAL,
              }}>
              {t === "weekly" ? "Weekly" : t === "monthly" ? "Monthly" : "YTD"}
            </button>
          ))}
        </div>

        {/* ── WEEKLY TAB ── */}
        {tab === "weekly" && (
          <div className="space-y-6">
            {/* Week Selector */}
            <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center gap-4">
              <button onClick={() => setWeekStart(d => { const n=new Date(d); n.setDate(n.getDate()-7); return n; })}
                className="w-10 h-10 rounded-full text-white text-xl font-bold flex items-center justify-center transition hover:opacity-80"
                style={{ background: NAVY }}>‹</button>
              <div className="flex-1 text-center">
                <p className="text-xs uppercase tracking-widest text-gray-400 mb-0.5">Week</p>
                <p className="text-xl font-bold" style={{ color: NAVY }}>{formatWeekRange(weekStart)}</p>
              </div>
              <button onClick={() => setWeekStart(d => { const n=new Date(d); n.setDate(n.getDate()+7); return n; })}
                className="w-10 h-10 rounded-full text-white text-xl font-bold flex items-center justify-center transition hover:opacity-80"
                style={{ background: NAVY }}>›</button>
            </div>

            {weeklyLoading ? (
              <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold">Loading…</p>
            ) : weeklyEntries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-16 text-center">
                <p className="text-gray-400 uppercase tracking-widest font-semibold">No entries for this week.</p>
              </div>
            ) : (
              <>
                {/* Grand Total Stat */}
                <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Week Total</p>
                    <p className="text-4xl font-bold tabular-nums" style={{ color: ORANGE }}>{fmtCurrency(weekGrandTotal)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Entries</p>
                    <p className="text-3xl font-bold" style={{ color: NAVY }}>{weeklyEntries.length}</p>
                  </div>
                </div>

                {/* Stacked Bar Chart by Customer */}
                {weeklyCompanies.length > 0 && (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEAL }}>Daily Totals by Customer</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={weeklyBarData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => v === 0 ? "" : "$" + Number(v).toLocaleString()} />
                        <Tooltip
                          formatter={(value, name) => [fmtCurrency(Number(value)), String(name)]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                        {weeklyCompanies.map((co, i) => (
                          <Bar key={co} dataKey={co} stackId="a"
                            fill={CHART_COLORS[i % CHART_COLORS.length]}
                            radius={i === weeklyCompanies.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Summary Table */}
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b" style={{ borderColor: "#e5e7eb" }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Entry Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white text-xs uppercase tracking-wider" style={{ background: NAVY }}>
                          <th className="px-3 py-2 text-left">RJ #</th>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">Work Description</th>
                          {DAY_LABELS.map(d => <th key={d} className="px-2 py-2 text-center">{d}</th>)}
                          <th className="px-3 py-2 text-left">Inv #</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Week Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyEntries.map((e, i) => (
                          <tr key={e.id} style={{ background: i % 2 === 0 ? "white" : LTGRAY }}>
                            <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: NAVY }}>{e.rj_number}</td>
                            <td className="px-3 py-2 text-gray-700 max-w-[140px] truncate">{e.company_name}</td>
                            <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{e.work_description || "—"}</td>
                            {DAYS.map(d => {
                              const v = Number(e[d] || 0);
                              return (
                                <td key={d} className="px-2 py-2 text-center tabular-nums"
                                  style={{ color: v > 0 ? DKGREEN : "#d1d5db", fontWeight: v > 0 ? 600 : 400 }}>
                                  {v > 0 ? v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{e.invoice_number || "—"}</td>
                            <td className="px-3 py-2 text-right font-bold tabular-nums whitespace-nowrap" style={{ color: ORANGE }}>
                              {fmtCurrency(Number(e.week_total))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="text-white text-xs font-bold" style={{ background: NAVY }}>
                          <td className="px-3 py-2" colSpan={3}>{weeklyEntries.length} entr{weeklyEntries.length === 1 ? "y" : "ies"}</td>
                          {DAYS.map(d => {
                            const s = weeklyEntries.reduce((t, e) => t + Number(e[d] || 0), 0);
                            return <td key={d} className="px-2 py-2 text-center tabular-nums" style={{ color: s > 0 ? "#6ee7b7" : undefined }}>
                              {s > 0 ? s.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                            </td>;
                          })}
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#fcd34d" }}>{fmtCurrency(weekGrandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── MONTHLY TAB ── */}
        {tab === "monthly" && (
          <div className="space-y-6">
            {/* Month Selector */}
            <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Month</label>
                <select value={monthMonth} onChange={e => setMonthMonth(Number(e.target.value))}
                  className="border-2 border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none bg-white"
                  style={{ borderColor: TEAL }}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Year</label>
                <select value={monthYear} onChange={e => setMonthYear(Number(e.target.value))}
                  className="border-2 border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none bg-white"
                  style={{ borderColor: TEAL }}>
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {monthlyLoading ? (
              <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold">Loading…</p>
            ) : monthlyEntries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-16 text-center">
                <p className="text-gray-400 uppercase tracking-widest font-semibold">No entries for this month.</p>
              </div>
            ) : (
              <>
                {/* Month Total Stat */}
                <div className="bg-white rounded-2xl shadow p-6">
                  <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Total Billed — {MONTHS[monthMonth - 1]} {monthYear}</p>
                  <p className="text-5xl font-bold tabular-nums" style={{ color: ORANGE }}>{fmtCurrency(monthGrandTotal)}</p>
                </div>

                {/* Weekly Bar Chart */}
                {monthlyBarData.length > 0 && (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEAL }}>Weekly Totals</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={monthlyBarData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                        <XAxis dataKey="week" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => v === 0 ? "" : "$" + Number(v).toLocaleString()} />
                        <Tooltip formatter={v => [fmtCurrency(Number(v)), "Total"]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]} fill={NAVY} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Customer Rollup Table */}
                <div className="bg-white rounded-2xl shadow overflow-hidden">
                  <div className="px-6 py-4 border-b" style={{ borderColor: "#e5e7eb" }}>
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Customer Rollup</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-white text-xs uppercase tracking-wider" style={{ background: NAVY }}>
                          <th className="px-4 py-3 text-left">Customer</th>
                          <th className="px-4 py-3 text-center"># Entries</th>
                          {monthWeeks.map(w => (
                            <th key={w} className="px-3 py-3 text-right whitespace-nowrap">{w.slice(5)}</th>
                          ))}
                          <th className="px-4 py-3 text-right">Month Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthCustomerRows.map(([co, data], i) => {
                          const isTop3 = i < 3;
                          return (
                            <tr key={co} style={{
                              background: i % 2 === 0 ? "white" : LTGRAY,
                              outline: isTop3 ? `2px solid #d97706` : undefined,
                              outlineOffset: isTop3 ? "-2px" : undefined,
                            }}>
                              <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>
                                {isTop3 && <span className="mr-1.5 text-amber-600 font-bold">★</span>}
                                {co}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-600">{data.jobCount}</td>
                              {monthWeeks.map(w => (
                                <td key={w} className="px-3 py-3 text-right tabular-nums text-gray-600">
                                  {data.weeks[w] ? fmtCurrency(data.weeks[w]) : "—"}
                                </td>
                              ))}
                              <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: ORANGE }}>
                                {fmtCurrency(data.total)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="text-white text-xs font-bold" style={{ background: NAVY }}>
                          <td className="px-4 py-3">{monthCustomerRows.length} customers</td>
                          <td className="px-4 py-3 text-center">{monthlyEntries.length}</td>
                          {monthWeeks.map(w => {
                            const s = monthlyEntries.filter(e => e.week_start === w).reduce((t, e) => t + Number(e.week_total), 0);
                            return <td key={w} className="px-3 py-3 text-right tabular-nums" style={{ color: "#fcd34d" }}>{fmtCurrency(s)}</td>;
                          })}
                          <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#fcd34d" }}>{fmtCurrency(monthGrandTotal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── YTD TAB ── */}
        {tab === "ytd" && (
          <div className="space-y-6">
            {/* Year Selector */}
            <div className="bg-white rounded-2xl shadow px-6 py-4 flex items-center gap-4">
              <label className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Year</label>
              <select value={ytdYear} onChange={e => setYtdYear(Number(e.target.value))}
                className="border-2 border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none bg-white"
                style={{ borderColor: TEAL }}>
                {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {ytdLoading ? (
              <p className="text-center text-gray-400 py-16 uppercase tracking-widest font-semibold">Loading…</p>
            ) : (
              <>
                {/* 4 Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Total Billed YTD", value: fmtCurrency(ytdTotal), color: ORANGE },
                    { label: "Active Jobs", value: String(ytdActiveJobs), color: NAVY },
                    { label: "Customers Billed", value: String(ytdCustomerCount), color: TEAL },
                    { label: "Highest Month", value: highestMonthName, color: DKGREEN },
                  ].map(card => (
                    <div key={card.label} className="bg-white rounded-2xl shadow p-6">
                      <p className="text-xs uppercase tracking-widest text-gray-400 mb-2">{card.label}</p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: card.color }}>{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Monthly Bar Chart */}
                {ytdTotal > 0 && (
                  <div className="bg-white rounded-2xl shadow p-6">
                    <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: TEAL }}>Monthly Totals — {ytdYear}</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={ytdBarData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                          tickFormatter={v => v === 0 ? "" : "$" + Number(v).toLocaleString()} />
                        <Tooltip formatter={v => [fmtCurrency(Number(v)), "Total"]}
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {ytdBarData.map((entry, i) => (
                            <Cell key={i} fill={
                              ytdYear === today.getFullYear() && i === currentMonth ? ORANGE :
                              entry.total > 0 ? NAVY : "#e5e7eb"
                            } />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Customer Ranking Table */}
                {ytdCustomerRows.length > 0 && (
                  <div className="bg-white rounded-2xl shadow overflow-hidden">
                    <div className="px-6 py-4 border-b" style={{ borderColor: "#e5e7eb" }}>
                      <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: TEAL }}>Customer Rankings — {ytdYear}</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-white text-xs uppercase tracking-wider" style={{ background: NAVY }}>
                            <th className="px-4 py-3 text-center">Rank</th>
                            <th className="px-4 py-3 text-left">Customer</th>
                            {MONTHS.map(m => <th key={m} className="px-2 py-3 text-right">{m}</th>)}
                            <th className="px-4 py-3 text-right whitespace-nowrap">YTD Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ytdCustomerRows.map(([co, data], i) => {
                            const rank = i + 1;
                            const isGold = rank === 1;
                            return (
                              <tr key={co} style={{
                                background: i % 2 === 0 ? "white" : LTGRAY,
                                outline: isGold ? "2px solid #d97706" : undefined,
                                outlineOffset: isGold ? "-2px" : undefined,
                              }}>
                                <td className="px-4 py-3 text-center">
                                  {isGold ? (
                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white"
                                      style={{ background: "#d97706" }}>#1</span>
                                  ) : (
                                    <span className="text-gray-500 font-semibold">#{rank}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>{co}</td>
                                {data.months.map((v, mi) => (
                                  <td key={mi} className="px-2 py-3 text-right tabular-nums text-gray-600 text-xs">
                                    {v > 0 ? fmtCurrency(v) : <span className="text-gray-300">—</span>}
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: ORANGE }}>
                                  {fmtCurrency(data.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="text-white text-xs font-bold" style={{ background: NAVY }}>
                            <td className="px-4 py-3" colSpan={2}>{ytdCustomerRows.length} customers</td>
                            {ytdByMonth.map((v, i) => (
                              <td key={i} className="px-2 py-3 text-right tabular-nums" style={{ color: v > 0 ? "#fcd34d" : undefined }}>
                                {v > 0 ? fmtCurrency(v) : "—"}
                              </td>
                            ))}
                            <td className="px-4 py-3 text-right tabular-nums" style={{ color: "#fcd34d" }}>{fmtCurrency(ytdTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {ytdTotal === 0 && !ytdLoading && (
                  <div className="bg-white rounded-2xl shadow p-16 text-center">
                    <p className="text-gray-400 uppercase tracking-widest font-semibold">No entries for {ytdYear}.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
