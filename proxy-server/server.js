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

// Test actual YouTube embed endpoint for embedding restrictions
app.get('/youtube/embed-test/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Missing video ID parameter' 
      });
    }

    console.log(`[${new Date().toISOString()}] Testing YouTube embed for:`, videoId);
    
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    
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

    console.log(`[${new Date().toISOString()}] Fetching embed page:`, embedUrl);
    
    const response = await fetch(embedUrl, {
      method: 'GET',
      headers,
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube embed responded with status:`, response.status);
      return res.json({
        videoId,
        isEmbeddable: false,
        reason: `Embed endpoint returned ${response.status}`,
        metadata: {},
        timestamp: new Date().toISOString()
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube embed`);
      return res.json({
        videoId,
        isEmbeddable: false,
        reason: 'Empty response from embed endpoint',
        metadata: {},
        timestamp: new Date().toISOString()
      });
    }

    // Check for specific error patterns in embed page
    const hasVideoUnavailable = html.includes('Video unavailable') ||
                               html.includes('This video is unavailable') ||
                               html.includes('Video nicht verfügbar') ||
                               html.includes('Vídeo no disponible');
    
    const hasEmbedDisabled = html.includes('Watch this video on YouTube') ||
                            html.includes('embedded videos') ||
                            html.includes('embedding has been disabled');
    
    const hasContentRestriction = html.includes('not available in your country') ||
                                 html.includes('copyright') ||
                                 html.includes('blocked in your country');
    
    const hasAgeRestriction = html.includes('age-restricted') ||
                             html.includes('Sign in to confirm your age');
    
    const hasPrivacyRestriction = html.includes('private video') ||
                                 html.includes('This video is private');
    
    // Look for player error messages
    const hasPlayerError = html.includes('"status":"UNPLAYABLE"') ||
                          html.includes('"reason":"') ||
                          html.includes('errorMessage');
    
    const isEmbeddable = !hasVideoUnavailable &&
                        !hasEmbedDisabled &&
                        !hasContentRestriction &&
                        !hasAgeRestriction &&
                        !hasPrivacyRestriction &&
                        !hasPlayerError;
    
    let reason = '';
    if (!isEmbeddable) {
      if (hasVideoUnavailable) reason = 'Video unavailable';
      else if (hasEmbedDisabled) reason = 'Embedding disabled';
      else if (hasContentRestriction) reason = 'Content restriction';
      else if (hasAgeRestriction) reason = 'Age restriction';
      else if (hasPrivacyRestriction) reason = 'Privacy restriction';
      else if (hasPlayerError) reason = 'Player error';
      else reason = 'Unknown restriction';
    }
    
    console.log(`[${new Date().toISOString()}] Embed test - ID: ${videoId}, Embeddable: ${isEmbeddable}, Reason: ${reason || 'OK'}`);
    
    // Return structured response with embedding info
    res.json({
      videoId,
      isEmbeddable,
      reason: reason || null,
      metadata: {
        responseLength: html.length,
        hasPlayerConfig: html.includes('ytInitialPlayerResponse')
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] YouTube embed test error:`, error.message);
    
    res.json({
      videoId: req.params.videoId,
      isEmbeddable: false,
      reason: `Network error: ${error.message}`,
      metadata: {},
      timestamp: new Date().toISOString()
    });
  }
});

// YouTube video page fetching endpoint for embedding detection
app.get('/youtube/video/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Missing video ID parameter' 
      });
    }

    console.log(`[${new Date().toISOString()}] YouTube video page request:`, videoId);
    
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
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

    console.log(`[${new Date().toISOString()}] Fetching video page:`, videoUrl);
    
    const response = await fetch(videoUrl, {
      method: 'GET',
      headers,
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      console.error(`[${new Date().toISOString()}] YouTube video page responded with status:`, response.status);
      return res.status(response.status).json({
        error: `YouTube returned ${response.status}: ${response.statusText}`
      });
    }

    const html = await response.text();
    
    if (!html || html.length === 0) {
      console.error(`[${new Date().toISOString()}] Empty response from YouTube video page`);
      return res.status(502).json({
        error: 'Empty response from YouTube video page'
      });
    }

    // Parse HTML to detect embedding restrictions
    // Multiple approaches to catch different types of embedding restrictions
    
    // 1. Direct embedding flags
    const hasPlayableInEmbedFalse = html.includes('"playableInEmbed":false');
    const hasUnplayableStatus = html.includes('"status":"UNPLAYABLE"');
    const hasVideoUnavailable = html.includes('"reason":"Video unavailable"');
    const isPrivate = html.includes('"isPrivate":true');
    const isDeleted = html.includes('"isDeleted":true');
    
    // 2. Check for embed config restrictions
    const embedConfigBlocked = html.includes('"embedEnabled":false') || 
                              html.includes('"embeddable":false');
    
    // 3. Check for content restrictions (copyright, etc.)
    const hasContentRestrictions = html.includes('contentRestricted') ||
                                  html.includes('copyrightRestricted') ||
                                  html.includes('embedRestricted');
    
    // 4. Check for domain restrictions
    const hasDomainRestrictions = html.includes('allowedDomains') ||
                                 html.includes('blockedRegions');
    
    // 5. Check for specific error messages in player config
    const hasPlayerErrors = html.includes('"errorCode":') ||
                           html.includes('"unavailable":true') ||
                           html.includes('"unplayable":true');
    
    // 6. Check for age restrictions (which often block embedding)
    const hasAgeRestriction = html.includes('contentRating') ||
                             html.includes('isContentRatingRequired') ||
                             html.includes('ageGated');
    
    // Combine all checks - video is embeddable only if none of these flags are true
    const isEmbeddable = !hasPlayableInEmbedFalse && 
                        !hasUnplayableStatus &&
                        !hasVideoUnavailable &&
                        !isPrivate &&
                        !isDeleted &&
                        !embedConfigBlocked &&
                        !hasContentRestrictions &&
                        !hasDomainRestrictions &&
                        !hasPlayerErrors &&
                        !hasAgeRestriction;

    // Extract additional metadata for better decision making
    const videoTitle = html.match(/<title>([^<]+)<\/title>/)?.[1]?.replace(' - YouTube', '') || '';
    const channelName = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] || '';
    const isLiveStream = html.includes('"isLiveContent":true') || html.includes('"isLive":true');
    
    console.log(`[${new Date().toISOString()}] Video embedding check - ID: ${videoId}, Embeddable: ${isEmbeddable}, Title: ${videoTitle}`);
    
    // Return structured response with embedding info
    res.json({
      videoId,
      isEmbeddable,
      metadata: {
        title: videoTitle,
        channelName,
        isLiveStream
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] YouTube video page error:`, error.message);
    
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
      'GET /youtube/video/:videoId',
      'GET /youtube/embed-test/:videoId',
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