import express from 'express';

import routes from './routes'
import { requestLogger, csp } from './middlewares'
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const apiProxy = createProxyMiddleware('/api/test', {
  target: 'https://api.studio.thegraph.com',
  pathRewrite: {
    // 地址重写
    "/api/test": "/"
  },
  changeOrigin: true,
});


app.set('trust proxy', true)

app
  .disable('x-powered-by')
  .use(express.static(process.env.RAZZLE_PUBLIC_DIR))
  .use(require('cors')())
  .use(requestLogger)
  .use(csp)
  .use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('X-Frame-Options', 'DENY')
    res.set('Referrer-Policy', 'same-origin')
    next()
  })

app.use(apiProxy);

app.get('/ping', (req, res, next) => {
  res.send('ok')
  next()
});

routes(app)

export default app;
