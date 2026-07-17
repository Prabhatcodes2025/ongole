import type { AreaUnit } from "@/src/types/property";

export const SQUARE_FEET_PER_UNIT: Record<AreaUnit, number> = {
  gadi: 9,
  sq_ft: 1,
  sq_yd: 9,
  sq_m: 10.763910416709722,
  acre: 43560,
  cent: 435.6,
  gunta: 1089,
  hectare: 107639.104167,
};

export const AREA_UNIT_LABELS: Record<AreaUnit, string> = {
  gadi: "Gadi",
  sq_ft: "sq.ft",
  sq_yd: "sq.yd",
  sq_m: "sq.m",
  acre: "acres",
  cent: "cents",
  gunta: "guntas",
  hectare: "hectares",
};

function round(value: number, places = 4) {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function convertArea(value: number, from: AreaUnit, to: AreaUnit) {
  if (!Number.isFinite(value) || value < 0) throw new Error("Area must be a non-negative finite number.");
  return round((value * SQUARE_FEET_PER_UNIT[from]) / SQUARE_FEET_PER_UNIT[to]);
}

export function areaEquivalents(value: number, unit: AreaUnit) {
  return (Object.keys(SQUARE_FEET_PER_UNIT) as AreaUnit[]).filter((target) => target !== unit).map((target) => ({ unit: target, value: convertArea(value, unit, target) }));
}

export function formatArea(value: number, unit: AreaUnit, maximumFractionDigits = 2) {
  return `${new Intl.NumberFormat("en-IN", { maximumFractionDigits }).format(value)} ${AREA_UNIT_LABELS[unit]}`;
}
