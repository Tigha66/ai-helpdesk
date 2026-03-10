// AI Helpdesk & Support Automation API
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cors());

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
  { id: 'kb-5', question: 'contact', answer: 'You can reach us at support@company.com or call 1-800-HELP.', category: 'general' }
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
    const score = kb.question.toLowerCase().split(' ').filter(w => q.includes(w)).length;
    if (score > highestScore) {
      highestScore = score;
      bestMatch = kb;
    }
  }
  
  return bestMatch;
}

// Routes

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'AI Helpdesk & Support Automation',
    version: '1.0.0',
    endpoints: {
      tickets: '/api/tickets',
      conversations: '/api/conversations',
      knowledgebase: '/api/knowledgebase',
      agents: '/api/agents',
      analytics: '/api/analytics',
      webhook: '/api/webhook'
    }
  });
});

// Knowledge Base
app.get('/api/knowledgebase', (req, res) => {
  res.json({ knowledgeBase: Array.from(knowledgeBase.values()) });
});

app.post('/api/knowledgebase', (req, res) => {
  const { question, answer, category } = req.body;
  const id = generateId('KB');
  const entry = { id, question, answer, category, createdAt: new Date().toISOString() };
  knowledgeBase.set(id, entry);
  res.json({ success: true, entry });
});

app.delete('/api/knowledgebase/:id', (req, res) => {
  if (knowledgeBase.delete(req.params.id)) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Conversations (multichannel)
app.post('/api/webhook', (req, res) => {
  const { from, message, channel, userName } = req.body;
  
  analytics.totalMessages++;
  
  // Find or create conversation
  let conv = Array.from(conversations.values()).find(c => c.from === from && c.channel === channel);
  if (!conv) {
    conv = {
      id: generateId('CONV'),
      from,
      channel,
      userName: userName || 'Unknown',
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
    content: message,
    timestamp: new Date().toISOString()
  });
  
  // AI response
  const kbMatch = findBestAnswer(message);
  let response;
  let isAI = true;
  
  if (kbMatch) {
    response = kbMatch.answer;
    conv.category = kbMatch.category;
    analytics.aiResolved++;
  } else if (message.toLowerCase().includes('agent') || message.toLowerCase().includes('human')) {
    response = 'I\'ll connect you with a human agent. Please wait...';
    conv.status = 'pending_handover';
    isAI = false;
  } else {
    response = 'Thank you for your message. A support agent will respond shortly. For immediate help, visit our FAQ at example.com/faq';
    analytics.humanResolved++;
  }
  
  conv.messages.push({
    role: 'assistant',
    content: response,
    isAI,
    timestamp: new Date().toISOString()
  });
  
  conversations.set(conv.id, conv);
  
  res.json({ 
    response,
    conversationId: conv.id,
    isAI,
    status: conv.status
  });
});

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
    conversationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    resolvedAt: null
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
  
  if (status === 'resolved') {
    ticket.resolvedAt = new Date().toISOString();
  }
  
  tickets.set(ticket.id, ticket);
  res.json({ success: true, ticket });
});

app.post('/api/tickets/:id/assign', (req, res) => {
  const ticket = tickets.get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Not found' });
  
  const { agentId, agentName } = req.body;
  ticket.assignedTo = { id: agentId, name: agentName };
  ticket.status = 'in_progress';
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
  const agent = {
    id,
    name,
    email,
    role: role || 'support',
    status: 'online',
    ticketsAssigned: 0,
    createdAt: new Date().toISOString()
  };
  agents.set(id, agent);
  res.json({ success: true, agent });
});

// Analytics
app.get('/api/analytics', (req, res) => {
  const openTickets = Array.from(tickets.values()).filter(t => t.status === 'open').length;
  const inProgress = Array.from(tickets.values()).filter(t => t.status === 'in_progress').length;
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
    tickets: {
      open: openTickets,
      inProgress: inProgress,
      resolved: resolved,
      total: tickets.size
    },
    channels: channelStats,
    satisfaction: analytics.satisfaction || 'N/A'
  });
});

// Handover conversation to human
app.post('/api/conversations/:id/handover', (req, res) => {
  const conv = conversations.get(req.params.id);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  
  conv.status = 'pending_handover';
  conv.messages.push({
    role: 'system',
    content: 'Conversation handed over to human agent',
    timestamp: new Date().toISOString()
  });
  
  conversations.set(conv.id, conv);
  res.json({ success: true, conversation: conv });
});

// Pricing
app.get('/api/pricing', (req, res) => {
  res.json({
    perSeat: 49,
    perMessage: 0.01,
    currency: 'USD',
    example: {
      seats: 5,
      messages: 10000,
      total: (5 * 49) + (10000 * 0.01) = 245 + 100 = $345/month
    }
  });
});

module.exports = app;
