/* Bound API requests, including response bodies, so a dropped connection can
   release loading controls. Writes are never retried automatically. */
(function () {
  'use strict';
  async function timedFetch(input, options = {}, timeout = 15000) {
    const controller = new AbortController();
    const signal = options.signal || input?.signal;
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    let expired = false;
    const timer = setTimeout(() => { expired = true; controller.abort(); }, timeout);
    try {
      const response = await fetch(input, { ...options, signal: controller.signal });
      const body = await response.arrayBuffer();
      return new Response([204,205,304].includes(response.status) ? null : body,
        { status: response.status, statusText: response.statusText, headers: response.headers });
    } catch (error) {
      if (expired) throw new Error('The connection timed out. Check your internet connection and try again.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  window.HNFNetwork = { fetch: timedFetch };
})();
