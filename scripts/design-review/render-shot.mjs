// render-shot.mjs — capture a hydrated screenshot of a route for design-review evidence.
//
// Reusable primitive for the design-fix-from-review (Stage 2) visual gate. It REUSES an
// already-running dev server (Next 16 holds a single-dev lock) and writes one PNG per
// viewport plus a sidecar JSON (console errors, error-overlay flag, body length) so a
// multimodal reviewer can judge the rendered page against DESIGN.md / hifi.png.
//
// MUST be run from the repo root (pnpm non-flat node_modules; `playwright` won't resolve
// from %TEMP%).  Inputs via env vars:
//   RS_ROUTE      (required) e.g. "/terms"
//   RS_ORIGIN     default "http://localhost:3000" (use http://127.0.0.1:3000 for authed pages,
//                 to match the storageState cookie domain)
//   RS_VIEWPORTS  csv widths, default "1280" (e.g. "360,768,1280")
//   RS_OUT        output dir (created if missing), default "./.design-review-shots"
//   RS_LABEL      file prefix, default a slug of RS_ROUTE
//   RS_STORAGE    optional path to a Playwright storageState JSON (authed pages)
//   RS_WAIT       extra settle ms after load, default "800"
//
// Exit 0 = at least one shot captured; non-zero = could not reach the server / no shots.
// READ-ONLY w.r.t. the app: it only navigates and screenshots. It writes PNG/JSON to RS_OUT.

import { chromium } from 'playwright'
import { mkdir, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROUTE = process.env.RS_ROUTE
const ORIGIN = process.env.RS_ORIGIN || 'http://localhost:3000'
const VIEWPORTS = (process.env.RS_VIEWPORTS || '1280').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
const OUT = process.env.RS_OUT || './.design-review-shots'
const STORAGE = process.env.RS_STORAGE || ''
const WAIT = parseInt(process.env.RS_WAIT || '800', 10)
const LABEL = process.env.RS_LABEL || (ROUTE || 'page').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page'

if (!ROUTE) {
  console.error('RS_ROUTE is required (e.g. RS_ROUTE=/terms)')
  process.exit(2)
}

async function fileExists(p) {
  try { await stat(p); return true } catch { return false }
}

async function main() {
  await mkdir(OUT, { recursive: true })

  // Reuse running server: a quick reachability probe before launching a browser.
  try {
    const res = await fetch(ORIGIN + ROUTE, { redirect: 'manual' }).catch((e) => { throw e })
    // 200/307/308 all acceptable (307 -> auth redirect; caller decides). Connection refused throws.
    console.log(`reachability ${ORIGIN}${ROUTE} -> HTTP ${res.status}`)
  } catch (e) {
    console.error(`Cannot reach ${ORIGIN} — is the dev server running on it? (${e.message})`)
    console.error('Start one from the repo root with `pnpm dev` (reuse the existing one if present).')
    process.exit(3)
  }

  let storageState
  if (STORAGE) {
    if (await fileExists(STORAGE)) storageState = STORAGE
    else console.warn(`RS_STORAGE not found at ${STORAGE} — rendering UNAUTHENTICATED (authed routes will 307 to /login)`)
  }

  const browser = await chromium.launch({ headless: true })
  const results = []
  let captured = 0
  try {
    for (const width of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        storageState,
        // deterministic, reduce-motion to match the design intent and stabilize shots
        reducedMotion: 'reduce',
      })
      const page = await context.newPage()
      const consoleErrors = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)) })
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 300)))

      let status = 0
      let finalUrl = ''
      try {
        const resp = await page.goto(ORIGIN + ROUTE, { waitUntil: 'networkidle', timeout: 15000 })
        status = resp ? resp.status() : 0
      } catch (e) {
        consoleErrors.push('goto: ' + String(e.message).slice(0, 200))
      }
      await page.waitForTimeout(WAIT)
      finalUrl = page.url()

      // hydration / render-health heuristics.
      // NOTE: <nextjs-portal> is ALWAYS present in Next dev (the dev indicator) — do NOT
      // treat it as an error. Only the actual error DIALOG / error text counts.
      const errorOverlay = await page.evaluate(() => {
        if (document.querySelector('[data-nextjs-dialog], #nextjs__container_errors')) return true
        const t = (document.body && document.body.innerText) || ''
        return /Unhandled Runtime Error|Build Error|Failed to compile|Application error: a (client|server)-side exception/i.test(t)
      }).catch(() => false)
      const bodyTextLen = await page.evaluate(() => (document.body && document.body.innerText ? document.body.innerText.length : 0)).catch(() => 0)
      const redirectedToLogin = /\/login(\?|$)/.test(finalUrl)

      const png = path.join(OUT, `${LABEL}-${width}.png`)
      await page.screenshot({ path: png, fullPage: true }).catch((e) => consoleErrors.push('screenshot: ' + e.message))
      captured += 1
      results.push({ viewport: width, status, finalUrl, redirectedToLogin, errorOverlay, consoleErrorCount: consoleErrors.length, consoleErrors: consoleErrors.slice(0, 10), bodyTextLen, png })
      await context.close()
      console.log(`shot ${LABEL}-${width}.png  status=${status} errorOverlay=${errorOverlay} bodyLen=${bodyTextLen} consoleErr=${consoleErrors.length}${redirectedToLogin ? ' [REDIRECTED-TO-LOGIN]' : ''}`)
    }
  } finally {
    await browser.close()
  }

  const manifest = {
    route: ROUTE, origin: ORIGIN, label: LABEL, storageState: storageState || null,
    capturedAt: process.env.RS_STAMP || null, shots: results,
  }
  const manifestPath = path.join(OUT, `${LABEL}.json`)
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  console.log(`manifest ${manifestPath}`)
  if (!captured) process.exit(4)
}

main().catch((e) => { console.error('render-shot failed:', e); process.exit(1) })
