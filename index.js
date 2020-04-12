const { injectManifest } = require('workbox-build')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')
const logger = require('@parcel/logger')

const swTag = `<script>if ('serviceWorker' in navigator) window.addEventListener('load', function() {navigator.serviceWorker.register('/sw.js')})</script>`

module.exports = bundler => {
  bundler.on('buildEnd', async () => {
    logger.log('🛠️  Workbox')

    let config = Object.assign({
      globDirectory: path.resolve(bundler.options.outDir),
      globPatterns: [`**/*.{css,html,js,gif,ico,jpg,png,svg,webp,woff,woff2,ttf,otf}`]
    }, (await bundler.mainBundle.entryAsset.getConfig(
      [".workbox-config.js", "workbox-config.js"],
      { packageKey: "workbox" }
    )) || {}, {
      swDest: path.resolve(bundler.options.outDir, 'sw.js')
    })

    try {
      const { count } = await injectManifest(config)
      logger.success(`Generated sw.js, which will precache ${count} files.`)

      const index = path.resolve(bundler.options.outDir, 'index.html')
      const data = readFileSync(index, 'utf8')

      if (!data.includes('serviceWorker.register')) {
        data = data.replace('</body>', swTag + '</body>')
        writeFileSync(index, data)
        logger.success(`Service worker injected into index.html.`)
      }
    } catch (error) {
      logger.error(error.message)
    }
  })
}
