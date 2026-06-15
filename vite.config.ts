import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'url';

export default defineConfig({
    base: '/pixia-skia-test/',
    server: {
        port: 3000,
    },
    resolve: {
        alias: {
            skia: fileURLToPath(new URL('libs/skia', import.meta.url)),
        },
    },
    assetsInclude: ['**/*.wasm'],
    build: {
        outDir: 'dist',
        commonjsOptions: {
            defaultIsModuleExports: true,
        },
    },
    plugins: [
        {
            name: 'configure-response-headers',
            configureServer(server) {
                server.middlewares.use((_req, res, next) => {
                    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
                    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
                    next();
                });
            },
        },
    ],
    publicDir: 'public',
});
