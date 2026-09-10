/*
 * Client-side monetization gates (v1, localStorage; real accounts later).
 * Weekly free limit applies ONLY to role-specific grading. generic audits
 * stay free so there's never a dead end.
 */
export function isProUser(): boolean {
  try {
    return localStorage.getItem("portfoliograded:pro") === "1";
  } catch {
    return false;
  }
}

/** Consumes one weekly role-run if available. Returns false when out. */
export function takeRoleRun(): boolean {
  try {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const raw = localStorage.getItem("pg:role-runs");
    const data = raw ? (JSON.parse(raw) as { start: number; count: number }) : { start: now, count: 0 };
    if (now - data.start > week) {
      data.start = now;
      data.count = 0;
    }
    if (data.count >= 1) return false;
    data.count += 1;
    localStorage.setItem("pg:role-runs", JSON.stringify(data));
    return true;
  } catch {
    return true;
  }
}
