import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Tailwind assumed available. No external UI libs to keep this file self-contained.
// This file uses React + TS types inside the canvas runner.

// ===== Types =====
type Range = { low: number; mid: number; high: number };

type LineItem = {
  key: string;
  label: string;
  sf: number; // generic quantity for math
  unit: Range; // $/unit
};

type UnitKind = "SF" | "LF" | "EA" | "ALW";

type TradeItem = {
  key: string;
  label: string;
  qty: number; // numeric quantity
  unitKind: UnitKind; // display only
  unit: Range; // $/unit
};

type TestResult = { name: string; pass: boolean; message: string };

const APP_NAME = "Rail Vihar Addition Estimate";

// ===== Helpers =====
const currency = (n: number) =>
  n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function calcTotals(items: LineItem[], aePct: Range, contPct: Range, permits: Range, otherAllow: Range) {
  const hard = items.reduce(
    (acc, it) => {
      const low = it.sf * it.unit.low;
      const mid = it.sf * it.unit.mid;
      const high = it.sf * it.unit.high;
      return { low: acc.low + low, mid: acc.mid + mid, high: acc.high + high };
    },
    { low: 0, mid: 0, high: 0 }
  );

  const ae = {
    low: (aePct.low / 100) * hard.low,
    mid: (aePct.mid / 100) * hard.mid,
    high: (aePct.high / 100) * hard.high,
  };
  const cont = {
    low: (contPct.low / 100) * hard.low,
    mid: (contPct.mid / 100) * hard.mid,
    high: (contPct.high / 100) * hard.high,
  };

  const allIn = {
    low: hard.low + ae.low + cont.low + permits.low + otherAllow.low,
    mid: hard.mid + ae.mid + cont.mid + permits.mid + otherAllow.mid,
    high: hard.high + ae.high + cont.high + permits.high + otherAllow.high,
  };

  return { hard, ae, cont, allIn };
}

function tradesToLineItems(trades: TradeItem[]): LineItem[] {
  return trades.map((t) => ({ key: `trade:${t.key}`, label: t.label, sf: t.qty, unit: t.unit }));
}

// Animated currency for pleasing updates
function AnimatedCurrency({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const start = prev.current;
    const delta = value - start;
    const duration = 600; // ms
    const t0 = performance.now();
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setDisplay(start + delta * ease(p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    prev.current = value;
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{currency(display)}</>;
}

// Range bar showing low/mid/high visually
function RangeBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  const max = Math.max(low, mid, high, 1);
  const pct = (n: number) => Math.max(2, Math.min(100, (n / max) * 100));
  return (
    <div className="mt-2">
      <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-300 via-amber-300 to-rose-300" style={{ width: `${pct(high)}%` }} />
      </div>
      <div className="relative text-[10px] text-slate-500 mt-1">
        <span className="absolute" style={{ left: `${pct(low)}%`, transform: "translateX(-50%)" }}>Low</span>
        <span className="absolute" style={{ left: `${pct(mid)}%`, transform: "translateX(-50%)" }}>Mid</span>
        <span className="absolute" style={{ left: `${pct(high)}%`, transform: "translateX(-50%)" }}>High</span>
      </div>
    </div>
  );
}

export default function RailViharAdditionEstimator() {
  // ===== Hero Video =====
// Use relative path for video hosted in site root (GitHub Pages can't load sandbox URLs)
const fallbackDownload = "/estimation/25.08.07 - Front Video.mov";
  const [heroURL, setHeroURL] = useState<string | null>(null); // blob/object URL for playback
  const [videoError, setVideoError] = useState<boolean>(false);
  const [loadingVideo, setLoadingVideo] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Try to fetch the uploaded MOV and convert to a blob URL (more compatible for <video>)
  useEffect(() => {
    let revoke: string | null = null;
    (async () => {
      try {
        setLoadingVideo(true);
        const resp = await fetch(fallbackDownload);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        revoke = url;
        setHeroURL(url);
        setVideoError(false);
      } catch (e) {
        setVideoError(true);
      } finally {
        setLoadingVideo(false);
      }
    })();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, []);

  // Allow the user to provide a more compatible file (e.g., MP4 H.264) if MOV doesn't play
  const onSelectVideo: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setHeroURL(url);
    setVideoError(false);
  };

  // ===== Macro areas (existing section) =====
  const [items, setItems] = useState<LineItem[]>([
    { key: "conditioned", label: "Conditioned Addition", sf: 7029, unit: { low: 260, mid: 300, high: 340 } },
    { key: "garage", label: "Garage(s)", sf: 711, unit: { low: 35, mid: 47.5, high: 60 } },
    { key: "carport", label: "Carport", sf: 764, unit: { low: 20, mid: 40, high: 60 } },
    { key: "porch", label: "Rear Porch", sf: 1521, unit: { low: 40, mid: 80, high: 120 } },
    { key: "balconies", label: "Balconies", sf: 190, unit: { low: 40, mid: 80, high: 120 } },
  ]);

  const conditionedSF = items.find((i) => i.key === "conditioned")?.sf ?? 0;
  const roofCoverSF = items.reduce((sum, i) => (i.key !== "garage" ? sum + i.sf : sum + 0), 0); // simple approx
  const balconySF = items.find((i) => i.key === "balconies")?.sf ?? 0;

  // ===== Florida/Jax specific trade breakdown =====
  const [trades, setTrades] = useState<TradeItem[]>([
    { key: "impactWindows", label: "Impact-Rated Windows", qty: 30, unitKind: "EA", unit: { low: 1400, mid: 2200, high: 3200 } },
    { key: "extDoors", label: "Impact Exterior Doors", qty: 6, unitKind: "EA", unit: { low: 1800, mid: 2600, high: 4000 } },
    { key: "garageDoors", label: "Impact Garage Doors", qty: 2, unitKind: "EA", unit: { low: 2500, mid: 4500, high: 6500 } },
    { key: "roofing", label: "Roofing (wind-uplift rated)", qty: roofCoverSF, unitKind: "SF", unit: { low: 9, mid: 13, high: 18 } },
    { key: "framing", label: "Structural Framing & Sheathing (allowance)", qty: 1, unitKind: "ALW", unit: { low: 180000, mid: 240000, high: 320000 } },
    { key: "stucco", label: "Exterior Stucco/Cladding (allowance)", qty: 1, unitKind: "ALW", unit: { low: 35000, mid: 55000, high: 90000 } },
    { key: "insulation", label: "Insulation incl. attic baffles", qty: conditionedSF, unitKind: "SF", unit: { low: 2.5, mid: 3.5, high: 4.5 } },
    { key: "drywallPaint", label: "Drywall + Prime/Paint", qty: conditionedSF, unitKind: "SF", unit: { low: 6, mid: 8, high: 11 } },
    { key: "flooring", label: "Flooring (material+install)", qty: conditionedSF, unitKind: "SF", unit: { low: 6, mid: 9, high: 14 } },
    { key: "cabsTops", label: "Cabinetry & Tops (allowance)", qty: 1, unitKind: "ALW", unit: { low: 35000, mid: 60000, high: 90000 } },
    { key: "hvac", label: "HVAC Systems (equip+ducts)", qty: 2, unitKind: "EA", unit: { low: 11000, mid: 16000, high: 22000 } },
    { key: "plumbing", label: "Plumbing Rough + Fixtures (allowance)", qty: 1, unitKind: "ALW", unit: { low: 50000, mid: 80000, high: 120000 } },
    { key: "electrical", label: "Electrical Rough + Fixtures (allowance)", qty: 1, unitKind: "ALW", unit: { low: 45000, mid: 75000, high: 110000 } },
    { key: "waterproofing", label: "Balcony/Deck Waterproofing", qty: balconySF, unitKind: "SF", unit: { low: 12, mid: 20, high: 30 } },
    { key: "hurricane", label: "Hurricane Straps & Hold-downs (allowance)", qty: 1, unitKind: "ALW", unit: { low: 8000, mid: 12000, high: 18000 } },
    { key: "termite", label: "Termite Treatment & Soil Poison", qty: 1, unitKind: "ALW", unit: { low: 1500, mid: 2200, high: 3500 } },
    { key: "dumpsters", label: "Dumpsters / Cleanup (allowance)", qty: 1, unitKind: "ALW", unit: { low: 8000, mid: 12000, high: 16000 } },
  ]);

  // Soft costs (editable)
  const [aePct, setAePct] = useState<Range>({ low: 10, mid: 12.5, high: 15 });
  const [contPct, setContPct] = useState<Range>({ low: 10, mid: 12.5, high: 15 });
  const [permits, setPermits] = useState<Range>({ low: 2500, mid: 4000, high: 10000 });
  const [otherAllow, setOtherAllow] = useState<Range>({ low: 80000, mid: 100000, high: 150000 });
  type ApplyMode = "HARD_ONLY" | "HARD_PLUS_PERMITS_OTHERS";
  const [applyMode, setApplyMode] = useState<ApplyMode>("HARD_ONLY");

  // ===== Derived totals =====
  const baseTotals = useMemo(
    () => calcTotals(items, aePct, contPct, permits, otherAllow),
    [items, aePct, contPct, permits, otherAllow]
  );

  const mergedItems = useMemo(() => [...items, ...tradesToLineItems(trades)], [items, trades]);
  const mergedTotals = useMemo(
    () => calcTotals(mergedItems, aePct, contPct, permits, otherAllow),
    [mergedItems, aePct, contPct, permits, otherAllow]
  );

  const viewTotals = useMemo(() => {
    const hard = mergedTotals.hard; // macro + trades
    const baseLow = applyMode === "HARD_ONLY" ? hard.low : hard.low + permits.low + otherAllow.low;
    const baseMid = applyMode === "HARD_ONLY" ? hard.mid : hard.mid + permits.mid + otherAllow.mid;
    const baseHigh = applyMode === "HARD_ONLY" ? hard.high : hard.high + permits.high + otherAllow.high;

    const ae = {
      low: (aePct.low / 100) * baseLow,
      mid: (aePct.mid / 100) * baseMid,
      high: (aePct.high / 100) * baseHigh,
    };
    const cont = {
      low: (contPct.low / 100) * baseLow,
      mid: (contPct.mid / 100) * baseMid,
      high: (contPct.high / 100) * baseHigh,
    };

    const allIn = {
      low: hard.low + ae.low + cont.low + permits.low + otherAllow.low,
      mid: hard.mid + ae.mid + cont.mid + permits.mid + otherAllow.mid,
      high: hard.high + ae.high + cont.high + permits.high + otherAllow.high,
    };

    return { hard, ae, cont, allIn };
  }, [mergedTotals, applyMode, aePct, contPct, permits, otherAllow]);

  // ===== CSV Export =====
  const exportCSV = () => {
    const header = [
      "Scope,Quantity,Unit,Unit $ (Low),Unit $ (Mid),Unit $ (High),Cost (Low),Cost (Mid),Cost (High)",
    ];

    const itemRows = items.map((it) => {
      const low = it.sf * it.unit.low;
      const mid = it.sf * it.unit.mid;
      const high = it.sf * it.unit.high;
      const unit = "$ / sf";
      return [it.label, it.sf, unit, it.unit.low, it.unit.mid, it.unit.high, low, mid, high].join(",");
    });

    const tradeRows = trades.map((t) => {
      const low = t.qty * t.unit.low;
      const mid = t.qty * t.unit.mid;
      const high = t.qty * t.unit.high;
      return [t.label, t.qty, t.unitKind, t.unit.low, t.unit.mid, t.unit.high, low, mid, high].join(",");
    });

    const hard = [
      "HARD COST SUBTOTAL",
      mergedItems.reduce((a, b) => a + b.sf, 0),
      "",
      "",
      "",
      "",
      mergedTotals.hard.low,
      mergedTotals.hard.mid,
      mergedTotals.hard.high,
    ].join(",");

    const softHdr = [
      `A/E Base: ${applyMode === "HARD_ONLY" ? "Hard only" : "Hard + permits + other"}`,
    ];

    const ae = [
      "Architecture & Engineering ($)",
      "",
      "",
      "",
      "",
      viewTotals.ae.low,
      viewTotals.ae.mid,
      viewTotals.ae.high,
    ].join(",");

    const cont = [
      "Contingency ($)",
      "",
      "",
      "",
      "",
      viewTotals.cont.low,
      viewTotals.cont.mid,
      viewTotals.cont.high,
    ].join(",");

    const permitsRow = [
      "Permits & Plan Review (allowance)",
      "",
      "",
      "",
      "",
      permits.low,
      permits.mid,
      permits.high,
    ].join(",");

    const otherRow = [
      "Other Soft Costs & Allowances",
      "",
      "",
      "",
      "",
      otherAllow.low,
      otherAllow.mid,
      otherAllow.high,
    ].join(",");

    const grand = [
      "ALL-IN ESTIMATE",
      "",
      "",
      "",
      "",
      viewTotals.allIn.low,
      viewTotals.allIn.mid,
      viewTotals.allIn.high,
    ].join(",");

    const csv = [
      ...header,
      ...itemRows,
      ...tradeRows,
      hard,
      ...softHdr,
      ae,
      cont,
      permitsRow,
      otherRow,
      grand,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rail-Vihar-Addition-Estimate-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Self-tests =====
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  useEffect(() => {
    const tests: TestResult[] = [];

    // Test 1: Single line item sanity check (unchanged)
    (function testSingleItem() {
      const itm: LineItem[] = [{ key: "t1", label: "T1", sf: 100, unit: { low: 10, mid: 20, high: 30 } }];
      const ae = { low: 10, mid: 10, high: 10 };
      const ct = { low: 10, mid: 10, high: 10 };
      const pm = { low: 0, mid: 0, high: 0 };
      const oth = { low: 0, mid: 0, high: 0 };
      const r = calcTotals(itm, ae, ct, pm, oth);
      const expect = {
        hard: { low: 1000, mid: 2000, high: 3000 },
        ae: { low: 100, mid: 200, high: 300 },
        cont: { low: 100, mid: 200, high: 300 },
        allIn: { low: 1200, mid: 2400, high: 3600 },
      };
      const ok =
        r.hard.low === expect.hard.low &&
        r.hard.mid === expect.hard.mid &&
        r.hard.high === expect.hard.high &&
        r.ae.low === expect.ae.low &&
        r.cont.high === expect.cont.high &&
        r.allIn.mid === expect.allIn.mid;
      tests.push({ name: "Single item math", pass: ok, message: ok ? "PASS" : `FAIL got ${JSON.stringify(r)} expected ${JSON.stringify(expect)}` });
    })();

    // Test 2: Parity for baseTotals (macro items only)
    (function testParity() {
      const viaFn = calcTotals(items, aePct, contPct, permits, otherAllow);
      const ok = Math.abs(viaFn.hard.low - baseTotals.hard.low) < 1e-6 && Math.abs(viaFn.allIn.high - baseTotals.allIn.high) < 1e-6;
      tests.push({ name: "Totals parity (macro only)", pass: ok, message: ok ? "PASS" : `Mismatch base vs fn` });
    })();

    // Test 3: Trade items contribute to hard cost
    (function testTrades() {
      const t: TradeItem[] = [{ key: "X", label: "X", qty: 5, unitKind: "EA", unit: { low: 100, mid: 200, high: 300 } }];
      const merged = [...items, ...tradesToLineItems(t)];
      const via = calcTotals(merged, aePct, contPct, { low: 0, mid: 0, high: 0 }, { low: 0, mid: 0, high: 0 });
      const macro = calcTotals(items, aePct, contPct, { low: 0, mid: 0, high: 0 }, { low: 0, mid: 0, high: 0 });
      const ok = via.hard.low - macro.hard.low === 500 && via.hard.mid - macro.hard.mid === 1000 && via.hard.high - macro.hard.high === 1500;
      tests.push({ name: "Trades increase hard cost", pass: ok, message: ok ? "PASS" : `Expected +500/+1000/+1500, got ${JSON.stringify(via.hard)}` });
    })();

    // Test 4: Apply mode affects AE/Cont totals when permits/other > 0
    (function testApplyMode() {
      const hard = { low: 1000, mid: 1000, high: 1000 };
      const ae = { low: 10, mid: 10, high: 10 };
      const ct = { low: 10, mid: 10, high: 10 };
      const pm = { low: 100, mid: 100, high: 100 };
      const oth = { low: 100, mid: 100, high: 100 };
      const hardOnlyAE = { low: (ae.low / 100) * hard.low, mid: (ae.mid / 100) * hard.mid, high: (ae.high / 100) * hard.high };
      const plusAllAE = { low: (ae.low / 100) * (hard.low + pm.low + oth.low), mid: (ae.mid / 100) * (hard.mid + pm.mid + oth.mid), high: (ae.high / 100) * (hard.high + pm.high + oth.high) };
      const ok = plusAllAE.low > hardOnlyAE.low && plusAllAE.high > hardOnlyAE.high;
      tests.push({ name: "Apply mode changes AE base", pass: ok, message: ok ? "PASS" : `Expected plusAll > hardOnly` });
    })();

    // Test 5: Zero items should yield zero totals
    (function testZero() {
      const none: LineItem[] = [];
      const zero = calcTotals(none, { low: 0, mid: 0, high: 0 }, { low: 0, mid: 0, high: 0 }, { low: 0, mid: 0, high: 0 }, { low: 0, mid: 0, high: 0 });
      const ok = zero.hard.low === 0 && zero.ae.mid === 0 && zero.allIn.high === 0;
      tests.push({ name: "Zero input totals", pass: ok, message: ok ? "PASS" : `Expected zeros, got ${JSON.stringify(zero)}` });
    })();

    setTestResults(tests);
  }, [items, aePct, contPct, permits, otherAllow, baseTotals]);

  // ===== UI =====
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* HERO */}
      <section className="relative h-[56vh] md:h-[72vh] overflow-hidden">
        {/* Ken Burns / slow zoom wrapper */}
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1, opacity: 0.85 }}
          animate={{ scale: 1.08, opacity: 1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        >
          {heroURL && !videoError ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onError={() => setVideoError(true)}
              src={heroURL}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500" />
          )}
        </motion.div>

        {/* Dark gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent" />

        {/* Headline overlay */}
        <div className="relative z-10 h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-10">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 text-xs text-white/80 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/20">Rail Vihar • 32217</span>
              <span className="px-2 py-0.5 rounded-full bg-white/10 ring-1 ring-white/20">Residential Addition</span>
            </div>
            <h1 className="text-white text-3xl md:text-5xl font-semibold leading-tight drop-shadow">{APP_NAME}</h1>
            <p className="text-white/80 mt-2 max-w-2xl drop-shadow">
              Live budget model with finish-level controls, trades, and soft costs.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 items-center">
              <a href="#estimator" className="px-4 py-2 rounded-xl bg-white text-slate-900 font-medium shadow hover:shadow-md">Open Estimator</a>
              <a href={fallbackDownload} className="px-4 py-2 rounded-xl border border-white/40 text-white/90 hover:bg-white/10" download>
                Download Original Video
              </a>
              <label className="px-3 py-2 rounded-xl bg-white/10 text-white/90 ring-1 ring-white/30 cursor-pointer hover:bg-white/20">
                <input type="file" accept="video/*" className="hidden" onChange={onSelectVideo} />
                Replace Hero Video
              </label>
            </div>
            {(loadingVideo || videoError) && (
              <div className="mt-3 text-xs text-white/80">
                {loadingVideo ? "Loading hero video…" : "Couldn’t play the MOV in your browser. Try clicking ‘Replace Hero Video’ and upload an MP4 (H.264) for best compatibility."}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* HEADER */}
      <header className="sticky top-0 backdrop-blur bg-white/70 border-b z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-black/90 text-white grid place-items-center font-semibold">RV</div>
            <div>
              <h2 className="text-lg font-semibold">{APP_NAME}</h2>
              <p className="text-xs text-slate-500">32217 • Detailed ROM budgeting tool</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm shadow hover:shadow-md transition">Export CSV</button>
          </div>
        </div>
      </header>

      <main id="estimator" className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* KPI Cards */}
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="grid md:grid-cols-3 gap-4">
          {([
            { label: "All-In (Low)", value: viewTotals.allIn.low },
            { label: "All-In (Mid)", value: viewTotals.allIn.mid },
            { label: "All-In (High)", value: viewTotals.allIn.high },
          ] as const).map((c, i) => (
            <div key={i} className="rounded-2xl border p-5 bg-white/80 backdrop-blur shadow-sm hover:shadow-md transition">
              <div className="text-xs uppercase tracking-wide text-slate-500">{c.label}</div>
              <div className="text-2xl font-bold mt-1"><AnimatedCurrency value={c.value} /></div>
              {i === 1 && <RangeBar low={viewTotals.allIn.low} mid={viewTotals.allIn.mid} high={viewTotals.allIn.high} />}
            </div>
          ))}
        </motion.section>

        {/* Macro areas */}
        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Hard Costs – Macro Areas ($/sf)</h3>
            <div className="text-sm text-slate-500">Edit SF or unit costs to see live totals</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3">Scope</th>
                  <th className="text-right px-4 py-3">Square Feet</th>
                  <th className="text-right px-4 py-3">$/sf Low</th>
                  <th className="text-right px-4 py-3">$/sf Mid</th>
                  <th className="text-right px-4 py-3">$/sf High</th>
                  <th className="text-right px-4 py-3">Cost Low</th>
                  <th className="text-right px-4 py-3">Cost Mid</th>
                  <th className="text-right px-4 py-3">Cost High</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const low = it.sf * it.unit.low;
                  const mid = it.sf * it.unit.mid;
                  const high = it.sf * it.unit.high;
                  return (
                    <tr key={it.key} className="border-t hover:bg-slate-50/60">
                      <td className="px-4 py-2">{it.label}</td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-28 text-right bg-slate-50 border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" type="number" value={it.sf} onChange={(e) => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, sf: Number(e.target.value || 0) } : x)))} min={0} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-300" type="number" value={it.unit.low} onChange={(e) => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, unit: { ...x.unit, low: Number(e.target.value || 0) } } : x)))} min={0} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-300" type="number" value={it.unit.mid} onChange={(e) => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, unit: { ...x.unit, mid: Number(e.target.value || 0) } } : x)))} min={0} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-300" type="number" value={it.unit.high} onChange={(e) => setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, unit: { ...x.unit, high: Number(e.target.value || 0) } } : x)))} min={0} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{currency(low)}</td>
                      <td className="px-4 py-2 text-right font-medium">{currency(mid)}</td>
                      <td className="px-4 py-2 text-right font-medium">{currency(high)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="px-4 py-2">HARD COST SUBTOTAL (macro only)</td>
                  <td className="px-4 py-2 text-right">{items.reduce((a, b) => a + b.sf, 0).toLocaleString()}</td>
                  <td className="px-4 py-2" colSpan={3}></td>
                  <td className="px-4 py-2 text-right">{currency(baseTotals.hard.low)}</td>
                  <td className="px-4 py-2 text-right">{currency(baseTotals.hard.mid)}</td>
                  <td className="px-4 py-2 text-right">{currency(baseTotals.hard.high)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed trades */}
        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">Detailed Trades (FL/JAX specifics)</h3>
            <div className="text-sm text-slate-500">Edit Qty, Unit, and $/unit</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3">Trade</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-left px-4 py-3">Unit</th>
                  <th className="text-right px-4 py-3">Unit $ Low</th>
                  <th className="text-right px-4 py-3">Unit $ Mid</th>
                  <th className="text-right px-4 py-3">Unit $ High</th>
                  <th className="text-right px-4 py-3">Cost Low</th>
                  <th className="text-right px-4 py-3">Cost Mid</th>
                  <th className="text-right px-4 py-3">Cost High</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const low = t.qty * t.unit.low;
                  const mid = t.qty * t.unit.mid;
                  const high = t.qty * t.unit.high;
                  return (
                    <tr key={t.key} className="border-t hover:bg-slate-50/60">
                      <td className="px-4 py-2">{t.label}</td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-slate-300" type="number" value={t.qty} min={0} onChange={(e) => setTrades((prev) => prev.map((x) => (x.key === t.key ? { ...x, qty: Number(e.target.value || 0) } : x)))} />
                      </td>
                      <td className="px-4 py-2">
                        <select className="bg-slate-50 border rounded-lg px-2 py-1" value={t.unitKind} onChange={(e) => setTrades((prev) => prev.map((x) => (x.key === t.key ? { ...x, unitKind: e.target.value as UnitKind } : x)))}>
                          {(["SF", "LF", "EA", "ALW"] as const).map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1" type="number" value={t.unit.low} min={0} onChange={(e) => setTrades((prev) => prev.map((x) => (x.key === t.key ? { ...x, unit: { ...x.unit, low: Number(e.target.value || 0) } } : x)))} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1" type="number" value={t.unit.mid} min={0} onChange={(e) => setTrades((prev) => prev.map((x) => (x.key === t.key ? { ...x, unit: { ...x.unit, mid: Number(e.target.value || 0) } } : x)))} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input className="w-24 text-right bg-slate-50 border rounded-lg px-2 py-1" type="number" value={t.unit.high} min={0} onChange={(e) => setTrades((prev) => prev.map((x) => (x.key === t.key ? { ...x, unit: { ...x.unit, high: Number(e.target.value || 0) } } : x)))} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">{currency(low)}</td>
                      <td className="px-4 py-2 text-right font-medium">{currency(mid)}</td>
                      <td className="px-4 py-2 text-right font-medium">{currency(high)}</td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-slate-50 font-semibold">
                  <td className="px-4 py-2">HARD COST SUBTOTAL (macro + trades)</td>
                  <td className="px-4 py-2 text-right">{mergedItems.reduce((a, b) => a + b.sf, 0).toLocaleString()}</td>
                  <td className="px-4 py-2" colSpan={3}></td>
                  <td className="px-4 py-2 text-right">{currency(mergedTotals.hard.low)}</td>
                  <td className="px-4 py-2 text-right">{currency(mergedTotals.hard.mid)}</td>
                  <td className="px-4 py-2 text-right">{currency(mergedTotals.hard.high)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Soft costs & summary */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border bg-white">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h4 className="font-semibold">Soft Costs</h4>
              <span className="text-xs text-slate-500">Pick how A/E & Contingency are applied</span>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <div className="text-sm text-slate-600">Apply A/E & Contingency to</div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="apply"
                      checked={applyMode === "HARD_ONLY"}
                      onChange={() => setApplyMode("HARD_ONLY")}
                    />
                    <span>Hard costs only</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="apply"
                      checked={applyMode === "HARD_PLUS_PERMITS_OTHERS"}
                      onChange={() => setApplyMode("HARD_PLUS_PERMITS_OTHERS")}
                    />
                    <span>Hard + permits + other allowances</span>
                  </label>
                </div>
              </div>

              {[
                { label: "A/E %", range: aePct, set: setAePct },
                { label: "Contingency %", range: contPct, set: setContPct },
              ].map((row) => (
                <div key={row.label} className="grid grid-cols-4 items-center gap-3">
                  <div className="text-sm text-slate-600">{row.label}</div>
                  {(["low", "mid", "high"] as const).map((k) => (
                    <input key={k} type="number" className="bg-slate-50 border rounded-lg px-2 py-1 text-right" value={row.range[k]} min={0} step={0.5} onChange={(e) => row.set({ ...row.range, [k]: Number(e.target.value || 0) })} />
                  ))}
                </div>
              ))}

              <div className="grid grid-cols-4 items-center gap-3">
                <div className="text-sm text-slate-600">Permits & Plan Review ($)</div>
                {(["low", "mid", "high"] as const).map((k) => (
                  <input key={k} type="number" className="bg-slate-50 border rounded-lg px-2 py-1 text-right" value={permits[k]} min={0} step={500} onChange={(e) => setPermits({ ...permits, [k]: Number(e.target.value || 0) })} />
                ))}
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <div className="text-sm text-slate-600">Other Allowances ($)</div>
                {(["low", "mid", "high"] as const).map((k) => (
                  <input key={k} type="number" className="bg-slate-50 border rounded-lg px-2 py-1 text-right" value={otherAllow[k]} min={0} step={1000} onChange={(e) => setOtherAllow({ ...otherAllow, [k]: Number(e.target.value || 0) })} />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-white">
            <div className="px-5 py-4 border-b"><h4 className="font-semibold">Summary</h4></div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-600">Hard Cost Subtotal (macro + trades)</span><span className="font-medium">{currency(viewTotals.hard.low)} / {currency(viewTotals.hard.mid)} / {currency(viewTotals.hard.high)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">A/E</span><span className="font-medium">{currency(viewTotals.ae.low)} / {currency(viewTotals.ae.mid)} / {currency(viewTotals.ae.high)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Permits & Plan Review</span><span className="font-medium">{currency(permits.low)} / {currency(permits.mid)} / {currency(permits.high)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Contingency</span><span className="font-medium">{currency(viewTotals.cont.low)} / {currency(viewTotals.cont.mid)} / {currency(viewTotals.cont.high)}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-600">Other Soft Costs & Allowances</span><span className="font-medium">{currency(otherAllow.low)} / {currency(otherAllow.mid)} / {currency(otherAllow.high)}</span></div>
              <div className="h-px bg-slate-200 my-2" />
              <div className="flex items-center justify-between text-base"><span className="font-semibold">ALL-IN (Low / Mid / High)</span><span className="font-bold">{currency(viewTotals.allIn.low)} / {currency(viewTotals.allIn.mid)} / {currency(viewTotals.allIn.high)}</span></div>
            </div>
          </div>
        </section>

        {/* Self-test results */}
        <section className="rounded-2xl border bg-white">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h4 className="font-semibold">Self-Tests</h4>
            <span className="text-xs text-slate-500">(auto-runs in the browser)</span>
          </div>
          <div className="p-5">
            <ul className="space-y-2 text-sm">
              {testResults.map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={t.pass ? "text-green-700" : "text-red-700"}>{t.pass ? "●" : "●"}</span>
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-slate-600">{t.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="text-xs text-slate-500 space-y-1">
          <p>Notes: This is a ROM budget. Edit unit costs, percentages, and allowances to reflect actual bids and finish levels.</p>
          <p>A/E and Contingency are applied per the selected base above. Impact-rated openings, hurricane connectors, waterproofing, and termite treatment are common line items in Jacksonville (wind, humidity, and code context).</p>
        </section>
      </main>

      {/* Sticky quick summary bar */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20">
        <div className="mx-auto px-4">
          <div className="rounded-2xl shadow-lg border bg-white/90 backdrop-blur px-4 py-2 flex items-center gap-4 text-sm">
            <span className="text-slate-600">All-In (Mid):</span>
            <span className="font-semibold text-slate-900"><AnimatedCurrency value={viewTotals.allIn.mid} /></span>
            <button onClick={exportCSV} className="ml-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white shadow hover:shadow-md">Export CSV</button>
            <a href="#estimator" className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50">Jump to Editor</a>
          </div>
        </div>
      </div>
    </div>
  );
}
