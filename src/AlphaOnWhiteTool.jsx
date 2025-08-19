import React, { useMemo, useState } from "react";

// Utility: clamp
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Utility: hex -> {r,g,b}
function hexToRgb(hex) {
  let h = hex.trim();
  if (h.startsWith("#")) h = h.slice(1);
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return { r, g, b };
  }
  if (h.length === 6) {
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbToHex(r, g, b) {
  const toHex = (n) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Given target color T over white, and chosen alpha a, solve foreground F such that
// composite(T) = a*F + (1-a)*White -> F = (T - (1-a)*White)/a
function solveForegroundForWhite(target, alpha) {
  const w = 255;
  const solve = (c) => (c - (1 - alpha) * w) / alpha;
  const r = clamp(Math.round(solve(target.r)), 0, 255);
  const g = clamp(Math.round(solve(target.g)), 0, 255);
  const b = clamp(Math.round(solve(target.b)), 0, 255);
  return { r, g, b };
}

// Small checkerboard background for showing transparency
const CheckerBG = ({ className }) => (
  <div
    className={className}
    style={{
      backgroundImage:
        "linear-gradient(45deg, #bbb 25%, transparent 25%)," +
        "linear-gradient(-45deg, #bbb 25%, transparent 25%)," +
        "linear-gradient(45deg, transparent 75%, #bbb 75%)," +
        "linear-gradient(-45deg, transparent 75%, #bbb 75%)",
      backgroundSize: "16px 16px",
      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
    }}
  />
);

const Label = ({ children }) => (
  <div className="text-sm text-gray-600 mb-1">{children}</div>
);

export default function AlphaOnWhiteTool() {
  const [hex, setHex] = useState("#D3E9FF");
  const [alpha, setAlpha] = useState(0.5);

  const rgb = useMemo(() => hexToRgb(hex) ?? { r: 211, g: 233, b: 255 }, [hex]);

  // Minimum alpha so that F stays within [0,255] for all channels: a_min = max(1 - T_c)
  const alphaMin = useMemo(() => {
    const rMin = 1 - rgb.r / 255;
    const gMin = 1 - rgb.g / 255;
    const bMin = 1 - rgb.b / 255;
    return clamp(Math.max(rMin, gMin, bMin), 0, 1);
  }, [rgb]);

  // If user drags alpha below feasible minimum (e.g., after changing color), bump it up
  const a = Math.max(alpha, alphaMin);

  const fg = useMemo(() => solveForegroundForWhite(rgb, a), [rgb, a]);
  const fgHex = rgbToHex(fg.r, fg.g, fg.b);

  const rgbaCss = `rgba(${fg.r}, ${fg.g}, ${fg.b}, ${a.toFixed(4)})`;
  const targetCss = rgbToHex(rgb.r, rgb.g, rgb.b);

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Colour → Transparent-on-White Solver</h1>
          <a
            href="https://en.wikipedia.org/wiki/Alpha_compositing"
            className="text-sm underline opacity-70 hover:opacity-100"
            target="_blank" rel="noreferrer"
          >How it works</a>
        </header>

        {/* Inputs */}
        <div className="grid md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl shadow-sm">
          <div>
            <Label>Target colour (solid)</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={targetCss}
                onChange={(e) => setHex(e.target.value)}
                className="w-10 h-10 rounded border"
              />
              <input
                type="text"
                value={hex.toUpperCase()}
                onChange={(e) => setHex(e.target.value)}
                className="flex-1 px-3 py-2 rounded border focus:outline-none focus:ring"
                placeholder="#RRGGBB"
              />
            </div>
            <div className="text-xs mt-1 opacity-70">e.g., #D3E9FF</div>
          </div>

          <div>
            <Label>Alpha (transparency)</Label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={a}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs mt-1">
              <span>min feasible: {(alphaMin * 100).toFixed(1)}%</span>
              <span>α = {(a * 100).toFixed(1)}%</span>
            </div>
          </div>

          <div>
            <Label>Foreground solution (over white)</Label>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="p-2 rounded border bg-gray-50 text-center">R {fg.r}</div>
              <div className="p-2 rounded border bg-gray-50 text-center">G {fg.g}</div>
              <div className="p-2 rounded border bg-gray-50 text-center">B {fg.b}</div>
            </div>
            <div className="mt-2 text-sm font-mono">{fgHex} @ α={a.toFixed(4)}</div>
            <div className="mt-1 text-xs opacity-70">CSS: <span className="font-mono">{rgbaCss}</span></div>
          </div>
        </div>

        {/* Previews */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Column 1: original on white, original on dark */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="text-lg font-semibold text-gray-700 mb-1">Original colour (solid)</div>
              <div className="text-base text-gray-600 mb-2">Light mode</div>
              {/* Light mode box */}
              <div className="relative w-full rounded-2xl overflow-hidden  border border-gray-300" style={{ height: 180 }}>
                <div className="absolute inset-0" style={{ backgroundColor: targetCss }} />
              </div>
            </div>
            {/* Dark mode panel */}
            <div className="p-4"  style={{ backgroundColor: '#18191B' }}>
                <div className="pb-3 text-white text-base">Dark mode</div>
                  <div className="relative w-full rounded-2xl overflow-hidden borderborder-gray-400" style={{ height: 180 }}>
                    <div className="absolute inset-0" style={{ backgroundColor: targetCss }} />
                  </div>
            </div>
          </div>

          {/* Column 2: computed on white (split), computed on dark (split) */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="text-lg font-semibold text-gray-700 mb-1">Computed colour</div>
              <div className="text-base text-gray-600 mb-2">Light mode</div>
              {/* Light mode box with right-half checkerboard */}
              <div className="relative w-full rounded-2xl overflow-hidden border border-gray-300" style={{ height: 180 }}>
                {/* base white */}
                <div className="absolute inset-0 bg-white" />
                {/* right-half checkerboard */}
                <div className="absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
                  <CheckerBG className="w-full h-full" />
                </div>
                {/* rgba overlay */}
                <div className="absolute inset-0" style={{ backgroundColor: rgbaCss }} />
              </div>
            </div>

            {/* Dark mode panel */}
            <div className="p-4 "  style={{ backgroundColor: '#18191B' }}  >
                <div className="pb-3 text-white text-base">Dark mode</div>
                  <div className="relative w-full rounded-2xl overflow-hidden border border-gray-400" style={{ height: 180 }}>
                    {/* base dark */}
                    <div className="absolute inset-0" style={{ backgroundColor: '#18191B' }} />
                    {/* right-half checkerboard */}
                    <div className="absolute inset-0" style={{ clipPath: 'inset(0 0 0 50%)' }}>
                      <CheckerBG className="w-full h-full" />
                    </div>
                    {/* rgba overlay */}
                    <div className="absolute inset-0" style={{ backgroundColor: rgbaCss }} />
                  </div>
              </div>
            </div>
        </div>

        {/* Notes */}
        <div className="text-sm text-gray-600 bg-white p-4 rounded-2xl shadow-sm leading-relaxed">
          <p className="mb-1 font-medium">Notes</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>There is a minimum alpha for any target colour on white: <span className="font-mono">α<sub>min</sub> = max(1 − R/255, 1 − G/255, 1 − B/255)</span>. The slider won't go below that, otherwise the solved foreground would fall outside RGB bounds.</li>
            <li>The solver uses straight alpha compositing in sRGB space: <span className="font-mono">F = (T − (1−α)·White) / α</span>.</li>
            <li>Works best for targets lighter than or equal to white (which is everything). If you try to match colours darker than white (i.e., all of them), you'll see α<sub>min</sub> increase accordingly.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
