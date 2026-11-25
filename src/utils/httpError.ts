const DEFAULT_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "VALIDATION_ERROR",
  429: "TOO_MANY_REQUESTS",
  503: "SERVICE_UNAVAILABLE",
};

/** Error dengan kode status HTTP agar mudah diterjemahkan oleh error handler. */
export class HttpError extends Error {
  /** Kode mesin yang stabil (mis. "VALIDATION_ERROR") untuk dibaca klien. */
  public readonly code: string;
  /** Rincian tambahan, mis. daftar field yang gagal validasi. */
  public readonly details?: unknown;

  constructor(
    public readonly status: number,
    message: string,
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "HttpError";
    this.code = options.code ?? DEFAULT_CODES[status] ?? "ERROR";
    this.details = options.details;
  }
}
