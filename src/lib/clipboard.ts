/**
 * Copy text to clipboard with fallback for iOS Safari, HTTP contexts,
 * and old browsers where navigator.clipboard is unavailable.
 *
 * Returns true on success, false on failure.
 * Never throws — caller can rely on the return value.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern path: navigator.clipboard requires HTTPS + user gesture
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  // Legacy fallback: hidden textarea + execCommand('copy')
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
