/**
 * Read IFC project length units → metres conversion.
 * Follows IfcProject.UnitsInContext → IfcUnitAssignment → LENGTHUNIT.
 */

import * as WebIFC from "web-ifc";

const SI_PREFIX_TO_METRES: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
};

function unwrap(value: unknown): unknown {
  if (value != null && typeof value === "object" && "value" in value) {
    return (value as { value: unknown }).value;
  }
  return value;
}

function asEnumToken(value: unknown): string {
  const v = unwrap(value);
  if (v == null) return "";
  return String(v).replace(/^\./, "").replace(/\.$/, "").toUpperCase();
}

function asNumber(value: unknown): number | null {
  const v = unwrap(value);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asRefId(value: unknown): number | null {
  const v = unwrap(value);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

function siUnitToMetres(line: {
  Name?: unknown;
  Prefix?: unknown;
}): number | null {
  const name = asEnumToken(line.Name);
  if (name !== "METRE" && name !== "METER") return null;
  const prefix = asEnumToken(line.Prefix);
  if (!prefix) return 1;
  return SI_PREFIX_TO_METRES[prefix] ?? 1;
}

/**
 * Returns the factor that converts file length values → metres.
 * Examples: MILLI+METRE → 0.001, METRE → 1, INCH via conversion → 0.0254.
 * Defaults to 1 (metres) when undeclared.
 */
export function readLengthUnitToMetres(
  api: WebIFC.IfcAPI,
  modelID: number,
): { metresPerFileUnit: number; label: string } {
  try {
    const idsVec = api.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    const projectIds: number[] = [];
    for (let i = 0; i < idsVec.size(); i++) projectIds.push(idsVec.get(i));
    for (const pid of projectIds) {
      const project = api.GetLine(modelID, pid);
      const unitsRef = asRefId(project?.UnitsInContext);
      if (unitsRef == null) continue;
      const assignment = api.GetLine(modelID, unitsRef);
      const unitsRaw = assignment?.Units;
      const unitList: unknown[] = Array.isArray(unitsRaw)
        ? unitsRaw
        : unitsRaw
          ? [unitsRaw]
          : [];

      for (const u of unitList) {
        const uid = asRefId(u);
        if (uid == null) continue;
        const unit = api.GetLine(modelID, uid);
        const unitType = asEnumToken(unit?.UnitType);
        if (unitType && unitType !== "LENGTHUNIT") continue;

        // IfcSIUnit
        const si = siUnitToMetres(unit);
        if (si != null) {
          const prefix = asEnumToken(unit.Prefix);
          return {
            metresPerFileUnit: si,
            label: prefix ? `${prefix.toLowerCase()}metre` : "metre",
          };
        }

        // IfcConversionBasedUnit → ConversionFactor (IfcMeasureWithUnit)
        const convRef = asRefId(unit?.ConversionFactor);
        if (convRef != null) {
          const measure = api.GetLine(modelID, convRef);
          const value = asNumber(measure?.ValueComponent);
          const baseRef = asRefId(measure?.UnitComponent);
          let base = 0.001; // common Revit: conversion relative to mm
          if (baseRef != null) {
            const baseUnit = api.GetLine(modelID, baseRef);
            const baseSi = siUnitToMetres(baseUnit);
            if (baseSi != null) base = baseSi;
          }
          if (value != null && value > 0) {
            return {
              metresPerFileUnit: value * base,
              label: String(unwrap(unit?.Name) ?? "conversion"),
            };
          }
        }
      }
    }
  } catch {
    /* fall through */
  }
  return { metresPerFileUnit: 1, label: "metre (default)" };
}

/** Convert a raw IFC length property (file units) to metres. */
export function fileLengthToMetres(
  value: number,
  metresPerFileUnit: number,
): number {
  return value * metresPerFileUnit;
}
