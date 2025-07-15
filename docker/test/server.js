const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Serve static files
app.use(express.static('/app/static'));

// Proxy API requests
app.use('/api', createProxyMiddleware({ 
  target: process.env.API_TARGET,
  changeOrigin: true
}));

app.listen(5175, () => {
  console.log(`Server running on http://localhost:5175`);
});
