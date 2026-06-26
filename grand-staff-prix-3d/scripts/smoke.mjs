// Self-contained headless smoke test: serves the built `dist/` from an in-process
// Node static server (no separate `vite preview` needed), drives the real game
// loop in headless Chromium, and reports runtime errors + DOM state.
//
// Run: npm run smoke  (assumes `npm run build` has produced dist/)
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist')
const PORT = Number(process.env.PORT || 4191)
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
}

// Tiny static server with SPA fallback to index.html.
const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    let filePath = normalize(join(DIST, urlPath === '/' ? 'index.html' : urlPath))
    if (!filePath.startsWith(DIST)) {
      res.writeHead(403).end()
      return
    }
    let body
    try {
      body = await readFile(filePath)
    } catch {
      filePath = join(DIST, 'index.html') // SPA fallback
      body = await readFile(filePath)
    }
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' })
    res.end(body)
  } catch (e) {
    res.writeHead(500).end(String(e))
  }
})

await new Promise((r) => server.listen(PORT, r))
const appUrl = `http://localhost:${PORT}/`
const shot = (p) => `/tmp/gsp3d-${p}.png`

const pageErrors = []
const consoleErrors = []

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
  ],
})
const page = await browser.newPage({ viewport: { width: 430, height: 760 } })
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

const report = {}
// ── HARD gate: the app must boot to the menu with no runtime errors. ──
try {
  await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 })
  // dismiss the opening splash (tap to enter the menu); force past its fade animation
  const splash = page.locator('.splashStart')
  if (await splash.count()) await splash.click({ force: true }).catch(() => {})
  await page.waitForSelector('.overlay', { timeout: 10000 })
  report.menuLoaded = true
  await page.screenshot({ path: shot('1-menu') })
} catch (e) {
  report.fatal = String(e)
}

// ── BEST-EFFORT: drive a real race so the game loop is exercised. UI-selector
// drift here is reported, not fatal — the hard gate above is boot + no errors. ──
if (report.menuLoaded) {
  try {
    // add a player: Add Player -> name -> "Next: pick your ride" -> garage -> "Let's Race"
    await page.getByText('Add Player').click()
    await page.locator('.input').first().fill('Tester')
    await page.getByRole('button', { name: /next/i }).first().click()
    await page.getByRole('button', { name: /let.?s race/i }).first().click({ timeout: 15000 })
    await page.waitForSelector('.levelList', { timeout: 8000 })
    report.setupReached = true
    await page.screenshot({ path: shot('2-setup') })

    // optional theme select (0=mountain 1=SF 2=desert 3=candy 4=space)
    const themeIdx = process.env.THEME_INDEX != null ? parseInt(process.env.THEME_INDEX, 10) : null
    if (themeIdx != null) {
      const tiles = page.locator('.themeTile')
      if ((await tiles.count()) > themeIdx) await tiles.nth(themeIdx).click()
      report.themeSelected = themeIdx
      await page.waitForTimeout(300)
    }

    await page.getByRole('button', { name: 'Start Race' }).click()
    await page.waitForSelector('.countdown', { timeout: 8000 }).catch(() => {})
    report.countdownSeen = (await page.locator('.countdown').count()) > 0
    await page.waitForSelector('.noteCard', { timeout: 20000 })
    report.playingReached = true

    // sample the HUD over time to prove the loop advances; steer to hit gates.
    const samples = []
    for (let i = 0; i < 36; i++) {
      const txt = await page.locator('.hudStats').textContent().catch(() => '')
      samples.push((txt || '').replace(/\s+/g, ' ').trim())
      if (i === 8) await page.keyboard.down('ArrowLeft')
      if (i === 14) {
        await page.keyboard.up('ArrowLeft')
        await page.keyboard.down('ArrowRight')
      }
      if (i === 20) await page.keyboard.up('ArrowRight')
      await page.waitForTimeout(500)
    }
    await page.keyboard.up('ArrowRight')
    report.hudSamples = samples
    report.hudChanged = new Set(samples).size > 1
    await page.screenshot({ path: shot('3-playing') })
    report.canvas = await page.evaluate(() => {
      const c = document.querySelector('canvas')
      return c ? { w: c.width, h: c.height } : null
    })
  } catch (e) {
    report.flowStalled = String(e).split('\n')[0]
    report.domState = await page
      .evaluate(() => ({
        overlay: !!document.querySelector('.overlay'),
        levelList: !!document.querySelector('.levelList'),
        countdown: !!document.querySelector('.countdown'),
        noteCard: !!document.querySelector('.noteCard'),
        bodyText: document.body.innerText.slice(0, 160),
      }))
      .catch(() => null)
  }
}

report.pageErrors = pageErrors
report.consoleErrors = consoleErrors
console.log('SMOKE_RESULT ' + JSON.stringify(report, null, 2))
await browser.close()
server.close()
// Fail only on a hard boot failure or a real runtime error — not on UI-flow drift.
process.exit(report.fatal || !report.menuLoaded || pageErrors.length ? 1 : 0)
