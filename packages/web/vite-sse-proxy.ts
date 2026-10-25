import type { ProxyOptions } from 'vite';

/** Vite binds downstream-close cleanup after upstream headers; SSE may abort earlier. */
export const closeAbortedSseProxy: NonNullable<ProxyOptions['configure']> = proxy => {
  proxy.on('proxyReq', (upstream, request, response) => {
    if (request.url?.split('?', 1)[0] !== '/api/events/stream') return;
    response.once('close', () => upstream.destroy());
    if (response.destroyed) upstream.destroy();
  });
};
