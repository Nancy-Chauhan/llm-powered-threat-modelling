import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import threatModelsRoutes from './routes/threat-models';
import sharedRoutes from './routes/shared';
import questionsRoutes from './routes/questions';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.route('/api/threat-models', threatModelsRoutes);
app.route('/api/shared', sharedRoutes);
app.route('/api/questions', questionsRoutes);

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal server error', message: err.message }, 500);
});

const port = parseInt(process.env.PORT || '3001');
console.log(`Server starting on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
