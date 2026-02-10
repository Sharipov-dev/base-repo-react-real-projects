/**
 * Creates an AbortController with an optional timeout.
 * Returns the signal and a cancel function.
 */
export function createCancelToken(timeoutMs?: number) {
  const controller = new AbortController();

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  if (timeoutMs) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  const cancel = () => {
    controller.abort();
    if (timeoutId) clearTimeout(timeoutId);
  };

  return { signal: controller.signal, cancel };
}
