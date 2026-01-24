import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'fs'

export default defineConfig({
    plugins: [
        tailwindcss(),
        {
            name: 'dev-only-404',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req.url === '/' || req.url?.startsWith('/@') || req.url?.includes('.')) {
                        return next()
                    }
                    try {
                        res.statusCode = 404
                        res.setHeader('Content-Type', 'text/html')
                        res.end(readFileSync('public/404.html', 'utf-8'))
                    } catch (err) {
                        next()
                    }
                })
            }
        }
    ]
})