import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';

import threatModelsRoutes from './routes/threat-models';
import sharedRoutes from './routes/shared';
import questionsRoutes from './routes/questions';
import { jiraRoutes } from './routes/jira';
import oauthRoutes from './routes/oauth';

const app = new Hono();

// Middleware
app.use('*', logger());

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use('*', cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Serve static files from uploads directory (for local storage)
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads/*', serveStatic({ root: uploadDir.replace('./uploads', '.') }));

// Helper to check if running in production (evaluated at runtime, not build time)
// Using dynamic property access to prevent bundler from inlining
const getEnv = (key: string) => process.env[key];
const isProduction = () => getEnv('NODE_ENV') === 'production';

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// API Routes
app.route('/api/threat-models', threatModelsRoutes);
app.route('/api/shared', sharedRoutes);
app.route('/api/questions', questionsRoutes);
app.route('/api/jira', jiraRoutes);
app.route('/api/oauth', oauthRoutes);

// Serve frontend static files in production (after API routes)
app.use('/assets/*', serveStatic({ root: '../frontend/dist' }));
app.get('/favicon.png', serveStatic({ path: '../frontend/dist/favicon.png' }));

// 404 handler - serve index.html for SPA routing in production
app.notFound(async (c) => {
  const path = c.req.path;
  // Return JSON 404 for API routes
  if (path.startsWith('/api/') || path.startsWith('/uploads/') || path === '/health') {
    return c.json({ error: 'Not found' }, 404);
  }
  // Serve index.html for SPA client-side routing in production
  if (isProduction()) {
    const indexHtml = Bun.file('../frontend/dist/index.html');
    if (await indexHtml.exists()) {
      return c.html(await indexHtml.text());
    }
  }
  return c.json({ error: 'Not found' }, 404);
});

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
