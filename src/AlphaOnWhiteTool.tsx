import React, { useMemo, useState, useEffect } from "react";

// Utility: clamp
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Utility: hex -> {r,g,b}
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
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

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Given target color T over white, and chosen alpha a, solve foreground F such that
// composite(T) = a*F + (1-a)*White -> F = (T - (1-a)*White)/a
function solveForegroundForWhite(target: { r: number; g: number; b: number }, alpha: number) {
  const w = 255;
  const solve = (c: number) => (c - (1 - alpha) * w) / alpha;
  const r = clamp(Math.round(solve(target.r)), 0, 255);
  const g = clamp(Math.round(solve(target.g)), 0, 255);
  const b = clamp(Math.round(solve(target.b)), 0, 255);
  return { r, g, b };
}

// --- Perceptual contrast (ΔE in CIE Lab) ---
function rgbToXyz({ r, g, b }: { r: number; g: number; b: number }) {
  // convert sRGB to [0,1]
  let sr = r / 255, sg = g / 255, sb = b / 255;
  const compand = (u: number) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
  sr = compand(sr); sg = compand(sg); sb = compand(sb);
  // matrix D65
  const x = sr * 0.4124 + sg * 0.3576 + sb * 0.1805;
  const y = sr * 0.2126 + sg * 0.7152 + sb * 0.0722;
  const z = sr * 0.0193 + sg * 0.1192 + sb * 0.9505;
  return { x: x * 100, y: y * 100, z: z * 100 };
}
function xyzToLab({ x, y, z }: { x: number; y: number; z: number }) {
  // D65 reference
  const xr = x / 95.047, yr = y / 100, zr = z / 108.883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(xr), fy = f(yr), fz = f(zr);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}
function deltaE(lab1: { L: number; a: number; b: number }, lab2: { L: number; a: number; b: number }) {
  const dL = lab1.L - lab2.L, da = lab1.a - lab2.a, db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
function perceptualContrast(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  const labF = xyzToLab(rgbToXyz(fg));
  const labB = xyzToLab(rgbToXyz(bg));
  return deltaE(labF, labB);
}

// --- WCAG contrast (reference only) ---
const srgbToLinearWCAG = (c: number) => {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
};
const relativeLuminance = (rgb: { r: number; g: number; b: number }) => {
  const R = srgbToLinearWCAG(rgb.r);
  const G = srgbToLinearWCAG(rgb.g);
  const B = srgbToLinearWCAG(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const contrastRatio = (fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) => {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [Lmax, Lmin] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (Lmax + 0.05) / (Lmin + 0.05);
};

// Composite in sRGB (browser style)
const compositeOver = (fg: { r: number; g: number; b: number }, a: number, bg: { r: number; g: number; b: number }) => ({
  r: clamp(Math.round(a * fg.r + (1 - a) * bg.r), 0, 255),
  g: clamp(Math.round(a * fg.g + (1 - a) * bg.g), 0, 255),
  b: clamp(Math.round(a * fg.b + (1 - a) * bg.b), 0, 255),
});

// Find alpha so that perceptual contrast (ΔE) vs WHITE is preserved when shown on `bg`.
const findAlphaForPerceptualContrastOnBg = (
  target: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  alphaMin: number,
  iterations = 40
) => {
  const WHITE = { r: 255, g: 255, b: 255 };
  const goal = perceptualContrast(target, WHITE);
  const err = (a: number) => {
    const F = solveForegroundForWhite(target, a); // exact on WHITE
    const C = compositeOver(F, a, bg);            // appearance on bg
    return Math.abs(perceptualContrast(C, bg) - goal);
  };
  if (1 - alphaMin < 1e-6) return alphaMin;
  // golden-section search on [alphaMin, 1]
  let lo = alphaMin, hi = 1;
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - phi * (hi - lo);
  let x2 = lo + phi * (hi - lo);
  let f1 = err(x1), f2 = err(x2);
  for (let i = 0; i < iterations; i++) {
    if (f1 > f2) { lo = x1; x1 = x2; f1 = f2; x2 = lo + phi * (hi - lo); f2 = err(x2); }
    else { hi = x2; x2 = x1; f2 = f1; x1 = hi - phi * (hi - lo); f1 = err(x1); }
  }
  return (lo + hi) / 2;
};

// Small checkerboard background for showing transparency
const CheckerBG: React.FC<{ className?: string }> = ({ className }) => (
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

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm text-gray-600 mb-1">{children}</div>
);

export default function AlphaOnWhiteTool() {
  const [hex, setHex] = useState("#D3E9FF");
  const [alpha, setAlpha] = useState(0.5);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

  // Copy to clipboard function with toast
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ show: true, message: `${type} copied to clipboard!` });
      
      // Hide toast after 2 seconds
      setTimeout(() => {
        setToast({ show: false, message: '' });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setToast({ show: true, message: 'Failed to copy to clipboard' });
      
      // Hide error toast after 3 seconds
      setTimeout(() => {
        setToast({ show: false, message: '' });
      }, 3000);
    }
  };

  const WHITE = { r: 255, g: 255, b: 255 };
  const DARK = { r: 24, g: 25, b: 27 };

  const rgb = useMemo(() => hexToRgb(hex) ?? { r: 211, g: 233, b: 255 }, [hex]);

  // Minimum feasible alpha so F stays within [0,255]
  const alphaMin = useMemo(() => {
    const rMin = 1 - rgb.r / 255;
    const gMin = 1 - rgb.g / 255;
    const bMin = 1 - rgb.b / 255;
    return clamp(Math.max(rMin, gMin, bMin), 0, 1);
  }, [rgb]);

  const a = Math.max(alpha, alphaMin);
  const fg = useMemo(() => solveForegroundForWhite(rgb, a), [rgb, a]);
  const compOnWhite = useMemo(() => compositeOver(fg, a, WHITE), [fg, a]);
  const compOnDark = useMemo(() => compositeOver(fg, a, DARK), [fg, a]);

  // Perceptual contrast (primary)
  const pTargetWhite = useMemo(() => perceptualContrast(rgb, WHITE), [rgb]);
  const pTargetDark = useMemo(() => perceptualContrast(rgb, DARK), [rgb]);
  const pCompWhite = useMemo(() => perceptualContrast(compOnWhite, WHITE), [compOnWhite]);
  const pCompDark = useMemo(() => perceptualContrast(compOnDark, DARK), [compOnDark]);

  // WCAG (reference)
  const wTargetWhite = useMemo(() => contrastRatio(rgb, WHITE), [rgb]);
  const wTargetDark = useMemo(() => contrastRatio(rgb, DARK), [rgb]);
  const wCompWhite = useMemo(() => contrastRatio(compOnWhite, WHITE), [compOnWhite]);
  const wCompDark = useMemo(() => contrastRatio(compOnDark, DARK), [compOnDark]);

  // Suggested alpha that preserves *perceptual* contrast on dark
  const alphaMatchDark = useMemo(() => findAlphaForPerceptualContrastOnBg(rgb, DARK, alphaMin), [rgb, alphaMin]);

  // Auto-apply the suggested alpha whenever the colour changes
  useEffect(() => {
    setAlpha(alphaMatchDark);
  }, [hex, alphaMatchDark]);

  const fgHex = rgbToHex(fg.r, fg.g, fg.b);
  const rgbaCss = `rgba(${fg.r}, ${fg.g}, ${fg.b}, ${a.toFixed(4)})`;
  const targetCss = rgbToHex(rgb.r, rgb.g, rgb.b);

  const formatCR = (v: number) => `${v.toFixed(2)}:1`;
  const formatPC = (v: number) => `${v.toFixed(1)} ΔE`;

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 p-6">
      <div className="max-w-5xl mx-auto grid gap-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Colour → Transparent-on-White Solver</h1>
          <span className="text-sm opacity-70">Perceptual ΔE (primary). WCAG shown for reference.</span>
        </header>

        {/* Inputs and Outputs Side by Side */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Inputs Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Inputs</div>            
            {/* Target colour */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Original colour</h2>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={targetCss} 
                  onChange={(e) => setHex(e.target.value)} 
                  className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-300 transition-colors" 
                />
                <input 
                  type="text" 
                  value={hex.toUpperCase()} 
                  onChange={(e) => setHex(e.target.value)} 
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-colors font-mono"
                  placeholder="#RRGGBB"
                />
              </div>
            </div>
          </div>

          {/* Outputs Section */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
            <div className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-4">Outputs</div>
            <div className="space-y-6">
              {/* Transparency Control */}
              <div>
                <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tweak the transparency</h2>
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg border-2 border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors text-xs font-medium"
                    onClick={() => setAlpha(alphaMatchDark)}
                    title="Use suggested alpha that preserves perceptual contrast on dark backgrounds"
                  >
                    Use suggested α
                  </button>
                </div>
                <div className="space-y-2">
                  <input 
                    type="range" 
                    min={0} 
                    max={1} 
                    step={0.001} 
                    value={a} 
                    onChange={(e) => setAlpha(parseFloat(e.target.value))} 
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-center">
                    <span className="text-lg font-semibold">α = {(a * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Foreground solution */}
              <div className="bg-white p-4 rounded-xl border">
                <Label>Foreground solution</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="font-mono text-sm font-semibold">{fgHex}</div>
                    <button
                      onClick={() => copyToClipboard(fgHex, 'HEX')}
                      className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium"
                    >
                      Copy HEX
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="font-mono text-xs">{rgbaCss}</div>
                    <button
                      onClick={() => copyToClipboard(rgbaCss, 'RGBA')}
                      className="px-3 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors font-medium"
                    >
                      Copy RGBA
                    </button>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>

        {/* Previews Section */}
        <div>
          <div className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Previews</div>
          <div className="grid md:grid-cols-2 gap-6">
                          {/* Light mode column */}
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Light mode</h3>
                </div>
                <div className="p-4">
                  <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200" style={{ height: 120 }}>
                    {/* base white */}
                    <div className="absolute inset-0 bg-white" />
                    {/* right-half checkerboard */}
                    <div className="absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
                      <CheckerBG className="w-full h-full" />
                    </div>
                    {/* rgba overlay */}
                    <div className="absolute inset-0" style={{ backgroundColor: rgbaCss }} />
                  </div>
                  
                  {/* Light mode contrast results */}
                  <div className="mt-4 pt-4 space-y-2">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Perceptual ΔE (primary)</div>
                      <div className="text-sm font-mono">{formatPC(pCompWhite)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-500 mb-1">WCAG ratio (reference)</div>
                      <div className="text-sm font-mono opacity-70">{formatCR(wCompWhite)}</div>
                    </div>
                  </div>
                </div>
              </div>
            {/* Dark mode column */}
            <div className="bg-gray-900 rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 border-b border-gray-600">
                <h3 className="text-lg font-semibold text-white">Dark mode</h3>
              </div>
              <div className="p-4">
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-600" style={{ height: 120 }}>
                  {/* base dark */}
                  <div className="absolute inset-0 bg-gray-900" />
                  {/* right-half checkerboard */}
                  <div className="absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
                    <CheckerBG className="w-full h-full" />
                  </div>
                  {/* rgba overlay */}
                  <div className="absolute inset-0" style={{ backgroundColor: rgbaCss }} />
                </div>
                
                {/* Dark mode contrast results */}
                <div className="mt-4 pt-4 space-y-2">
                  <div>
                    <div className="text-sm font-medium text-white mb-1">Perceptual ΔE (primary)</div>
                    <div className="text-sm font-mono text-gray-300">{formatPC(pCompDark)}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-400 mb-1">WCAG ratio (reference)</div>
                    <div className="text-sm font-mono text-gray-400 opacity-70">{formatCR(wCompDark)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toast notification */}
        {toast.show && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 max-w-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm text-gray-900">{toast.message}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
