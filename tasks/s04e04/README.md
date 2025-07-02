# S04E04 - HTTPS Webhook API

This task implements a simple HTTPS REST API server with a webhook endpoint that returns a specific data structure.

## Features

- HTTPS protocol with self-signed certificates
- Single webhook endpoint: `POST /webhook`
- Returns JSON response: `{ "description": "opis miejsca" }`

## Running the Server

To start the server:

```bash
# From project root
npm run start --dir=s04e04

# OR in development mode with file watching
npm run dev --dir=s04e04

# Use HTTP instead of HTTPS (for testing)
USE_HTTP=true npm run dev --dir=s04e04
```

The server will:

1. Generate self-signed SSL certificates if they don't exist
2. Start an HTTPS server on port 3000 (or PORT environment variable)
3. Listen for POST requests on `/webhook`

## Testing the API

Using curl:

```bash
# For HTTPS (default) - The -k flag ignores self-signed certificate warnings
curl -k -X POST https://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# For HTTP (if USE_HTTP=true)
curl -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

Expected response:

```json
{
  "description": "opis miejsca"
}
```

## Production Deployment Notes

For a production deployment:

- Replace self-signed certificates with valid ones
- Use a proper domain name
- Consider implementing authentication
- Set up proper logging and monitoring

## Project Structure

```plaintext
s04e04/
├── index.ts         # Main server implementation
├── cert/            # Auto-generated directory for SSL certificates
│   ├── cert.pem     # Self-signed certificate
│   └── key.pem      # Private key
└── README.md        # Documentation
```
