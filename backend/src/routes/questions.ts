import { Hono } from 'hono';
import { GUIDED_QUESTIONS } from '@threat-modeling/shared';

const app = new Hono();

// Get guided questions
app.get('/', (c) => {
  return c.json(GUIDED_QUESTIONS);
});

export default app;
