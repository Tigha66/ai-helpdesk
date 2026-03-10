# AI Helpdesk & Support Automation App

🤖 AI-powered helpdesk agent for multichannel customer support.

## Features

### ✅ Multichannel Support
- WhatsApp, Telegram, Slack integration via webhook
- Unified conversation management

### ✅ Mobile Dashboard
- Real-time conversation monitoring
- Ticket management
- Agent assignment

### ✅ AI-Driven Automation
- Knowledge base auto-responses
- Smart ticket routing
- Human handover for complex issues

### ✅ Ticket Management
- Auto-created tickets from conversations
- Priority assignment (low/medium/high)
- Status tracking (open/in_progress/resolved)

### ✅ Analytics & Reporting
- Message volume tracking
- AI vs Human resolution rates
- Per-channel statistics

### ✅ Pricing Model
- $49 per seat/month
- $0.01 per message

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| POST | `/api/webhook` | Receive messages |
| GET | `/api/conversations` | List conversations |
| GET | `/api/tickets` | List tickets |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/knowledgebase` | List KB entries |
| POST | `/api/knowledgebase` | Add KB entry |
| GET | `/api/analytics` | Get analytics |

## Deploy

Deploy using here.now or Vercel.
