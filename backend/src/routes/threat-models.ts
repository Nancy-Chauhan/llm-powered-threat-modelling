import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, desc, sql, ilike, and, or } from 'drizzle-orm';
import { db, threatModels, contextFiles, jiraTickets, userUsage } from '../db';
import { generateThreatModel } from '../services/threat-generation';
import { generateMarkdownReport, generateJsonExport, generatePdfReport } from '../services/pdf-export';
import { getDefaultStorageProvider } from '../storage';
import {
  CreateThreatModelRequestSchema,
  UpdateThreatModelRequestSchema,
  GUIDED_QUESTIONS,
} from '@threat-modeling/shared';
import {
  getJiraService,
  isJiraConfigured,
  parseJiraUrl,
} from '../services/jira.service';
import { authMiddleware } from '../middleware/auth';

const app = new Hono();

// Default generation limit per user
const DEFAULT_GENERATION_LIMIT = 5;

// Apply auth middleware to all routes
app.use('*', authMiddleware);

// Helper to get or create user usage record
async function getUserUsage(userId: string) {
  let [usage] = await db
    .select()
    .from(userUsage)
    .where(eq(userUsage.userId, userId));

  if (!usage) {
    [usage] = await db
      .insert(userUsage)
      .values({ userId, generationsUsed: 0, generationsLimit: DEFAULT_GENERATION_LIMIT })
      .returning();
  }

  return usage;
}

// Get user usage stats
app.get('/usage', async (c) => {
  const { userId } = c.get('auth');
  const usage = await getUserUsage(userId);

  return c.json({
    generationsUsed: usage.generationsUsed,
    generationsLimit: usage.generationsLimit,
    remaining: usage.generationsLimit - usage.generationsUsed,
  });
});

// List threat models (filtered by user)
app.get('/', async (c) => {
  const { userId } = c.get('auth');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const status = c.req.query('status');
  const search = c.req.query('search');

  const offset = (page - 1) * pageSize;

  // Always filter by userId for multi-tenancy
  const conditions = [eq(threatModels.userId, userId)];

  if (status) {
    conditions.push(eq(threatModels.status, status as 'draft' | 'generating' | 'completed' | 'failed'));
  }
  if (search) {
    const searchCondition = or(
      ilike(threatModels.title, `%${search}%`),
      ilike(threatModels.description, `%${search}%`)
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: threatModels.id,
        title: threatModels.title,
        description: threatModels.description,
        status: threatModels.status,
        threats: threatModels.threats,
        shareToken: threatModels.shareToken,
        isPublic: threatModels.isPublic,
        createdAt: threatModels.createdAt,
        updatedAt: threatModels.updatedAt,
      })
      .from(threatModels)
      .where(whereClause)
      .orderBy(desc(threatModels.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(threatModels)
      .where(whereClause),
  ]);

  const threatModelSummaries = items.map((item) => {
    const threats = (item.threats || []) as Array<{ severity: string }>;
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    let highestSeverity: string | undefined;

    for (const sev of severityOrder) {
      if (threats.some((t) => t.severity === sev)) {
        highestSeverity = sev;
        break;
      }
    }

    const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      threatCount: threats.length,
      highestSeverity,
      isShared: item.isPublic && !!item.shareToken,
      shareUrl: item.shareToken ? `${baseUrl}/shared/${item.shareToken}` : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  });

  return c.json({
    items: threatModelSummaries,
    total: Number(countResult[0]?.count || 0),
    page,
    pageSize,
  });
});

// Get single threat model (with ownership check)
app.get('/:id', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const [files, tickets] = await Promise.all([
    db.select().from(contextFiles).where(eq(contextFiles.threatModelId, id)),
    db.select().from(jiraTickets).where(eq(jiraTickets.threatModelId, id)),
  ]);

  return c.json({
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    generationStartedAt: model.generationStartedAt?.toISOString(),
    generationCompletedAt: model.generationCompletedAt?.toISOString(),
    contextFiles: files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
    jiraTickets: tickets.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

// Create threat model (drafts are free, generation is limited)
app.post('/', zValidator('json', CreateThreatModelRequestSchema), async (c) => {
  const { userId } = c.get('auth');
  const body = c.req.valid('json');

  const [model] = await db
    .insert(threatModels)
    .values({
      title: body.title,
      description: body.description,
      systemDescription: body.systemDescription,
      status: 'draft',
      userId, // Associate with current user
    })
    .returning();

  return c.json({
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  }, 201);
});

// Update threat model (with ownership check)
app.patch('/:id', zValidator('json', UpdateThreatModelRequestSchema), async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!existing) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const [model] = await db
    .update(threatModels)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)))
    .returning();

  return c.json({
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  });
});

// Delete threat model (with ownership check)
app.delete('/:id', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!existing) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  await db.delete(threatModels).where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  return c.json({ success: true });
});

// Generate threat model (with rate limiting)
app.post('/:id/generate', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  if (model.status === 'generating') {
    return c.json({ error: 'Generation already in progress' }, 400);
  }

  // Check generation quota (only for new generations, not re-generations)
  if (model.status !== 'completed' && model.status !== 'failed') {
    const usage = await getUserUsage(userId);

    if (usage.generationsUsed >= usage.generationsLimit) {
      return c.json({
        error: `Generation limit reached. You have used ${usage.generationsUsed}/${usage.generationsLimit} generations.`,
        generationsUsed: usage.generationsUsed,
        generationsLimit: usage.generationsLimit,
      }, 429);
    }

    // Increment usage counter
    await db
      .update(userUsage)
      .set({
        generationsUsed: usage.generationsUsed + 1,
        updatedAt: new Date(),
      })
      .where(eq(userUsage.userId, userId));
  }

  // Start generation in background
  generateThreatModel(id).catch((err) => {
    console.error('Generation failed:', err);
  });

  return c.json({
    status: 'generating',
    message: 'Threat model generation started',
  });
});

// Get generation status (with ownership check)
app.get('/:id/generation-status', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select({
      status: threatModels.status,
      generationError: threatModels.generationError,
    })
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  return c.json({
    status: model.status,
    error: model.generationError,
    progress: model.status === 'generating' ? 50 : model.status === 'completed' ? 100 : 0,
  });
});

// Create share link (with ownership check)
app.post('/:id/share', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  let shareToken = model.shareToken;
  if (!shareToken) {
    shareToken = nanoid(21);
    await db
      .update(threatModels)
      .set({ shareToken, isPublic: true })
      .where(eq(threatModels.id, id));
  }

  const baseUrl = process.env.PUBLIC_URL || 'http://localhost:5173';

  return c.json({
    shareUrl: `${baseUrl}/shared/${shareToken}`,
    shareToken,
  });
});

// Delete share link (with ownership check)
app.delete('/:id/share', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  await db
    .update(threatModels)
    .set({ shareToken: null, isPublic: false })
    .where(eq(threatModels.id, id));

  return c.json({ success: true });
});

// Export threat model (with ownership check)
app.get('/:id/export', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const format = c.req.query('format') || 'pdf';

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const files = await db
    .select()
    .from(contextFiles)
    .where(eq(contextFiles.threatModelId, id));

  if (format === 'json') {
    return c.json(generateJsonExport(model, files));
  }

  if (format === 'markdown') {
    const markdown = generateMarkdownReport(model, files);
    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${model.title.replace(/[^a-z0-9]/gi, '_')}_threat_model.md"`,
      },
    });
  }

  // Default to PDF
  const pdfBuffer = await generatePdfReport(model, files);

  return new Response(pdfBuffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${model.title.replace(/[^a-z0-9]/gi, '_')}_threat_model.pdf"`,
    },
  });
});

// Upload context file (with ownership check)
// Files are stored via storage provider (local/S3) and sent to LLM via URL
app.post('/:id/files', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const fileType = (formData.get('fileType') as string) || 'other';

  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Validate supported file types for LLM
  const supportedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',  // Images
    'application/pdf',                                       // PDFs
    'text/plain', 'text/markdown', 'text/html',             // Text
    'application/json',                                      // JSON
  ];

  const isTextFile = file.name.endsWith('.md') || file.name.endsWith('.txt');
  if (!supportedMimeTypes.includes(file.type) && !isTextFile) {
    return c.json({
      error: `Unsupported file type: ${file.type}. Supported: images (PNG, JPG, GIF, WebP), PDFs, and text files.`
    }, 400);
  }

  // Upload file to storage provider (local filesystem or S3)
  const storage = getDefaultStorageProvider();
  const buffer = Buffer.from(await file.arrayBuffer());

  const uploadResult = await storage.upload(buffer, file.name, {
    contentType: file.type || (isTextFile ? 'text/plain' : 'application/octet-stream'),
    metadata: {
      threatModelId: id,
      fileType,
    },
  });

  // No local text extraction - LLM will parse all file types via URL
  const [contextFile] = await db
    .insert(contextFiles)
    .values({
      threatModelId: id,
      filename: uploadResult.key,
      originalName: file.name,
      mimeType: file.type || (isTextFile ? 'text/plain' : 'application/octet-stream'),
      size: file.size,
      fileType: fileType as 'prd' | 'diagram' | 'screenshot' | 'other',
      storagePath: uploadResult.key, // Storage key, not filesystem path
      extractedText: null, // LLM handles parsing
    })
    .returning();

  return c.json({
    ...contextFile,
    url: uploadResult.url, // Include URL in response
    createdAt: contextFile.createdAt.toISOString(),
  }, 201);
});

// Delete context file (with ownership check)
app.delete('/:id/files/:fileId', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const fileId = c.req.param('fileId');

  // Verify ownership of the threat model
  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const [file] = await db
    .select()
    .from(contextFiles)
    .where(eq(contextFiles.id, fileId));

  if (!file || file.threatModelId !== id) {
    return c.json({ error: 'File not found' }, 404);
  }

  // Delete from storage provider
  try {
    const storage = getDefaultStorageProvider();
    await storage.delete(file.storagePath);
  } catch {
    // File might not exist in storage
  }

  await db.delete(contextFiles).where(eq(contextFiles.id, fileId));

  return c.json({ success: true });
});

// Update threat within a model (with ownership check)
app.patch(
  '/:id/threats/:threatId',
  zValidator(
    'json',
    z.object({
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
      likelihood: z.number().min(1).max(5).optional(),
      impact: z.number().min(1).max(5).optional(),
    })
  ),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const threatId = c.req.param('threatId');
    const body = c.req.valid('json');

    const [model] = await db
      .select()
      .from(threatModels)
      .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

    if (!model) {
      return c.json({ error: 'Threat model not found' }, 404);
    }

    const threats = (model.threats || []) as Array<{
      id: string;
      likelihood: number;
      impact: number;
      riskScore: number;
      severity: string;
      [key: string]: unknown;
    }>;

    const threatIndex = threats.findIndex((t) => t.id === threatId);
    if (threatIndex === -1) {
      return c.json({ error: 'Threat not found' }, 404);
    }

    const threat = threats[threatIndex];
    if (body.likelihood !== undefined) threat.likelihood = body.likelihood;
    if (body.impact !== undefined) threat.impact = body.impact;
    if (body.severity !== undefined) threat.severity = body.severity;
    threat.riskScore = threat.likelihood * threat.impact;

    await db
      .update(threatModels)
      .set({ threats, updatedAt: new Date() })
      .where(eq(threatModels.id, id));

    return c.json(threat);
  }
);

// Update mitigation status (with ownership check)
app.patch(
  '/:id/threats/:threatId/mitigations/:mitigationId',
  zValidator(
    'json',
    z.object({
      status: z.enum(['proposed', 'accepted', 'implemented', 'rejected']).optional(),
      description: z.string().optional(),
    })
  ),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const threatId = c.req.param('threatId');
    const mitigationId = c.req.param('mitigationId');
    const body = c.req.valid('json');

    const [model] = await db
      .select()
      .from(threatModels)
      .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

    if (!model) {
      return c.json({ error: 'Threat model not found' }, 404);
    }

    const threats = (model.threats || []) as Array<{
      id: string;
      mitigations: Array<{ id: string; status: string; description: string }>;
      [key: string]: unknown;
    }>;

    const threat = threats.find((t) => t.id === threatId);
    if (!threat) {
      return c.json({ error: 'Threat not found' }, 404);
    }

    const mitigation = threat.mitigations.find((m) => m.id === mitigationId);
    if (!mitigation) {
      return c.json({ error: 'Mitigation not found' }, 404);
    }

    if (body.status !== undefined) mitigation.status = body.status;
    if (body.description !== undefined) mitigation.description = body.description;

    await db
      .update(threatModels)
      .set({ threats, updatedAt: new Date() })
      .where(eq(threatModels.id, id));

    return c.json(mitigation);
  }
);

// =============================================================================
// JIRA Ticket Routes
// =============================================================================

// Add JIRA ticket to threat model (with ownership check)
app.post(
  '/:id/jira-tickets',
  zValidator(
    'json',
    z.object({
      issueKeyOrUrl: z.string().min(1),
    })
  ),
  async (c) => {
    const { userId } = c.get('auth');
    const id = c.req.param('id');
    const { issueKeyOrUrl } = c.req.valid('json');

    // Check if model exists and user owns it
    const [model] = await db
      .select()
      .from(threatModels)
      .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

    if (!model) {
      return c.json({ error: 'Threat model not found' }, 404);
    }

    // Check if JIRA is configured
    if (!isJiraConfigured()) {
      return c.json(
        {
          error: 'JIRA is not configured. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN.',
        },
        400
      );
    }

    // Parse the input to get issue key
    const parsed = parseJiraUrl(issueKeyOrUrl);
    if (!parsed) {
      return c.json({ error: 'Invalid JIRA URL or issue key format' }, 400);
    }

    // Check if ticket already exists for this model
    const [existing] = await db
      .select()
      .from(jiraTickets)
      .where(
        and(
          eq(jiraTickets.threatModelId, id),
          eq(jiraTickets.issueKey, parsed.issueKey)
        )
      );

    if (existing) {
      return c.json({ error: `JIRA ticket ${parsed.issueKey} is already added to this model` }, 400);
    }

    // Fetch ticket data from JIRA
    try {
      const jiraService = getJiraService();
      const ticketData = await jiraService.fetchIssue(parsed.issueKey);

      // Save to database
      const [ticket] = await db
        .insert(jiraTickets)
        .values({
          threatModelId: id,
          issueKey: ticketData.issueKey,
          projectKey: ticketData.projectKey,
          title: ticketData.title,
          description: ticketData.description,
          issueType: ticketData.issueType,
          status: ticketData.status,
          priority: ticketData.priority,
          labels: ticketData.labels,
          reporter: ticketData.reporter,
          assignee: ticketData.assignee,
          comments: ticketData.comments,
          attachments: ticketData.attachments,
          linkedIssues: ticketData.linkedIssues,
          remoteLinks: ticketData.remoteLinks,
          jiraCreatedAt: ticketData.created,
          jiraUpdatedAt: ticketData.updated,
        })
        .returning();

      return c.json(
        {
          ...ticket,
          createdAt: ticket.createdAt.toISOString(),
        },
        201
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message.includes('401') || message.includes('Unauthorized')) {
        return c.json({ error: 'JIRA authentication failed' }, 401);
      }
      if (message.includes('403') || message.includes('Forbidden')) {
        return c.json({ error: 'No permission to access this JIRA issue' }, 403);
      }
      if (message.includes('404') || message.includes('not found')) {
        return c.json({ error: `JIRA issue ${parsed.issueKey} not found` }, 404);
      }

      return c.json({ error: `Failed to fetch JIRA issue: ${message}` }, 500);
    }
  }
);

// List JIRA tickets for a threat model (with ownership check)
app.get('/:id/jira-tickets', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');

  // Verify ownership
  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const tickets = await db
    .select()
    .from(jiraTickets)
    .where(eq(jiraTickets.threatModelId, id));

  return c.json(
    tickets.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

// Delete JIRA ticket from threat model (with ownership check)
app.delete('/:id/jira-tickets/:ticketId', async (c) => {
  const { userId } = c.get('auth');
  const id = c.req.param('id');
  const ticketId = c.req.param('ticketId');

  // Verify ownership
  const [model] = await db
    .select()
    .from(threatModels)
    .where(and(eq(threatModels.id, id), eq(threatModels.userId, userId)));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const [ticket] = await db
    .select()
    .from(jiraTickets)
    .where(eq(jiraTickets.id, ticketId));

  if (!ticket || ticket.threatModelId !== id) {
    return c.json({ error: 'JIRA ticket not found' }, 404);
  }

  await db.delete(jiraTickets).where(eq(jiraTickets.id, ticketId));

  return c.json({ success: true });
});

export default app;
