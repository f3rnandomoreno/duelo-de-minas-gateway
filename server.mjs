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
    selfHandleResponse: true,
  });

  proxy.on('proxyReq', proxyRequest => {
    proxyRequest.setHeader('X-Duelo-Gateway', 'render');
    proxyRequest.setHeader('Accept-Encoding', 'identity');
  });

  proxy.on('proxyReqWs', proxyRequest => {
    proxyRequest.setHeader('X-Duelo-Gateway', 'render');
  });

  proxy.on('proxyRes', (proxyResponse, request, response) => {
    const chunks = [];
    proxyResponse.on('data', chunk => chunks.push(chunk));
    proxyResponse.on('end', () => {
      let body = Buffer.concat(chunks);
      const contentType = String(proxyResponse.headers['content-type'] || '');
      if (contentType.includes('application/json')) {
        try {
          const data = JSON.parse(body.toString('utf8'));
          if (data && typeof data.wsUrl === 'string') {
            const forwardedProtocol = String(request.headers['x-forwarded-proto'] || 'https')
              .split(',')[0].trim();
            const host = String(request.headers['x-forwarded-host'] || request.headers.host)
              .split(',')[0].trim();
            const wsUrl = new URL(data.wsUrl);
            wsUrl.protocol = forwardedProtocol === 'http' ? 'ws:' : 'wss:';
            wsUrl.host = host;
            data.wsUrl = wsUrl.toString();
            body = Buffer.from(JSON.stringify(data));
          }
        } catch {
          // Preserve a non-JSON upstream response even if its header is wrong.
        }
      }

      const headers = { ...proxyResponse.headers };
      delete headers.connection;
      delete headers['content-length'];
      delete headers['transfer-encoding'];
      headers['content-length'] = String(body.length);
      response.writeHead(proxyResponse.statusCode || 502, headers);
      response.end(body);
    });
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
