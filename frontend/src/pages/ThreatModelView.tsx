import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Share2,
  Download,
  Loader2,
  AlertTriangle,
  Shield,
  FileText,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useThreatModelStore } from '@/store/threat-model-store';
import { StatusBadge } from '@/components/StatusBadge';
import { ThreatCard } from '@/components/ThreatCard';
import { getAuthToken } from '@/lib/auth';

export function ThreatModelView() {
  const { id } = useParams<{ id: string }>();
  const {
    currentModel,
    isLoadingModel,
    error,
    fetchThreatModel,
    createShareLink,
    deleteShareLink,
    generateThreatModel,
    pollGenerationStatus,
    generationStatus,
    isGenerating,
  } = useThreatModelStore();

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContext, setShowContext] = useState(false);

  useEffect(() => {
    if (id) {
      fetchThreatModel(id);
    }
  }, [id, fetchThreatModel]);

  // Poll generation status
  useEffect(() => {
    if (!id || !isGenerating) return;

    const interval = setInterval(() => {
      pollGenerationStatus(id);
    }, 2000);

    return () => clearInterval(interval);
  }, [id, isGenerating, pollGenerationStatus]);

  const handleShare = async () => {
    if (!id) return;
    try {
      const result = await createShareLink(id);
      setShareUrl(result.shareUrl);
      toast.success('Share link generated');
    } catch (err) {
      console.error('Failed to create share link:', err);
      toast.error('Failed to generate share link');
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Link copied to clipboard');
    }
  };

  const handleDeleteShare = async () => {
    if (!id) return;
    try {
      await deleteShareLink(id);
      setShareUrl(null);
      toast.success('Share link deleted');
    } catch (err) {
      console.error('Failed to delete share link:', err);
      toast.error('Failed to delete share link');
    }
  };

  const handleExport = async () => {
    if (!id) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/threat-models/${id}/export?format=pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const filename = currentModel?.title
        ? `${currentModel.title.replace(/[^a-z0-9]/gi, '_')}_threat_model.pdf`
        : `threat_model.pdf`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleRegenerate = async () => {
    if (!id) return;
    await generateThreatModel(id);
  };

  if (isLoadingModel) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !currentModel) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Threat Model</h2>
        <p className="text-muted-foreground mb-4">{error || 'Threat model not found'}</p>
        <Link to="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  const threats = currentModel.threats || [];
  const isProcessing = currentModel.status === 'generating' || isGenerating;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to List
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{currentModel.title}</h1>
            <StatusBadge status={currentModel.status} />
          </div>
          {currentModel.description && (
            <p className="text-muted-foreground mt-1">{currentModel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentModel.status === 'completed' && (
            <>
              <Button variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <div className="relative">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </>
          )}
          {(currentModel.status === 'draft' || currentModel.status === 'failed') && (
            <Button onClick={handleRegenerate} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Threats
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Share URL */}
      {shareUrl && (
        <div className="p-4 bg-muted rounded-lg flex items-center gap-3">
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
          <code className="flex-1 text-sm truncate">{shareUrl}</code>
          <Button size="sm" variant="outline" onClick={handleCopyLink}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDeleteShare}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="p-6 bg-card border rounded-lg text-center">
          <Loader2 className="h-10 w-10 mx-auto mb-4 animate-spin text-primary" />
          <h3 className="font-medium mb-2">Generating Threat Model</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {generationStatus?.message || 'Analyzing your system...'}
          </p>
          <div className="w-full max-w-xs mx-auto bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${generationStatus?.progress || 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Failed Status */}
      {currentModel.status === 'failed' && currentModel.generationError && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Generation Failed</span>
          </div>
          <p className="text-sm">{currentModel.generationError}</p>
        </div>
      )}

      {/* Summary */}
      {currentModel.summary && (
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Executive Summary
          </h2>
          <p className="text-muted-foreground">{currentModel.summary}</p>
        </div>
      )}

      {/* Threats Overview */}
      {threats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top {threats.length} Threats</h2>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Critical:{' '}
                <strong className="text-severity-critical">
                  {threats.filter((t) => t.severity === 'critical').length}
                </strong>
              </span>
              <span>
                High:{' '}
                <strong className="text-severity-high">
                  {threats.filter((t) => t.severity === 'high').length}
                </strong>
              </span>
              <span>
                Medium:{' '}
                <strong className="text-severity-medium">
                  {threats.filter((t) => t.severity === 'medium').length}
                </strong>
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {threats
              .sort((a, b) => b.riskScore - a.riskScore)
              .map((threat, index) => (
                <ThreatCard
                  key={threat.id}
                  threat={threat}
                  rank={index + 1}
                  threatModelId={currentModel.id}
                />
              ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {currentModel.recommendations && currentModel.recommendations.length > 0 && (
        <div className="p-6 bg-card border rounded-lg">
          <h2 className="font-semibold mb-3">General Recommendations</h2>
          <ul className="space-y-2">
            {currentModel.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary font-medium">{index + 1}.</span>
                <span className="text-muted-foreground">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Context Section */}
      <div className="border rounded-lg">
        <button
          onClick={() => setShowContext(!showContext)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <span className="font-medium">Context Information</span>
          {showContext ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {showContext && (
          <div className="p-4 pt-0 space-y-4">
            {currentModel.systemDescription && (
              <div>
                <h4 className="text-sm font-medium mb-2">System Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {currentModel.systemDescription}
                </p>
              </div>
            )}
            {currentModel.questionsAnswers && currentModel.questionsAnswers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Questionnaire Responses ({currentModel.questionsAnswers.length})
                </h4>
                <div className="space-y-3">
                  {currentModel.questionsAnswers.map((qa: any, index: number) => (
                    <div key={index} className="text-sm">
                      <p className="font-medium">{qa.question}</p>
                      <p className="text-muted-foreground">{qa.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {currentModel.contextFiles && currentModel.contextFiles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Uploaded Files ({currentModel.contextFiles.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentModel.contextFiles.map((file: any) => (
                    <span
                      key={file.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm"
                    >
                      <FileText className="h-3 w-3" />
                      {file.originalName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
