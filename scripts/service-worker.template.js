/* Generated with a build-specific allowlist. Never cache auth, cloud history,
   POSTs, photos or arbitrary URLs. BUILD is inserted by prepare-offline.mjs. */
/* global BUILD */
const CACHE = 'think-offline-' + BUILD.version
const READY = '/__think_offline_ready__'
const ALLOWED = new Set(BUILD.assets.map(a => a.url))
const BRAIN = new Set(BUILD.brain)
let preparing
self.addEventListener('install', () => { /* Updates activate after old tabs close. */ })
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))
const tell = data => self.clients.matchAll().then(clients => clients.forEach(client => client.postMessage(data)))
async function state() {
  const cache = await caches.open(CACHE)
  const ready = !!await cache.match(READY) && (await Promise.all(BUILD.assets.map(a => cache.match(a.url)))).every(Boolean)
  return { type: 'offline-state', ready, preparing: !!preparing && !ready, version: BUILD.version, total: BUILD.assets.reduce((s, a) => s + a.bytes, 0) }
}
async function prepare(controller) {
  const cache = await caches.open(CACHE)
  await cache.delete(READY)
  const total = BUILD.assets.reduce((s, a) => s + a.bytes, 0)
  let loaded = 0
  const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('')
  // Some static hosts send Content-Encoding:gzip for the precompressed OCR
  // language file. Fetch then supplies decoded bytes: verify that exact known
  // representation too, without weakening integrity for other assets.
  const matches = async (bytes, asset) => { const digest = await hash(bytes); return bytes.byteLength === asset.bytes && digest === asset.sha256 || bytes.byteLength === asset.decodedBytes && digest === asset.decodedSha256 }
  for (const asset of BUILD.assets) {
    controller.signal.throwIfAborted()
    const previous = await cache.match(asset.url)
    if (previous && await matches(await previous.clone().arrayBuffer(), asset)) { loaded += asset.bytes; await tell({ type: 'offline-progress', loaded, total }); continue }
    const response = await fetch(asset.url, { signal: controller.signal, cache: 'reload' })
    if (!response.ok) throw new Error('An offline file is unavailable. Reconnect and try again.')
    const bytes = await response.clone().arrayBuffer()
    if (!await matches(bytes, asset)) throw new Error('Offline file verification failed (' + asset.url + '). Retry after the deployment finishes.')
    await cache.put(asset.url, response)
    loaded += asset.bytes; await tell({ type: 'offline-progress', loaded, total })
  }
  await cache.put(READY, new Response(BUILD.version))
  await tell(await state())
}
self.addEventListener('message', event => {
  if (event.data?.type === 'offline-status') event.waitUntil(state().then(result => event.ports[0]?.postMessage(result)))
  if (event.data?.type === 'offline-prepare' && !preparing) {
    const controller = new AbortController(); preparing = controller
    const timer = setTimeout(() => controller.abort(), 600000)
    event.waitUntil(prepare(controller).catch(error => tell({ type: 'offline-error', message: controller.signal.aborted ? 'Download stopped. Existing saved discoveries are unchanged. Retry to reuse downloaded files.' : error.name === 'QuotaExceededError' ? 'Not enough browser storage for offline files. Free space, then retry. Device saves have not been removed.' : error.message })).finally(() => { clearTimeout(timer); preparing = undefined }))
  }
  if (event.data?.type === 'offline-cancel') preparing?.abort()
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try { return await fetch(event.request, { signal: AbortSignal.timeout(3000) }) }
      catch {
        const cache = await caches.open(CACHE)
        const home = url.pathname === '/' || url.pathname === '/index.html'
        const stored = await cache.match(home ? '/index.html' : '/404.html')
        if (!stored) return new Response('Think-a-ling is not prepared for offline use yet. Reconnect, open the app and choose Prepare for offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } })
        return home ? stored : new Response(stored.body, { status: 404, headers: stored.headers })
      }
    })()); return
  }
  if (!url.search && ALLOWED.has(url.pathname)) event.respondWith(caches.open(CACHE).then(async cache => await cache.match(url.pathname) || fetch(event.request)))
  else if (!url.search && BRAIN.has(url.pathname)) event.respondWith((async () => {
    for (const name of await caches.keys()) if (name.startsWith('think-browser-ai-')) {
      const hit = await (await caches.open(name)).match(url.href)
      if (hit) return hit
    }
    return fetch(event.request)
  })())
})
