// Headless smoke test: load the built game, drive the real game loop, and
// report runtime errors + DOM state. Verifies the app actually runs (not just
// compiles). Run: node smoke.mjs
import { chromium } from 'playwright'

const URL = process.env.URL || 'http://localhost:4191/'
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
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.overlay', { timeout: 10000 })
  report.menuLoaded = true
  await page.screenshot({ path: shot('1-menu') })

  // add a player: Add Player -> name -> Next -> avatar builder -> Create Player
  await page.getByText('Add Player').click()
  await page.locator('.input').first().fill('Tester')
  await page.getByRole('button', { name: /next/i }).first().click()
  await page.getByRole('button', { name: /create player/i }).first().click({ timeout: 15000 })
  await page.waitForSelector('.levelList', { timeout: 8000 })
  report.setupReached = true
  await page.screenshot({ path: shot('2-setup') })

  // verify the level creator opens + renders, then close it
  try {
    await page.getByText('Create a Level').click()
    await page.waitForSelector('.noteGrid', { timeout: 5000 })
    await page.screenshot({ path: shot('2b-creator') })
    report.creatorOpened = true
    await page.getByRole('button', { name: /cancel/i }).click()
    await page.waitForSelector('.levelList', { timeout: 5000 })
  } catch (e) {
    report.creatorError = String(e)
  }

  // optional theme selection (THEME_INDEX: 0=mountain 1=SF 2=desert 3=candy 4=space)
  const themeIdx = process.env.THEME_INDEX != null ? parseInt(process.env.THEME_INDEX, 10) : null
  if (themeIdx != null) {
    const tiles = page.locator('.themeTile')
    if ((await tiles.count()) > themeIdx) await tiles.nth(themeIdx).click()
    await page.waitForTimeout(300)
  }
  const suffix = themeIdx != null ? `-t${themeIdx}` : ''

  // start the race
  await page.getByRole('button', { name: 'Start Race' }).click()
  await page.waitForSelector('.countdown', { timeout: 8000 }).catch(() => {})
  report.countdownSeen = (await page.locator('.countdown').count()) > 0
  // countdown → playing: the HUD note card should appear
  try {
    await page.waitForSelector('.noteCard', { timeout: 20000 })
    report.playingReached = true
  } catch {
    report.playingReached = false
    report.domState = await page.evaluate(() => ({
      countdown: !!document.querySelector('.countdown'),
      hud: !!document.querySelector('.hud'),
      noteCard: !!document.querySelector('.noteCard'),
      overlay: !!document.querySelector('.overlay'),
      bodyText: document.body.innerText.slice(0, 200),
    }))
    await page.screenshot({ path: shot('fail-playing') })
    throw new Error('noteCard never appeared; domState=' + JSON.stringify(report.domState))
  }

  // sample the HUD over time to prove the game loop advances (score/hearts change)
  const samples = []
  for (let i = 0; i < 16; i++) {
    const txt = await page.locator('.hudStats').textContent().catch(() => '')
    samples.push((txt || '').replace(/\s+/g, ' ').trim())
    if (i === 6) await page.keyboard.down('ArrowLeft')
    if (i === 9) {
      await page.keyboard.up('ArrowLeft')
      await page.keyboard.down('ArrowRight')
    }
    await page.waitForTimeout(500)
  }
  await page.keyboard.up('ArrowRight')
  report.hudSamples = samples
  report.hudChanged = new Set(samples).size > 1
  await page.screenshot({ path: shot('3-playing' + suffix) })

  // canvas present + sized
  report.canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    return c ? { w: c.width, h: c.height } : null
  })
} catch (e) {
  report.fatal = String(e)
}

report.pageErrors = pageErrors
report.consoleErrors = consoleErrors
console.log('SMOKE_RESULT ' + JSON.stringify(report, null, 2))
await browser.close()
process.exit(pageErrors.length || report.fatal ? 1 : 0)
