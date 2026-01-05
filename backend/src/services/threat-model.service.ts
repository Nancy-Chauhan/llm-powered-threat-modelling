import { eq, desc, like, and, sql } from 'drizzle-orm';
import { db, threatModels, contextFiles } from '../db';
import { nanoid } from 'nanoid';
import type {
  ThreatModel,
  ThreatModelSummary,
  CreateThreatModelRequest,
  UpdateThreatModelRequest,
  ThreatModelListResponse,
  ListThreatModelsParams,
} from '@threat-modeling/shared';

export class ThreatModelService {
  async list(params: ListThreatModelsParams = {}): Promise<ThreatModelListResponse> {
    const { page = 1, pageSize = 20, status, search } = params;
    const offset = (page - 1) * pageSize;

    const conditions = [];
    if (status) {
      conditions.push(eq(threatModels.status, status as any));
    }
    if (search) {
      conditions.push(like(threatModels.title, `%${search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(threatModels)
        .where(whereClause)
        .orderBy(desc(threatModels.updatedAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(threatModels)
        .where(whereClause),
    ]);

    const summaries: ThreatModelSummary[] = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? undefined,
      status: item.status as any,
      threatCount: (item.threats as any[])?.length ?? 0,
      highestSeverity: this.getHighestSeverity(item.threats as any[]),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      items: summaries,
      total: countResult[0]?.count ?? 0,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<ThreatModel | null> {
    const [model] = await db
      .select()
      .from(threatModels)
      .where(eq(threatModels.id, id))
      .limit(1);

    if (!model) return null;

    const files = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.threatModelId, id));

    return this.mapToThreatModel(model, files);
  }

  async getByShareToken(shareToken: string): Promise<ThreatModel | null> {
    const [model] = await db
      .select()
      .from(threatModels)
      .where(eq(threatModels.shareToken, shareToken))
      .limit(1);

    if (!model) return null;

    // Only return if public or has share token
    if (!model.isPublic && !model.shareToken) return null;

    const files = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.threatModelId, model.id));

    return this.mapToThreatModel(model, files);
  }

  async create(data: CreateThreatModelRequest): Promise<ThreatModel> {
    const [model] = await db
      .insert(threatModels)
      .values({
        title: data.title,
        description: data.description,
        systemDescription: data.systemDescription,
        status: 'draft',
      })
      .returning();

    return this.mapToThreatModel(model, []);
  }

  async update(id: string, data: UpdateThreatModelRequest): Promise<ThreatModel | null> {
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.systemDescription !== undefined) updateData.systemDescription = data.systemDescription;
    if (data.questionsAnswers !== undefined) updateData.questionsAnswers = data.questionsAnswers;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    const [model] = await db
      .update(threatModels)
      .set(updateData)
      .where(eq(threatModels.id, id))
      .returning();

    if (!model) return null;

    const files = await db
      .select()
      .from(contextFiles)
      .where(eq(contextFiles.threatModelId, id));

    return this.mapToThreatModel(model, files);
  }

  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(threatModels)
      .where(eq(threatModels.id, id))
      .returning({ id: threatModels.id });

    return result.length > 0;
  }

  async updateStatus(
    id: string,
    status: 'draft' | 'generating' | 'completed' | 'failed',
    error?: string
  ): Promise<void> {
    const updateData: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'generating') {
      updateData.generationStartedAt = new Date();
      updateData.generationError = null;
    } else if (status === 'completed') {
      updateData.generationCompletedAt = new Date();
    } else if (status === 'failed') {
      updateData.generationError = error;
    }

    await db.update(threatModels).set(updateData).where(eq(threatModels.id, id));
  }

  async updateThreats(
    id: string,
    threats: any[],
    summary?: string,
    recommendations?: string[]
  ): Promise<void> {
    await db
      .update(threatModels)
      .set({
        threats,
        summary,
        recommendations,
        updatedAt: new Date(),
      })
      .where(eq(threatModels.id, id));
  }

  async generateShareToken(id: string): Promise<string> {
    const token = nanoid(21);
    await db
      .update(threatModels)
      .set({ shareToken: token, updatedAt: new Date() })
      .where(eq(threatModels.id, id));
    return token;
  }

  async updateThreat(
    threatModelId: string,
    threatId: string,
    updates: { severity?: string; likelihood?: number; impact?: number }
  ): Promise<ThreatModel | null> {
    const model = await this.getById(threatModelId);
    if (!model) return null;

    const threats = model.threats.map((t: any) => {
      if (t.id === threatId) {
        const updated = { ...t };
        if (updates.severity !== undefined) updated.severity = updates.severity;
        if (updates.likelihood !== undefined) updated.likelihood = updates.likelihood;
        if (updates.impact !== undefined) updated.impact = updates.impact;
        if (updates.likelihood !== undefined || updates.impact !== undefined) {
          updated.riskScore = (updates.likelihood ?? t.likelihood) * (updates.impact ?? t.impact);
        }
        return updated;
      }
      return t;
    });

    await db
      .update(threatModels)
      .set({ threats, updatedAt: new Date() })
      .where(eq(threatModels.id, threatModelId));

    return this.getById(threatModelId);
  }

  async updateMitigation(
    threatModelId: string,
    threatId: string,
    mitigationId: string,
    updates: { status?: string; description?: string }
  ): Promise<ThreatModel | null> {
    const model = await this.getById(threatModelId);
    if (!model) return null;

    const threats = model.threats.map((t: any) => {
      if (t.id === threatId) {
        return {
          ...t,
          mitigations: t.mitigations.map((m: any) => {
            if (m.id === mitigationId) {
              return { ...m, ...updates };
            }
            return m;
          }),
        };
      }
      return t;
    });

    await db
      .update(threatModels)
      .set({ threats, updatedAt: new Date() })
      .where(eq(threatModels.id, threatModelId));

    return this.getById(threatModelId);
  }

  private mapToThreatModel(model: any, files: any[]): ThreatModel {
    return {
      id: model.id,
      title: model.title,
      description: model.description,
      status: model.status,
      organizationId: model.organizationId,
      createdBy: model.createdBy,
      createdAt: model.createdAt.toISOString(),
      updatedAt: model.updatedAt.toISOString(),
      systemDescription: model.systemDescription,
      questionsAnswers: model.questionsAnswers ?? [],
      contextFiles: files.map((f) => ({
        id: f.id,
        threatModelId: f.threatModelId,
        filename: f.filename,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size,
        fileType: f.fileType,
        storagePath: f.storagePath,
        createdAt: f.createdAt.toISOString(),
      })),
      threats: model.threats ?? [],
      summary: model.summary,
      recommendations: model.recommendations ?? [],
      shareToken: model.shareToken,
      isPublic: model.isPublic,
      generationStartedAt: model.generationStartedAt?.toISOString(),
      generationCompletedAt: model.generationCompletedAt?.toISOString(),
      generationError: model.generationError,
    };
  }

  private getHighestSeverity(threats: any[] | null): string | undefined {
    if (!threats || threats.length === 0) return undefined;
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    for (const severity of severityOrder) {
      if (threats.some((t) => t.severity === severity)) {
        return severity;
      }
    }
    return undefined;
  }
}

export const threatModelService = new ThreatModelService();
