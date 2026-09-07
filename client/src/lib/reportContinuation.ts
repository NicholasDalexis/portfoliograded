/** Account access to one saved report. This helper never starts a new review. */
export class ReportContinuationError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ReportContinuationError";
  }
}

type Dependencies = {
  currentUid: () => string | null;
  getHeaders: () => Promise<Record<string, string>>;
  request: typeof fetch;
};

export async function continueSavedReport<
  T extends { id: string; report: unknown },
>(
  {
    reportId,
    accountUid,
    canClaimGuestReport,
    signal,
  }: {
    reportId: string;
    accountUid: string;
    canClaimGuestReport: boolean;
    signal: AbortSignal;
  },
  dependencies: Dependencies
): Promise<T> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) {
    throw new ReportContinuationError(
      "invalid_report",
      "This report link could not be opened. Your saved reports are still available."
    );
  }
  const assertCurrent = () => {
    if (signal.aborted)
      throw new DOMException("Access was canceled", "AbortError");
    if (dependencies.currentUid() !== accountUid) {
      throw new ReportContinuationError(
        "account_changed",
        "Your account changed. Try again with the account you want to use for this report."
      );
    }
  };
  const headers = async () => {
    assertCurrent();
    const value = await dependencies.getHeaders();
    assertCurrent();
    if (!/^Bearer\s+\S+$/i.test(value.Authorization ?? "")) {
      throw new ReportContinuationError(
        "sign_in_required",
        "Google sign-in could not be verified. Please try again."
      );
    }
    return value;
  };
  const read = async () => {
    const authHeaders = await headers();
    assertCurrent();
    const response = await dependencies.request(
      `/api/audits/${encodeURIComponent(reportId)}`,
      {
        headers: authHeaders,
        credentials: "same-origin",
        signal,
      }
    );
    assertCurrent();
    return response;
  };
  let response = await read();
  // A normal account-owned report needs no claim. Only an explicit guest
  // continuation may try the server's capability-verified transfer on 404.
  if (response.status === 404 && canClaimGuestReport) {
    const authHeaders = await headers();
    assertCurrent();
    const claim = await dependencies.request("/api/report-claims", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      credentials: "same-origin",
      body: JSON.stringify({ reportId }),
      signal,
    });
    assertCurrent();
    if (!claim.ok) {
      const failure = (await claim.json().catch(() => ({}))) as {
        error?: unknown;
      };
      assertCurrent();
      if (claim.status === 403 && failure.error === "google_account_required")
        throw new ReportContinuationError(
          "google_account_required",
          "Continue with a verified Google account to open this feedback."
        );
      if (claim.status === 401)
        throw new ReportContinuationError(
          "sign_in_required",
          "Google sign-in could not be verified. Please try again."
        );
      if (claim.status === 503)
        throw new ReportContinuationError(
          "temporarily_unavailable",
          "We could not connect this report right now. Your review is saved. Try again shortly."
        );
      throw new ReportContinuationError(
        "claim_unavailable",
        "This report could not be connected to this account. Open it in the browser or account where you created it."
      );
    }
    const claimed = (await claim.json()) as { reportId?: unknown };
    assertCurrent();
    if (claimed.reportId !== reportId)
      throw new ReportContinuationError(
        "invalid_claim",
        "This report could not be confirmed. Your saved reports are still available."
      );
    response = await read();
  }
  if (!response.ok) {
    if (response.status === 401)
      throw new ReportContinuationError(
        "sign_in_required",
        "Google sign-in could not be verified. Please try again."
      );
    throw new ReportContinuationError(
      "report_unavailable",
      "This report could not be opened with this account. Your saved reports are still available."
    );
  }
  const result = (await response.json()) as T;
  assertCurrent();
  if (
    result.id !== reportId ||
    !result.report ||
    typeof result.report !== "object"
  ) {
    throw new ReportContinuationError(
      "invalid_report",
      "The saved report could not be confirmed. Please try again."
    );
  }
  return result;
}

export function reportSignInMessage(error: unknown): string {
  if (error instanceof ReportContinuationError) return error.message;
  const code = (error as { code?: string })?.code;
  if (code === "auth/popup-blocked")
    return "Your browser blocked the Google window. Allow pop-ups for this site, then try again.";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  )
    return "Google sign-in was closed. Your report is still here when you are ready.";
  return "We could not finish opening your feedback. Your report is saved. Please try again.";
}
