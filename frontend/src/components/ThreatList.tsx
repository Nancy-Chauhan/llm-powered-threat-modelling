import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Shield,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CATEGORY_LABELS,
  type RiskSeverity,
  type RiskCategory,
} from '@threat-modeling/shared';

interface Mitigation {
  id: string;
  description: string;
  priority: string;
  effort: string;
  status: string;
}

interface Threat {
  id: string;
  title: string;
  description: string;
  category: RiskCategory;
  severity: RiskSeverity;
  likelihood: number;
  impact: number;
  riskScore: number;
  affectedComponents: string[];
  attackVector?: string;
  mitigations: Mitigation[];
}

interface ThreatListProps {
  threats: Threat[];
  summary?: string;
  recommendations?: string[];
}

export function ThreatList({ threats, recommendations }: ThreatListProps) {
  const [expandedThreats, setExpandedThreats] = useState<Set<string>>(new Set());

  const toggleThreat = (id: string) => {
    setExpandedThreats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'info';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'immediate':
        return 'text-red-600';
      case 'short_term':
        return 'text-orange-500';
      default:
        return 'text-blue-500';
    }
  };

  const sortedThreats = [...threats].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Top {threats.length} Threats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedThreats.map((threat, index) => {
          const isExpanded = expandedThreats.has(threat.id);

          return (
            <div
              key={threat.id}
              className="border rounded-lg overflow-hidden"
            >
              <button
                className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => toggleThreat(threat.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">{threat.title}</h4>
                      <Badge variant={getSeverityVariant(threat.severity)}>
                        {threat.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        Risk: {threat.riskScore}/25
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {CATEGORY_LABELS[threat.category]} | L:{threat.likelihood} I:
                      {threat.impact}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t bg-muted/20">
                  <div className="pt-4 space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-1">Description</h5>
                      <p className="text-sm text-muted-foreground">
                        {threat.description}
                      </p>
                    </div>

                    {threat.attackVector && (
                      <div>
                        <h5 className="text-sm font-medium mb-1 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          Attack Vector
                        </h5>
                        <p className="text-sm text-muted-foreground">
                          {threat.attackVector}
                        </p>
                      </div>
                    )}

                    {threat.affectedComponents.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-1">
                          Affected Components
                        </h5>
                        <div className="flex flex-wrap gap-1">
                          {threat.affectedComponents.map((comp) => (
                            <Badge key={comp} variant="secondary">
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {threat.mitigations.length > 0 && (
                      <div>
                        <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Mitigations
                        </h5>
                        <div className="space-y-2">
                          {threat.mitigations.map((m) => (
                            <div
                              key={m.id}
                              className="text-sm p-2 bg-background rounded border"
                            >
                              <div className="flex items-start gap-2">
                                <span
                                  className={`text-xs font-medium ${getPriorityColor(
                                    m.priority
                                  )}`}
                                >
                                  [{m.priority.replace('_', ' ').toUpperCase()}]
                                </span>
                                <span className="flex-1">{m.description}</span>
                                <Badge variant="outline" className="text-xs">
                                  {m.effort} effort
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {recommendations && recommendations.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-medium mb-3">Key Recommendations</h4>
            <ol className="list-decimal list-inside space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
