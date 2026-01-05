import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  getJiraService,
  isJiraConfigured,
  parseJiraUrl,
  type JiraTicketData,
} from '../services/jira.service';

const app = new Hono();

// =============================================================================
// Schemas
// =============================================================================

const parseUrlSchema = z.object({
  url: z.string().min(1),
});

const fetchTicketSchema = z.object({
  issueKeyOrUrl: z.string().min(1),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * GET /api/jira/status
 * Check if JIRA is configured
 */
app.get('/status', (c) => {
  const configured = isJiraConfigured();
  return c.json({
    configured,
    host: configured ? process.env.JIRA_HOST : null,
  });
});

/**
 * POST /api/jira/test
 * Test JIRA connection
 */
app.post('/test', async (c) => {
  if (!isJiraConfigured()) {
    return c.json(
      {
        success: false,
        error: 'JIRA is not configured. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN.',
      },
      400
    );
  }

  try {
    const jiraService = getJiraService();
    const result = await jiraService.testConnection();
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * POST /api/jira/parse-url
 * Parse a JIRA URL to extract issue key
 */
app.post('/parse-url', zValidator('json', parseUrlSchema), (c) => {
  const { url } = c.req.valid('json');
  const parsed = parseJiraUrl(url);

  if (!parsed) {
    return c.json(
      {
        success: false,
        error: 'Invalid JIRA URL or issue key format. Expected formats: PROJ-123, https://company.atlassian.net/browse/PROJ-123',
      },
      400
    );
  }

  return c.json({
    success: true,
    issueKey: parsed.issueKey,
    projectKey: parsed.projectKey,
    host: parsed.host,
  });
});

/**
 * POST /api/jira/fetch
 * Fetch JIRA ticket data
 */
app.post('/fetch', zValidator('json', fetchTicketSchema), async (c) => {
  if (!isJiraConfigured()) {
    return c.json(
      {
        success: false,
        error: 'JIRA is not configured. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN.',
      },
      400
    );
  }

  const { issueKeyOrUrl } = c.req.valid('json');

  // Parse the input to get issue key
  const parsed = parseJiraUrl(issueKeyOrUrl);
  if (!parsed) {
    return c.json(
      {
        success: false,
        error: 'Invalid JIRA URL or issue key format',
      },
      400
    );
  }

  try {
    const jiraService = getJiraService();
    const ticket = await jiraService.fetchIssue(parsed.issueKey);
    return c.json({
      success: true,
      ticket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle common JIRA API errors
    if (message.includes('401') || message.includes('Unauthorized')) {
      return c.json(
        {
          success: false,
          error: 'JIRA authentication failed. Please check your API credentials.',
        },
        401
      );
    }

    if (message.includes('403') || message.includes('Forbidden')) {
      return c.json(
        {
          success: false,
          error: 'You do not have permission to access this JIRA issue.',
        },
        403
      );
    }

    if (message.includes('404') || message.includes('not found')) {
      return c.json(
        {
          success: false,
          error: `JIRA issue ${parsed.issueKey} not found.`,
        },
        404
      );
    }

    return c.json(
      {
        success: false,
        error: `Failed to fetch JIRA issue: ${message}`,
      },
      500
    );
  }
});

export { app as jiraRoutes };
