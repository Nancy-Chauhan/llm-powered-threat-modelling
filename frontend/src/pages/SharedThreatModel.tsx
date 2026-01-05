import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield,
  Loader2,
  AlertTriangle,
  Download,
  FileText,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ThreatCard } from '@/components/ThreatCard';
import { apiFetch } from '@/lib/utils';
import { API_ROUTES } from '@threat-modeling/shared';
import type { ThreatModel } from '@threat-modeling/shared';

export function SharedThreatModel() {
  const { token } = useParams<{ token: string }>();
  const [model, setModel] = useState<ThreatModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSharedModel() {
      if (!token) return;
      try {
        const data = await apiFetch<ThreatModel>(API_ROUTES.shared.get(token));
        setModel(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load threat model');
      } finally {
        setIsLoading(false);
      }
    }

    fetchSharedModel();
  }, [token]);

  const handleExport = (format: 'pdf' | 'markdown' | 'json') => {
    if (!token) return;
    window.open(`/api/shared/${token}/export?format=${format}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground">
            {error || 'This threat model is not available or the link has expired.'}
          </p>
        </div>
      </div>
    );
  }

  const threats = model.threats || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-semibold">Threat Model (Shared View)</span>
          </div>
          <Button variant="outline" onClick={() => handleExport('markdown')}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{model.title}</h1>
            {model.description && (
              <p className="text-lg text-muted-foreground">{model.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <span>
                Generated:{' '}
                {model.generationCompletedAt
                  ? new Date(model.generationCompletedAt).toLocaleDateString()
                  : 'N/A'}
              </span>
              <span>{threats.length} threats identified</span>
            </div>
          </div>

          {/* Summary */}
          {model.summary && (
            <div className="p-6 bg-card border rounded-lg">
              <h2 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Executive Summary
              </h2>
              <p className="text-muted-foreground leading-relaxed">{model.summary}</p>
            </div>
          )}

          {/* Risk Overview */}
          {threats.length > 0 && (
            <div className="grid grid-cols-4 gap-4">
              {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
                const count = threats.filter((t) => t.severity === severity).length;
                return (
                  <div
                    key={severity}
                    className="p-4 bg-card border rounded-lg text-center"
                  >
                    <div className="text-3xl font-bold">{count}</div>
                    <SeverityBadge severity={severity} size="sm" />
                  </div>
                );
              })}
            </div>
          )}

          {/* Threats */}
          {threats.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Identified Threats</h2>
              <div className="space-y-4">
                {threats
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map((threat, index) => (
                    <ThreatCard
                      key={threat.id}
                      threat={threat}
                      rank={index + 1}
                      threatModelId={model.id}
                      readOnly
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {model.recommendations && model.recommendations.length > 0 && (
            <div className="p-6 bg-card border rounded-lg">
              <h2 className="font-semibold mb-3">General Recommendations</h2>
              <ul className="space-y-2">
                {model.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary font-medium">{index + 1}.</span>
                    <span className="text-muted-foreground">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-6 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Generated by Threat Modeling Dashboard
        </div>
      </footer>
    </div>
  );
}
