import {defineConfig} from 'vite';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve('.', 'index.html'),
        telemetry: path.resolve('.', 'telemetry.html')
      }
    }
  },
  plugins: [
    {
      name: 'serve-examples',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/examples/')) {
            const cleanUrl = req.url.split('?')[0];
            const file = path.resolve('.', '.' + cleanUrl);
            if (fs.existsSync(file) && fs.statSync(file).isFile()) {
              res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'text/plain');
              return fs.createReadStream(file).pipe(res);
            }
          }
          next();
        });
      }
    }
  ]
});
