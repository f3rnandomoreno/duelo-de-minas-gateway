import http from 'node:http';
import httpProxy from 'http-proxy';

const DEFAULT_TARGET = 'https://duelo-de-minas-online.fernandomorenoruiz.workers.dev';

export function createGatewayServer(options = {}) {
  const target = options.target || process.env.BACKEND_ORIGIN || DEFAULT_TARGET;
  const targetUrl = new URL(target);
  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new Error('BACKEND_ORIGIN must use http or https');
  }

  const proxy = httpProxy.createProxyServer({
    target: targetUrl.origin,
    changeOrigin: true,
    ws: true,
    secure: true,
    xfwd: true,
  });

  proxy.on('proxyReq', proxyRequest => {
    proxyRequest.setHeader('X-Duelo-Gateway', 'render');
  });

  proxy.on('proxyReqWs', proxyRequest => {
    proxyRequest.setHeader('X-Duelo-Gateway', 'render');
  });

  const server = http.createServer((request, response) => {
    proxy.web(request, response);
  });

  server.on('upgrade', (request, socket, head) => {
    proxy.ws(request, socket, head);
  });

  proxy.on('error', (error, request, responseOrSocket) => {
    const message = JSON.stringify({ error: 'backend_unavailable' });
    if (responseOrSocket && typeof responseOrSocket.writeHead === 'function') {
      const origin = request.headers.origin || 'https://duelodeminas.es';
      responseOrSocket.writeHead(502, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': origin,
        'Content-Length': Buffer.byteLength(message),
      });
      responseOrSocket.end(message);
      return;
    }
    responseOrSocket?.destroy(error);
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 10000);
  createGatewayServer().listen(port, '0.0.0.0', () => {
    console.log(`Duelo de Minas gateway listening on ${port}`);
  });
}
