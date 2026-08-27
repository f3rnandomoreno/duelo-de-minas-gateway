# Render gateway

Gateway HTTP/WebSocket para redes que bloquean o interceptan los dominios de
Cloudflare. Render recibe las conexiones públicas y las reenvía al Worker
`duelo-de-minas-online`, que conserva toda la lógica y el estado en Durable
Objects.

## Render

- Runtime: Node
- Build command: `npm --prefix render-gateway ci`
- Start command: `npm --prefix render-gateway start`
- Optional environment variable: `BACKEND_ORIGIN`

El valor por defecto apunta al Worker de producción.
