"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { money } from "@/lib/vat";

type Props = {
  profit: number;
  target: number;
  /** One line under the readout. */
  message?: string;
  size?: "large" | "small";
};

const CONFETTI_COLOURS = ["#2FE0C2", "#ffffff", "#1FBFA4", "#F5B841", "#E9FCF8"];

/**
 * The monthly profit runway: teal fills left to right as profit accrues, the
 * plane taxis along the fill line, shakes from 75%, lifts off from 92% and is
 * airborne (with confetti and a vapour trail) at 100%.
 */
export function Runway({ profit, target, message, size = "large" }: Props) {
  const pct = target > 0 ? Math.max(0, (profit / target) * 100) : 0;
  const fill = Math.min(pct, 100);

  // Start empty and fill on mount, so the plane visibly taxis to its spot.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(fill), 80);
    return () => clearTimeout(t);
  }, [fill]);

  const large = size === "large";
  const airborne = pct >= 100;
  const shaking = pct >= 75 && pct < 92;
  const lift = pct >= 92 ? Math.min((pct - 92) / 8, 1) : 0; // 0 → 1 across 92–100%

  const planeSize = large ? 34 : 22;
  const climb = lift * (large ? 26 : 14);
  const angle = lift * 22;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`font-extrabold tabular-nums tracking-tight ${large ? "text-3xl" : "text-xl"}`}>
          {money(profit)} <span className="text-navy/40">/ {money(target)}</span>
        </p>
        <p className={`font-bold tabular-nums ${airborne ? "text-mint-600" : "text-navy/60"}`}>
          {Math.round(pct)}%
        </p>
      </div>
      {message && <p className="mt-1 text-sm text-navy/70">{message}</p>}

      <div className={`relative ${large ? "mt-16" : "mt-10"}`}>
        {/* Plane */}
        <div
          className="pointer-events-none absolute z-10 transition-[left] duration-[1400ms] ease-out"
          style={{
            left: `${shown}%`,
            // Rests on the runway's top edge (h-12 / h-6), so it reads against white.
            bottom: large ? 46 : 22,
            transform: `translateX(-60%) translateY(${-climb}px) rotate(${-angle}deg)`,
          }}
        >
          {airborne && (
            <span
              className="runway-trail absolute right-full top-1/2 block h-1.5 -translate-y-1/2 rounded-full"
              style={{ width: large ? 160 : 80 }}
            />
          )}
          <span className={`block ${shaking ? "runway-shake" : ""}`}>
            <Plane
              className="text-navy drop-shadow"
              style={{ width: planeSize, height: planeSize, transform: "rotate(45deg)" }}
              fill="#2FE0C2"
              strokeWidth={1.5}
            />
          </span>
          {airborne && shown >= 100 && (
            <span className="absolute left-1/2 top-1/2">
              {Array.from({ length: 18 }, (_, i) => (
                <span
                  key={i}
                  className="runway-confetti absolute block h-1.5 w-1.5 rounded-sm"
                  style={
                    {
                      backgroundColor: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
                      "--x": `${Math.cos((i / 18) * Math.PI * 2) * (40 + (i % 3) * 18)}px`,
                      "--y": `${Math.sin((i / 18) * Math.PI * 2) * (30 + (i % 4) * 10) - 10}px`,
                      animationDelay: `${(i % 6) * 40}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </span>
          )}
        </div>

        {/* Runway */}
        <div
          className={`relative overflow-hidden rounded-md bg-navy ${large ? "h-12" : "h-6"}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill)}
          aria-label="Monthly profit against target"
        >
          <div
            className="absolute inset-y-0 left-0 bg-mint transition-[width] duration-[1400ms] ease-out"
            style={{ width: `${shown}%` }}
          />
          {/* Centre line */}
          <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.55)_0_18px,transparent_18px_34px)]" />
          {/* Threshold markings at the far end */}
          <div className="absolute inset-y-1 right-2 flex gap-0.5">
            {Array.from({ length: large ? 5 : 3 }, (_, i) => (
              <span key={i} className="w-0.5 bg-white/50" />
            ))}
          </div>
        </div>
        {large && (
          <div className="relative mt-1.5 h-4 text-[11px] font-semibold uppercase tracking-wide text-navy/40">
            <span className="absolute left-0">Taxi</span>
            <span className="absolute left-[75%] -translate-x-1/2">Rotate</span>
            <span className="absolute right-0">Takeoff</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** One small bar per month for the 12-month history. */
export function MiniRunway({
  label,
  profit,
  target,
}: {
  label: string;
  profit: number;
  target: number;
}) {
  const pct = target > 0 ? Math.max(0, (profit / target) * 100) : 0;
  const hit = pct >= 100;
  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3 text-sm">
      <span className="font-semibold">{label}</span>
      <div className="h-3 overflow-hidden rounded-sm bg-navy/10">
        <div
          className="h-full rounded-sm"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: hit ? "#2FE0C2" : "#F5B841" }}
        />
      </div>
      <span className="w-40 text-right tabular-nums text-navy/70">
        <span className={`font-bold ${hit ? "text-mint-600" : "text-amber-600"}`}>{Math.round(pct)}%</span> ·{" "}
        {money(profit)}
      </span>
    </div>
  );
}
