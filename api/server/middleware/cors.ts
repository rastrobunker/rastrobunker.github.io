// CORS: el frontend (index.html estatico) se sirve desde otro origen que la API.
export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-code',
  })
  if (event.node.req.method === 'OPTIONS') {
    event.node.res.statusCode = 204
    event.node.res.end()
  }
})
