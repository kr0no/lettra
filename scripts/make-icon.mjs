// Renders Lettra's app icon with Electron and packs it into build/icon.icns.
// Run: pnpm icon   (macOS only: uses sips and iconutil)
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

const root = join(import.meta.dirname, '..')
const buildDir = join(root, 'build')
const iconset = join(buildDir, 'icon.iconset')

// macOS icon grid: 1024 canvas, 824 squircle body centred with a soft drop shadow.
const html = `<!doctype html><html><head><style>
  html,body{margin:0;width:1024px;height:1024px;background:transparent;overflow:hidden}
  .body{position:absolute;left:100px;top:92px;width:824px;height:824px;border-radius:185px;
    background:linear-gradient(180deg,#fbfaf7 0%,#efede7 100%);
    box-shadow:0 18px 36px rgba(0,0,0,.22),0 2px 6px rgba(0,0,0,.12), inset 0 0 0 1.5px rgba(0,0,0,.06);}
  .aa{position:absolute;left:0;right:0;top:150px;text-align:center;
    font-family:'New York','Iowan Old Style',Georgia,serif;font-size:430px;line-height:1;letter-spacing:-12px;color:#1d1d1f}
  .base{position:absolute;left:212px;right:212px;top:640px;height:4px;background:rgba(29,29,31,.14);border-radius:2px}
  .dot{position:absolute;left:576px;top:618px;width:48px;height:48px;border-radius:50%;background:#0a66d9}
</style></head><body><div class="body"><div class="aa">Aa</div><div class="base"></div><div class="dot"></div></div></body></html>`

app.dock?.hide()
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true, deviceScaleFactor: 1 },
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 500)) // let the serif font settle
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  const master = join(buildDir, 'icon.png')
  mkdirSync(buildDir, { recursive: true })
  writeFileSync(master, image.resize({ width: 1024, height: 1024 }).toPNG())

  rmSync(iconset, { recursive: true, force: true })
  mkdirSync(iconset)
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const px = size * scale
      const name = scale === 1 ? `icon_${size}x${size}.png` : `icon_${size}x${size}@2x.png`
      execFileSync('sips', ['-z', String(px), String(px), master, '--out', join(iconset, name)], {
        stdio: 'ignore',
      })
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', join(buildDir, 'icon.icns')])
  rmSync(iconset, { recursive: true, force: true })
  console.log('Wrote build/icon.icns and build/icon.png')
  app.quit()
})
