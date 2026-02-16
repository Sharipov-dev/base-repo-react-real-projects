export class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BackendError';
  }

  static async fromResponse(response: Response): Promise<BackendError> {
    let details: unknown;
    try {
      details = await response.json();
    } catch {
      details = await response.text().catch(() => null);
    }

    const message =
      typeof details === 'object' && details !== null && 'message' in details
        ? String((details as { message: string }).message)
        : `Backend error: ${response.status}`;

    return new BackendError(response.status, message, details);
  }
}
