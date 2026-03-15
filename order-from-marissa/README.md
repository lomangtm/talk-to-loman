# Order from Marissa

An AI-powered video ordering agent for restaurants. Customers interact face-to-face with Marissa, a photorealistic AI video avatar, who takes their food order through natural conversation.

Built as an embedded demo for [Loman AI](https://www.loman.ai).

## How It Works

1. Visitor clicks "Start Your Order" on the landing page
2. A full-screen conversation modal opens with Marissa's video feed
3. Marissa greets the customer and takes their order via voice
4. The order summary sidebar updates in real time
5. Customer confirms and completes the order

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + WebSocket
- **AI Video**: [Tavus CVI API](https://tavus.io) for conversational video
- **State**: In-memory session storage

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs on port 5000 and works in **demo mode** without API keys — the video agent is replaced with a placeholder, and demo quick-add buttons allow testing the order flow.

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `TAVUS_API_KEY` | Your Tavus API key for live video conversations |
| `TAVUS_REPLICA_ID` | Tavus replica ID for Marissa's avatar |

## Demo Mode

When `TAVUS_API_KEY` is not set, the app runs in demo mode:
- Video area shows a placeholder avatar
- Quick-add buttons let you test the order sidebar
- Order confirmation flow works normally

## Docker

```bash
docker-compose up --build
```

## Widget Embedding

Embed the ordering experience on any webpage:

```html
<div id="loman-order-demo"
     data-restaurant="Your Restaurant"
     data-theme="dark"
     data-api="https://your-deployment-url.com">
</div>
<script src="https://your-deployment-url.com/widget.js"></script>
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/menu` | Get the restaurant menu |
| `POST` | `/api/conversation/start` | Start a new conversation session |
| `GET` | `/api/conversation/:sessionId` | Get session state |
| `POST` | `/api/conversation/:sessionId/order` | Add/remove order items |
| `POST` | `/api/order/:sessionId/complete` | Complete an order |
| `WS` | `/ws?sessionId=...` | Real-time order updates |

## License

MIT
