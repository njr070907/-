import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.resolve(scriptDir, '..', 'frontend', 'dist-offline')
const sourcePath = path.join(buildDir, 'index.html')
const outputPath = path.join(buildDir, 'xiaoshiqing-offline.html')

let html = await readFile(sourcePath, 'utf8')

for (const match of [...html.matchAll(/<link rel="stylesheet" crossorigin href="([^"]+)">/g)]) {
  const css = await readFile(path.join(buildDir, match[1].replace(/^\//, '')), 'utf8')
  html = html.replace(match[0], () => `<style>${css}</style>`)
}

for (const match of [...html.matchAll(/<script type="module" crossorigin src="([^"]+)"><\/script>/g)]) {
  const javascript = (await readFile(path.join(buildDir, match[1].replace(/^\//, '')), 'utf8')).replaceAll('</script', '<\\/script')
  html = html.replace(match[0], () => `<script type="module">${javascript}</script>`)
}

const faviconMatch = html.match(/<link rel="icon" href="([^"]+)" type="image\/svg\+xml" \/>/)
if (faviconMatch) {
  const svg = await readFile(path.join(buildDir, faviconMatch[1].replace(/^\//, '')), 'utf8')
  const dataUri = `data:image/svg+xml,${encodeURIComponent(svg)}`
  html = html.replace(faviconMatch[0], `<link rel="icon" href="${dataUri}" type="image/svg+xml" />`)
}

html = html.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-title" content="校事清" />',
)

await writeFile(outputPath, html, 'utf8')
console.log(`Created ${outputPath}`)
