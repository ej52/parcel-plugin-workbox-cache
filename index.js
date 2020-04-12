const { generateSWString } = require('workbox-build')
const Terser = require( 'terser' )

const { readFile, writeFileSync } = require('fs')
const logger = require('@parcel/logger')
const path = require('path')

function transform(code, minify) {
  if (!minify) {
    return code
  }

  const minified = Terser.minify(code)
  if (minified.error) {
    throw Error(minified.error)
  }

  return minified.code
}

module.exports = bundle => {
  bundle.on('buildEnd', async () => {
    const dest = path.resolve(bundle.options.outDir)
    // Get parcel asset
    const mainAsset =
      bundle.mainAsset ||
      bundle.mainBundle.entryAsset ||
      bundle.mainBundle.childBundles.values().next().value.entryAsset
    // Get config else use default
    const config = Object.assign({
      importScripts: ['./worker.js'],
      globDirectory: bundle.options.outDir,
      globPatterns: [`**/*.{css,html,js,gif,ico,jpg,png,svg,webp,woff,woff2,ttf,otf}`]
    }, (await mainAsset.getConfig(['.workbox-config.js', 'workbox-config.js'], { packageKey: 'workbox' })) || {})

    const noInject = config.noInject || false;
    delete config.noInject;

    logger.log('🛠️  Workbox')
    // Copy importScripts
    const scripts = config.importScripts.map(async script => {
      readFile(index, 'utf8', (error, data) => {
        if (error) {
          logger.error(error)
          return
        }

        const file = /[^\/]+$/.exec(script)[0]
        const dest = path.join(dest, file)

        writeFileSync(dest, transform(data, bundle.options.minify))
        logger.success(`Imported ${script} to ${dest}`)

        return file
      })
      
    })
    // Generate service worker
    const swString = await generateSWString({
      ...config,
      importScripts: [
        'https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js',
        ...scripts
      ]
    }).catch(error => logger.error(error));
    logger.success('Service worker generated');
    // Write service worker file
    writeFileSync(path.join(dest, 'sw.js'), transform(swString, bundle.options.minify))
    logger.success(`Service worker written to ${dest}/sw.js`)
    // Inject the service worker registration
    if (!noInject) {
      const index = path.join(dest, 'index.html')
      readFile(index, 'utf8', (error, data) => {
        if (error) {
          logger.error(error)
          return
        }

        let registration = `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js');
          });
        }
        `

        if (bundle.options.minify) {
          registration = `<script>${transform(registration, true)}</script></body>`
        } else {
          registration = `
            <script>
            ${registration}
            </script>
          </body>
          `
        }

        data = data.replace('</body>', registration)
        writeFileSync(index, data)
        logger.success(`Service worker injected into ${dest}/index.html`)
      });
    }
  })
}
