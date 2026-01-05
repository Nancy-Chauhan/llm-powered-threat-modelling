import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq, desc, sql, ilike, and } from 'drizzle-orm';
import { db, threatModels, contextFiles } from '../db';
import { generateThreatModel } from '../services/threat-generation';
import { generateMarkdownReport, generateJsonExport } from '../services/pdf-export';
import { getDefaultStorageProvider } from '../storage';
import {
  CreateThreatModelRequestSchema,
  UpdateThreatModelRequestSchema,
  GUIDED_QUESTIONS,
} from '@threat-modeling/shared';

const app = new Hono();

// List threat models
app.get('/', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = parseInt(c.req.query('pageSize') || '20');
  const status = c.req.query('status');
  const search = c.req.query('search');

  const offset = (page - 1) * pageSize;

  let whereClause = undefined;
  const conditions = [];

  if (status) {
    conditions.push(eq(threatModels.status, status as 'draft' | 'generating' | 'completed' | 'failed'));
  }
  if (search) {
    conditions.push(ilike(threatModels.title, `%${search}%`));
  }

  if (conditions.length > 0) {
    whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: threatModels.id,
        title: threatModels.title,
        description: threatModels.description,
        status: threatModels.status,
        threats: threatModels.threats,
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

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      threatCount: threats.length,
      highestSeverity,
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

// Get single threat model
app.get('/:id', async (c) => {
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const files = await db
    .select()
    .from(contextFiles)
    .where(eq(contextFiles.threatModelId, id));

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
  });
});

// Create threat model
app.post('/', zValidator('json', CreateThreatModelRequestSchema), async (c) => {
  const body = c.req.valid('json');

  const [model] = await db
    .insert(threatModels)
    .values({
      title: body.title,
      description: body.description,
      systemDescription: body.systemDescription,
      status: 'draft',
    })
    .returning();

  return c.json({
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  }, 201);
});

// Update threat model
app.patch('/:id', zValidator('json', UpdateThreatModelRequestSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const [existing] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

  if (!existing) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  const [model] = await db
    .update(threatModels)
    .set({
      ...body,
      updatedAt: new Date(),
    })
    .where(eq(threatModels.id, id))
    .returning();

  return c.json({
    ...model,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
  });
});

// Delete threat model
app.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

  if (!existing) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  await db.delete(threatModels).where(eq(threatModels.id, id));

  return c.json({ success: true });
});

// Generate threat model
app.post('/:id/generate', async (c) => {
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  if (model.status === 'generating') {
    return c.json({ error: 'Generation already in progress' }, 400);
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

// Get generation status
app.get('/:id/generation-status', async (c) => {
  const id = c.req.param('id');

  const [model] = await db
    .select({
      status: threatModels.status,
      generationError: threatModels.generationError,
    })
    .from(threatModels)
    .where(eq(threatModels.id, id));

  if (!model) {
    return c.json({ error: 'Threat model not found' }, 404);
  }

  return c.json({
    status: model.status,
    error: model.generationError,
    progress: model.status === 'generating' ? 50 : model.status === 'completed' ? 100 : 0,
  });
});

// Create share link
app.post('/:id/share', async (c) => {
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

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

// Export threat model
app.get('/:id/export', async (c) => {
  const id = c.req.param('id');
  const format = c.req.query('format') || 'markdown';

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

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

  // Default to markdown
  const markdown = generateMarkdownReport(model, files);

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown',
      'Content-Disposition': `attachment; filename="${model.title.replace(/[^a-z0-9]/gi, '_')}_threat_model.md"`,
    },
  });
});

// Upload context file
// Files are stored via storage provider (local/S3) and sent to LLM via URL
app.post('/:id/files', async (c) => {
  const id = c.req.param('id');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.id, id));

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

// Delete context file
app.delete('/:id/files/:fileId', async (c) => {
  const id = c.req.param('id');
  const fileId = c.req.param('fileId');

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

// Update threat within a model
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
    const id = c.req.param('id');
    const threatId = c.req.param('threatId');
    const body = c.req.valid('json');

    const [model] = await db
      .select()
      .from(threatModels)
      .where(eq(threatModels.id, id));

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

// Update mitigation status
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
    const id = c.req.param('id');
    const threatId = c.req.param('threatId');
    const mitigationId = c.req.param('mitigationId');
    const body = c.req.valid('json');

    const [model] = await db
      .select()
      .from(threatModels)
      .where(eq(threatModels.id, id));

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

export default app;
