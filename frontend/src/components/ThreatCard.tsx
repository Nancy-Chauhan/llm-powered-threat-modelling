import { useState } from 'react';
import { ChevronDown, ChevronUp, Shield, Target, CheckCircle2, Circle, Clock } from 'lucide-react';
import { SeverityBadge } from '@/components/SeverityBadge';
import { useThreatModelStore } from '@/store/threat-model-store';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS } from '@threat-modeling/shared';

interface ThreatCardProps {
  threat: any;
  rank: number;
  threatModelId: string;
  readOnly?: boolean;
}

const mitigationStatusIcons: Record<string, React.ReactNode> = {
  proposed: <Circle className="h-4 w-4 text-gray-400" />,
  accepted: <Clock className="h-4 w-4 text-blue-500" />,
  implemented: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  rejected: <Circle className="h-4 w-4 text-red-400 line-through" />,
};

export function ThreatCard({ threat, rank, threatModelId, readOnly = false }: ThreatCardProps) {
  const [isExpanded, setIsExpanded] = useState(rank <= 2); // Expand top 2 by default
  const { updateMitigation } = useThreatModelStore();

  const handleMitigationStatusChange = async (mitigationId: string, status: string) => {
    if (readOnly) return;
    await updateMitigation(threatModelId, threat.id, mitigationId, { status });
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
            threat.severity === 'critical'
              ? 'bg-severity-critical text-white'
              : threat.severity === 'high'
              ? 'bg-severity-high text-white'
              : threat.severity === 'medium'
              ? 'bg-severity-medium text-white'
              : 'bg-severity-low text-white'
          )}
        >
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium">{threat.title}</h3>
            <SeverityBadge severity={threat.severity} size="sm" />
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>
              {CATEGORY_LABELS[threat.category as keyof typeof CATEGORY_LABELS] || threat.category}
            </span>
            <span>Risk Score: {threat.riskScore}/25</span>
            <span>
              {threat.mitigations?.length || 0} mitigations
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold">{threat.riskScore}</div>
            <div className="text-xs text-muted-foreground">Risk Score</div>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t bg-muted/30">
          <div className="pt-4">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Description
            </h4>
            <p className="text-sm text-muted-foreground">{threat.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Risk Assessment</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Likelihood</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'w-4 h-4 rounded',
                          level <= threat.likelihood
                            ? 'bg-primary'
                            : 'bg-muted'
                        )}
                      />
                    ))}
                    <span className="ml-2">{threat.likelihood}/5</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Impact</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'w-4 h-4 rounded',
                          level <= threat.impact
                            ? 'bg-primary'
                            : 'bg-muted'
                        )}
                      />
                    ))}
                    <span className="ml-2">{threat.impact}/5</span>
                  </div>
                </div>
              </div>
            </div>

            {threat.affectedComponents && threat.affectedComponents.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Affected Components
                </h4>
                <div className="flex flex-wrap gap-1">
                  {threat.affectedComponents.map((component: string, index: number) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-muted rounded text-xs"
                    >
                      {component}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {threat.attackVector && (
            <div>
              <h4 className="text-sm font-medium mb-2">Attack Vector</h4>
              <p className="text-sm text-muted-foreground">{threat.attackVector}</p>
            </div>
          )}

          {/* Mitigations */}
          {threat.mitigations && threat.mitigations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-3">Mitigations</h4>
              <div className="space-y-2">
                {threat.mitigations.map((mitigation: any) => (
                  <div
                    key={mitigation.id}
                    className="flex items-start gap-3 p-3 bg-background border rounded-md"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (readOnly) return;
                        const statusMap: Record<string, string> = {
                          proposed: 'accepted',
                          accepted: 'implemented',
                          implemented: 'proposed',
                          rejected: 'proposed',
                        };
                        const nextStatus = statusMap[mitigation.status as string] || 'proposed';
                        handleMitigationStatusChange(mitigation.id, nextStatus);
                      }}
                      className={cn(
                        'mt-0.5',
                        readOnly ? 'cursor-default' : 'cursor-pointer hover:opacity-70'
                      )}
                      disabled={readOnly}
                    >
                      {mitigationStatusIcons[mitigation.status]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{mitigation.description}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded',
                            mitigation.priority === 'immediate'
                              ? 'bg-red-100 text-red-700'
                              : mitigation.priority === 'short_term'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          )}
                        >
                          {mitigation.priority.replace('_', ' ')}
                        </span>
                        <span>Effort: {mitigation.effort}</span>
                        <span className="capitalize">{mitigation.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
