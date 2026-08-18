/**
 * Formats lengths in millimeters into metric (m/mm) or imperial (ft/in).
 */
export function formatLength(mm: number, unitSystem: "metric" | "imperial" = "metric"): string {
  if (unitSystem === "imperial") {
    const totalInches = mm / 25.4;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round((totalInches % 12) * 2) / 2; // round to nearest 1/2 inch
    
    let inchStr = "";
    if (inches === 0) {
      inchStr = `0"`;
    } else {
      const wholeInches = Math.floor(inches);
      const fraction = inches - wholeInches;
      const fracStr = fraction === 0.5 ? " 1/2" : "";
      inchStr = `${wholeInches}${fracStr}"`;
    }
    
    return feet > 0 ? `${feet}' ${inchStr}` : inchStr;
  } else {
    // Metric
    if (Math.abs(mm) < 1000) {
      return `${Math.round(mm)} mm`;
    } else {
      return `${(mm / 1000).toFixed(2)} m`;
    }
  }
}
