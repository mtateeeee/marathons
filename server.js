const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Local fallback handler if offline or upstream is unreachable
function serveLocalAjaxFallback(query, res) {
  const action = query.action || '';
  const dataDir = path.join(ROOT, 'data');

  try {
    if (action === 'jp_bxh_live') {
      const liveFile = path.join(dataDir, 'live.json');
      if (fs.existsSync(liveFile)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(fs.readFileSync(liveFile));
      }
    } else if (action === 'jp_bxh_nhom') {
      const ev = (query.event || 'trail').toLowerCase();
      const nhomFile = path.join(dataDir, `nhom_${ev}.json`);
      if (fs.existsSync(nhomFile)) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(fs.readFileSync(nhomFile));
      }
    } else if (action === 'jp_bxh_list') {
      const ev = (query.event || 'fmm').toLowerCase();
      const listFile = path.join(dataDir, `list_${ev}.json`);
      if (fs.existsSync(listFile)) {
        const parsed = JSON.parse(fs.readFileSync(listFile, 'utf8'));
        let rows = Array.isArray(parsed.data) ? parsed.data : [];
        if (query.nhom) {
          rows = rows.filter(r => r.ultra && (r.ultra.ma_nhom === query.nhom || r.ultra.nhom === query.nhom));
        }
        if (query.q) {
          const q = String(query.q).trim().toLowerCase();
          rows = rows.filter(r =>
            String(r.full_name || '').toLowerCase().includes(q) ||
            String(r.vbm_id || '').toLowerCase().includes(q) ||
            String((r.club && r.club.name) || '').toLowerCase().includes(q)
          );
        }
        const page = Math.max(1, parseInt(query.page, 10) || 1);
        const perPage = Math.max(1, parseInt(query.per_page, 10) || 15);
        const slice = rows.slice((page - 1) * perPage, page * perPage);
        const out = Object.assign({}, parsed, {
          data: slice,
          count: slice.length,
          page: page,
          per_page: perPage,
          total: (!query.q && !query.nhom && parsed.total) ? parsed.total : rows.length,
          total_pages: Math.max(1, Math.ceil(rows.length / perPage))
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        return res.end(JSON.stringify(out));
      }
    }
  } catch (err) {
    // Fall through
  }

  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ data: [] }));
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname || '/');

  // 1. Live CORS Proxy for /wp-admin/admin-ajax.php -> https://bestmarathon.vn/wp-admin/admin-ajax.php
  if (pathname === '/wp-admin/admin-ajax.php') {
    const targetUrl = 'https://bestmarathon.vn' + req.url;
    const proxyReq = https.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://bestmarathon.vn/',
        'Accept': 'application/json, text/javascript, */*; q=0.01'
      },
      timeout: 8000
    }, (proxyRes) => {
      let body = [];
      proxyRes.on('data', chunk => body.push(chunk));
      proxyRes.on('end', () => {
        const buf = Buffer.concat(body);
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(buf);
      });
    });

    proxyReq.on('error', () => {
      serveLocalAjaxFallback(parsedUrl.query, res);
    });
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      serveLocalAjaxFallback(parsedUrl.query, res);
    });
    return;
  }

  // 2. SPA Category Routes (/bang-xep-hang-*/ or /bang-vang/) -> serve index.html
  if (/^\/bang-xep-hang-[a-z0-9-]+\/?$/i.test(pathname) || /^\/bang-vang\/?$/i.test(pathname)) {
    const indexPath = path.join(ROOT, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(indexPath).pipe(res);
  }

  // 3. Static files
  let filePath = path.join(ROOT, pathname);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Fallback to index.html for any other route so navigation never 404s
  const indexFallback = path.join(ROOT, 'index.html');
  if (fs.existsSync(indexFallback)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(indexFallback).pipe(res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`VBM Marathon Leaderboard Server running at http://localhost:${PORT}`);
});
