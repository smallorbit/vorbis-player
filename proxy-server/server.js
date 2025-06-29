#!/usr/bin/env node

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://127.0.0.1:3000', 'http://localhost:3000'],
  credentials: true
}));

// Middleware to parse JSON
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'vorbis-player-proxy',
    timestamp: new Date().toISOString()
  });
});

// YouTube search proxy endpoint
app.get('/youtube/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing query parameter "q"' 
      });
    }

    console.log(`[${new Date().toISOString()}] YouTube search request:`, query);
    
    const encodedQuery = encodeURIComponent(query);
    const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}`;
    
    // Simulate browser headers
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    console.log(`[${new Date().toISOString()}] Fetching:`, searchUrl);
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers,
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube responded with status:`, response.status);
      return res.status(response.status).json({
        error: `YouTube API returned ${response.status}: ${response.statusText}`
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube`);
      return res.status(502).json({
        error: 'Empty response from YouTube'
      });
    }

    console.log(`[${new Date().toISOString()}] Success! Response length:`, html.length);
    
    // Return the raw HTML
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
    });
    
    res.send(html);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Proxy error:`, error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return res.status(502).json({
        error: 'Network error - unable to reach YouTube',
        details: error.message
      });
    }
    
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'Request timeout - YouTube took too long to respond',
        details: error.message
      });
    }
    
    res.status(500).json({
      error: 'Internal proxy error',
      details: error.message
    });
  }
});

// Generic proxy endpoint for other requests if needed
app.get('/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        error: 'Missing url parameter' 
      });
    }

    console.log(`[${new Date().toISOString()}] Generic proxy request:`, url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Target server returned ${response.status}: ${response.statusText}`
      });
    }

    const content = await response.text();
    
    res.set({
      'Content-Type': response.headers.get('content-type') || 'text/plain',
      'Cache-Control': 'public, max-age=300'
    });
    
    res.send(content);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Generic proxy error:`, error.message);
    res.status(500).json({
      error: 'Proxy error',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Unhandled error:`, error);
  res.status(500).json({
    error: 'Internal server error',
    details: error.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      'GET /health',
      'GET /youtube/search?q=<query>',
      'GET /proxy?url=<url>'
    ]
  });
});

// Start server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 Vorbis Player Proxy Server running on http://127.0.0.1:${PORT}`);
  console.log(`📺 YouTube search endpoint: http://127.0.0.1:${PORT}/youtube/search?q=<query>`);
  console.log(`🏥 Health check: http://127.0.0.1:${PORT}/health`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down proxy server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down proxy server...');
  process.exit(0);
});