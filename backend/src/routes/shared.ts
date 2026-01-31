import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db, threatModels, contextFiles } from '../db';
import { generateMarkdownReport, generateJsonExport, generatePdfReport } from '../services/pdf-export';

const app = new Hono();

// Get shared threat model by token
app.get('/:token', async (c) => {
  const token = c.req.param('token');

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.shareToken, token));

  if (!model || !model.isPublic) {
    return c.json({ error: 'Threat model not found or not shared' }, 404);
  }

  const files = await db
    .select({
      id: contextFiles.id,
      filename: contextFiles.filename,
      originalName: contextFiles.originalName,
      fileType: contextFiles.fileType,
      createdAt: contextFiles.createdAt,
    })
    .from(contextFiles)
    .where(eq(contextFiles.threatModelId, model.id));

  // Return limited view for shared models
  return c.json({
    id: model.id,
    title: model.title,
    description: model.description,
    status: model.status,
    systemDescription: model.systemDescription,
    threats: model.threats,
    summary: model.summary,
    recommendations: model.recommendations,
    createdAt: model.createdAt.toISOString(),
    generationCompletedAt: model.generationCompletedAt?.toISOString(),
    contextFiles: files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      fileType: f.fileType,
    })),
  });
});

// Export shared threat model
app.get('/:token/export', async (c) => {
  const token = c.req.param('token');
  const format = c.req.query('format') || 'pdf';

  const [model] = await db
    .select()
    .from(threatModels)
    .where(eq(threatModels.shareToken, token));

  if (!model || !model.isPublic) {
    return c.json({ error: 'Threat model not found or not shared' }, 404);
  }

  const files = await db
    .select()
    .from(contextFiles)
    .where(eq(contextFiles.threatModelId, model.id));

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

export default app;
