// AI Helpdesk & Support Automation API - Fully Functional
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

// Telegram Bot Token
const TELEGRAM_BOT_TOKEN = '8327082640:AAGMCI9uBO9NAHSMJTGvgPsNrdp6GmAaz8g';

// In-memory storage (use database in production)
const tickets = new Map();
const conversations = new Map();
const knowledgeBase = new Map();
const agents = new Map();
const analytics = {
  totalMessages: 0,
  aiResolved: 0,
  humanResolved: 0,
  avgResponseTime: 0,
  satisfaction: 0,
  dailyStats: []
};

// Initialize knowledge base
const defaultKB = [
  { id: 'kb-1', question: 'hours', answer: 'Our business hours are 9 AM - 6 PM, Monday to Friday.', category: 'general' },
  { id: 'kb-2', question: 'refund', answer: 'We offer full refunds within 30 days of purchase. Please provide your order number.', category: 'billing' },
  { id: 'kb-3', question: 'password', answer: 'To reset your password, click "Forgot Password" on the login page and check your email.', category: 'account' },
  { id: 'kb-4', question: 'shipping', answer: 'Standard shipping takes 5-7 business days. Express shipping is 2-3 days.', category: 'orders' },
  { id: 'kb-5', question: 'contact', answer: 'You can reach us at support@company.com or call 1-800-HELP.', category: 'general' },
  { id: 'kb-6', question: 'price', answer: 'Our pricing starts at $49/month per agent. Contact sales for volume discounts.', category: 'sales' },
  { id: 'kb-7', question: 'help', answer: 'I can help with: order status, refunds, account issues, shipping info. What do you need?', category: 'general' },
  { id: 'kb-8', question: 'hi', answer: 'Hello! 👋 I\'m your AI support assistant. How can I help you today?', category: 'greeting' },
  { id: 'kb-9', question: 'hello', answer: 'Hi there! 👋 I\'m here to help. What can I assist you with?', category: 'greeting' }
];
defaultKB.forEach(kb => knowledgeBase.set(kb.id, kb));

// Helper functions
function generateId(prefix) {
  return prefix + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function findBestAnswer(query) {
  const q = query.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;
  
  for (const [id, kb] of knowledgeBase) {
    const words = kb.question.toLowerCase().split(' ');
    const score = words.filter(w => w.length > 2 && q.includes(w)).length;
    if (score > highestScore) {
      highestScore = score;
      bestMatch = kb;
    }
  }
  
  // Check for greeting keywords
  if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return { answer: 'Hello! 👋 I\'m your AI support assistant. I can help with:\n\n• Business hours\n• Refunds & returns\n• Order status\n• Shipping info\n• Account issues\n\nWhat can I help you with?' };
  }
  
  return bestMatch;
}

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      }
    );
    return await response.json();
  } catch (error) {
    console.error('Telegram send error:', error);
    return null;
  }
}

// Routes

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'AI Helpdesk & Support Automation',
    version: '2.0.0',
    telegram: 'Connected',
    endpoints: {
      tickets: '/api/tickets',
      conversations: '/api/conversations',
      knowledgebase: '/api/knowledgebase',
      agents: '/api/agents',
      analytics: '/api/analytics',
      webhook: '/api/webhook (Telegram)'
    }
  });
});

// Telegram Webhook Handler
app.post('/api/webhook', async (req, res) => {
  const update = req.body;
  
  // Handle Telegram update format
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const text = msg.text || '';
    const userName = msg.from?.first_name || 'User';
    const fromId = msg.from?.id.toString();
    
    analytics.totalMessages++;
    
    // Find or create conversation
    let conv = Array.from(conversations.values()).find(c => c.from === fromId && c.channel === 'telegram');
    if (!conv) {
      conv = {
        id: generateId('CONV'),
        from: fromId,
        chatId: chatId,
        channel: 'telegram',
        userName: userName,
        messages: [],
        status: 'open',
        assignedAgent: null,
        createdAt: new Date().toISOString()
      };
      conversations.set(conv.id, conv);
    }
    
    // Add user message
    conv.messages.push({
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    });
    
    // Generate AI response
    const kbMatch = findBestAnswer(text);
    let response;
    let isAI = true;
    
    if (kbMatch) {
      response = kbMatch.answer;
      analytics.aiResolved++;
    } else if (text.toLowerCase().includes('agent') || text.toLowerCase().includes('human') || text.toLowerCase().includes('speak to')) {
      response = '🔄 I\'ll connect you with a human agent. Please wait...';
      conv.status = 'pending_handover';
      isAI = false;
      analytics.humanResolved++;
      
      // Create ticket for handover
      const ticket = {
        id: generateId('TKT'),
        conversationId: conv.id,
        subject: text.substring(0, 50),
        description: text,
        status: 'open',
        priority: 'medium',
        channel: 'telegram',
        customerName: userName,
        createdAt: new Date().toISOString()
      };
      tickets.set(ticket.id, ticket);
    } else {
      response = `Thanks for your message, ${userName}! 🤖\n\nI'm not sure I understand. Here's what I can help with:\n\n• *Business hours* - When we're open\n• *Refunds* - Our refund policy\n• *Shipping* - Delivery times\n• *Account* - Password & login help\n• *Contact* - How to reach us\n\nOr type "agent" to speak with a human.`;
      analytics.humanResolved++;
    }
    
    conv.messages.push({
      role: 'assistant',
      content: response,
      isAI,
      timestamp: new Date().toISOString()
    });
    
    conversations.set(conv.id, conv);
    
    // Send response back to Telegram
    await sendTelegramMessage(chatId, response);
    
    return res.json({ ok: true });
  }
  
  // Handle custom webhook format (WhatsApp, Slack, etc.)
  const { from, message, channel, userName } = req.body;
  
  if (from && message) {
    analytics.totalMessages++;
    
    let conv = Array.from(conversations.values()).find(c => c.from === from && c.channel === channel);
    if (!conv) {
      conv = {
        id: generateId('CONV'),
        from,
        channel: channel || 'web',
        userName: userName || 'Unknown',
        messages: [],
        status: 'open',
        createdAt: new Date().toISOString()
      };
      conversations.set(conv.id, conv);
    }
    
    conv.messages.push({ role: 'user', content: message, timestamp: new Date().toISOString() });
    
    const kbMatch = findBestAnswer(message);
    let response = kbMatch ? kbMatch.answer : 'Thank you for your message. A support agent will respond shortly.';
    
    conv.messages.push({ role: 'assistant', content: response, timestamp: new Date().toISOString() });
    conversations.set(conv.id, conv);
    
    return res.json({ response, conversationId: conv.id });
  }
  
  res.json({ ok: true });
});

// Knowledge Base
app.get('/api/knowledgebase', (req, res) => {
  res.json({ knowledgeBase: Array.from(knowledgeBase.values()) });
});

app.post('/api/knowledgebase', (req, res) => {
  const { question, answer, category } = req.body;
  const id = generateId('KB');
  const entry = { id, question, answer, category: category || 'general', createdAt: new Date().toISOString() };
  knowledgeBase.set(id, entry);
  res.json({ success: true, entry });
});

app.delete('/api/knowledgebase/:id', (req, res) => {
  res.json({ success: knowledgeBase.delete(req.params.id) });
});

// Conversations
app.get('/api/conversations', (req, res) => {
  const { status, channel } = req.query;
  let result = Array.from(conversations.values());
  if (status) result = result.filter(c => c.status === status);
  if (channel) result = result.filter(c => c.channel === channel);
  res.json({ conversations: result });
});

app.get('/api/conversations/:id', (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json({ conversation: conv });
});

// Tickets
app.post('/api/tickets', (req, res) => {
  const { subject, description, priority, customerEmail, channel } = req.body;
  
  const ticket = {
    id: generateId('TKT'),
    subject,
    description,
    priority: priority || 'medium',
    status: 'open',
    customerEmail,
    channel,
    assignedTo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  tickets.set(ticket.id, ticket);
  res.json({ success: true, ticket });
});

app.get('/api/tickets', (req, res) => {
  const { status, priority } = req.query;
  let result = Array.from(tickets.values());
  if (status) result = result.filter(t => t.status === status);
  if (priority) result = result.filter(t => t.priority === priority);
  res.json({ tickets: result });
});

app.get('/api/tickets/:id', (req, res) => {
  const ticket = tickets.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  res.json({ ticket });
});

app.patch('/api/tickets/:id', (req, res) => {
  const ticket = tickets.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  
  const { status, assignedTo, priority } = req.body;
  if (status) ticket.status = status;
  if (assignedTo) ticket.assignedTo = assignedTo;
  if (priority) ticket.priority = priority;
  ticket.updatedAt = new Date().toISOString();
  
  tickets.set(ticket.id, ticket);
  res.json({ success: true, ticket });
});

// Agents
app.get('/api/agents', (req, res) => {
  res.json({ agents: Array.from(agents.values()) });
});

app.post('/api/agents', (req, res) => {
  const { name, email, role } = req.body;
  const id = generateId('AGT');
  const agent = { id, name, email, role: role || 'support', status: 'online', ticketsAssigned: 0 };
  agents.set(id, agent);
  res.json({ success: true, agent });
});

// Analytics
app.get('/api/analytics', (req, res) => {
  const openTickets = Array.from(tickets.values()).filter(t => t.status === 'open').length;
  const resolved = Array.from(tickets.values()).filter(t => t.status === 'resolved').length;
  
  const channelStats = {};
  for (const conv of conversations.values()) {
    channelStats[conv.channel] = (channelStats[conv.channel] || 0) + 1;
  }
  
  res.json({
    overview: {
      totalMessages: analytics.totalMessages,
      aiResolved: analytics.aiResolved,
      humanResolved: analytics.humanResolved,
      aiResolutionRate: analytics.totalMessages > 0 ? Math.round((analytics.aiResolved / analytics.totalMessages) * 100) : 0
    },
    tickets: { open: openTickets, resolved, total: tickets.size },
    channels: channelStats,
    satisfaction: analytics.satisfaction || 'N/A'
  });
});

// Pricing
app.get('/api/pricing', (req, res) => {
  res.json({
    perSeat: 49,
    perMessage: 0.01,
    currency: 'USD',
    example: '$49/seat/month + $0.01/message'
  });
});

module.exports = app;