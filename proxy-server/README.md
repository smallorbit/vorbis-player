# Vorbis Player Proxy Server

A simple Node.js CORS proxy server to handle YouTube requests for the Vorbis Player application.

## Why This Proxy?

YouTube blocks direct browser requests due to CORS policies. This lightweight proxy server:
- ✅ Bypasses CORS restrictions  
- ✅ Uses proper browser headers to avoid detection
- ✅ Provides caching for better performance
- ✅ Includes health monitoring and error handling
- ✅ Falls back gracefully to external proxies if needed

## Quick Start

### Option 1: Automatic Setup (Recommended)
```bash
# From the main project directory
npm run proxy:install  # Install proxy dependencies
npm run proxy:start    # Start proxy server
```

### Option 2: Manual Setup
```bash
# Navigate to proxy server directory
cd proxy-server

# Install dependencies
npm install

# Start the server
npm start

# Or start with auto-restart during development
npm run dev
```

### Option 3: Run Everything Together
```bash
# From main project directory - starts both proxy and app
npm run dev:all
```

## Usage

Once started, the proxy server runs on `http://127.0.0.1:3001` and provides:

### Health Check
```bash
curl http://127.0.0.1:3001/health
```

### YouTube Search Proxy
```bash
curl "http://127.0.0.1:3001/youtube/search?q=Sufjan%20Stevens%20Carrie%20Lowell"
```

### Generic Proxy (if needed)
```bash
curl "http://127.0.0.1:3001/proxy?url=https://example.com"
```

## How It Works

1. **Vorbis Player** makes requests to `http://127.0.0.1:3001/youtube/search?q=<query>`
2. **Proxy Server** receives the request and fetches from YouTube with proper headers
3. **YouTube** responds with HTML (no CORS issues since it's server-to-server)
4. **Proxy Server** returns the HTML to the browser with CORS headers enabled
5. **Vorbis Player** processes the HTML to extract video information

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PROXY_PORT` | `3001` | Port for the proxy server |

## Troubleshooting

### Proxy Server Won't Start
```bash
# Check if port 3001 is already in use
lsof -i :3001

# Kill any process using the port
kill -9 <PID>

# Try starting again
npm run proxy:start
```

### YouTube Requests Still Failing
1. Ensure proxy server is running: `npm run proxy:test`
2. Check browser console for connection errors
3. Verify the proxy server logs for error details
4. Try restarting the proxy: `Ctrl+C` then `npm run proxy:start`

### External Proxy Fallback
If the local proxy fails, the app automatically tries external proxy services:
- `api.allorigins.win` 
- `corsproxy.io`

## Development

### Server Logs
The proxy server provides detailed logging:
```
🚀 Vorbis Player Proxy Server running on http://127.0.0.1:3001
📺 YouTube search endpoint: http://127.0.0.1:3001/youtube/search?q=<query>
🏥 Health check: http://127.0.0.1:3001/health
⏰ Started at: 2024-01-01T12:00:00.000Z

[2024-01-01T12:01:00.000Z] YouTube search request: Sufjan Stevens
[2024-01-01T12:01:00.000Z] Fetching: https://www.youtube.com/results?search_query=...
[2024-01-01T12:01:01.000Z] Success! Response length: 2547392
```

### Adding New Endpoints
To add new proxy endpoints, edit `server.js`:

```javascript
app.get('/my-endpoint', async (req, res) => {
  // Your proxy logic here
});
```

## Security Notes

- The proxy only accepts requests from `http://127.0.0.1:3000` (CORS restricted)
- No sensitive data is logged or stored
- Requests are not cached permanently (5-minute cache max)
- Server runs on localhost only (not accessible externally)

## Dependencies

- **express**: Web server framework
- **cors**: CORS middleware
- **node-fetch**: HTTP client for server-side requests
- **nodemon**: Development auto-restart (dev only)