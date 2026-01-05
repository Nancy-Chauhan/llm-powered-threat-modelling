import type { ThreatModel } from '@threat-modeling/shared';
import { SEVERITY_COLORS, CATEGORY_LABELS } from '@threat-modeling/shared';

export class ExportService {
  async exportToJson(model: ThreatModel): Promise<string> {
    return JSON.stringify(model, null, 2);
  }

  async exportToMarkdown(model: ThreatModel): Promise<string> {
    const lines: string[] = [];

    // Header
    lines.push(`# Threat Model: ${model.title}`);
    lines.push('');
    lines.push(`**Status:** ${model.status}`);
    lines.push(`**Created:** ${new Date(model.createdAt).toLocaleDateString()}`);
    lines.push(`**Last Updated:** ${new Date(model.updatedAt).toLocaleDateString()}`);
    lines.push('');

    // Description
    if (model.description) {
      lines.push('## Description');
      lines.push('');
      lines.push(model.description);
      lines.push('');
    }

    // Summary
    if (model.summary) {
      lines.push('## Executive Summary');
      lines.push('');
      lines.push(model.summary);
      lines.push('');
    }

    // Threats
    if (model.threats && model.threats.length > 0) {
      lines.push('## Identified Threats');
      lines.push('');

      for (const threat of model.threats) {
        lines.push(`### ${threat.title}`);
        lines.push('');
        lines.push(`**Severity:** ${threat.severity.toUpperCase()}`);
        lines.push(`**Category:** ${CATEGORY_LABELS[threat.category as keyof typeof CATEGORY_LABELS] ?? threat.category}`);
        lines.push(`**Risk Score:** ${threat.riskScore}/25 (Likelihood: ${threat.likelihood}, Impact: ${threat.impact})`);
        lines.push('');
        lines.push('**Description:**');
        lines.push(threat.description);
        lines.push('');

        if (threat.affectedComponents && threat.affectedComponents.length > 0) {
          lines.push('**Affected Components:**');
          for (const component of threat.affectedComponents) {
            lines.push(`- ${component}`);
          }
          lines.push('');
        }

        if (threat.attackVector) {
          lines.push('**Attack Vector:**');
          lines.push(threat.attackVector);
          lines.push('');
        }

        if (threat.mitigations && threat.mitigations.length > 0) {
          lines.push('**Mitigations:**');
          lines.push('');
          lines.push('| Mitigation | Priority | Effort | Status |');
          lines.push('|------------|----------|--------|--------|');
          for (const m of threat.mitigations) {
            lines.push(`| ${m.description} | ${m.priority} | ${m.effort} | ${m.status} |`);
          }
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      }
    }

    // Recommendations
    if (model.recommendations && model.recommendations.length > 0) {
      lines.push('## General Recommendations');
      lines.push('');
      for (const rec of model.recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  async exportToPdf(model: ThreatModel): Promise<Buffer> {
    // Generate HTML first
    const html = this.generatePdfHtml(model);

    // For a lightweight approach without heavy deps, we'll return HTML
    // that can be rendered/printed as PDF by the browser
    // In production, you'd use puppeteer or similar
    return Buffer.from(html, 'utf-8');
  }

  private generatePdfHtml(model: ThreatModel): string {
    const threats = model.threats ?? [];

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Threat Model: ${this.escapeHtml(model.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      line-height: 1.6;
    }
    h1 { color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
    h2 { color: #334155; margin-top: 30px; }
    h3 { color: #475569; }
    .meta { color: #64748b; font-size: 14px; margin-bottom: 20px; }
    .summary { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .threat {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      page-break-inside: avoid;
    }
    .threat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .severity {
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: white;
    }
    .severity-critical { background: ${SEVERITY_COLORS.critical}; }
    .severity-high { background: ${SEVERITY_COLORS.high}; }
    .severity-medium { background: ${SEVERITY_COLORS.medium}; }
    .severity-low { background: ${SEVERITY_COLORS.low}; }
    .severity-info { background: ${SEVERITY_COLORS.info}; }
    .risk-score {
      font-size: 24px;
      font-weight: bold;
      color: #0f172a;
    }
    .risk-label { font-size: 12px; color: #64748b; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
    }
    th { background: #f8fafc; font-weight: 600; }
    .components { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
    .component {
      background: #e0f2fe;
      color: #0369a1;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .recommendations { background: #f0fdf4; padding: 20px; border-radius: 8px; margin-top: 30px; }
    .recommendations ul { margin: 10px 0; padding-left: 20px; }
    @media print {
      body { padding: 20px; }
      .threat { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Threat Model: ${this.escapeHtml(model.title)}</h1>
  <div class="meta">
    <strong>Status:</strong> ${model.status} |
    <strong>Created:</strong> ${new Date(model.createdAt).toLocaleDateString()} |
    <strong>Last Updated:</strong> ${new Date(model.updatedAt).toLocaleDateString()}
  </div>

  ${model.description ? `<p>${this.escapeHtml(model.description)}</p>` : ''}

  ${model.summary ? `
  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${this.escapeHtml(model.summary)}</p>
  </div>
  ` : ''}

  <h2>Top ${threats.length} Identified Threats</h2>

  ${threats.map((threat, index) => `
  <div class="threat">
    <div class="threat-header">
      <div>
        <h3>#${index + 1} ${this.escapeHtml(threat.title)}</h3>
        <span class="severity severity-${threat.severity}">${threat.severity}</span>
      </div>
      <div style="text-align: right;">
        <div class="risk-score">${threat.riskScore}/25</div>
        <div class="risk-label">Risk Score</div>
      </div>
    </div>

    <p><strong>Category:</strong> ${CATEGORY_LABELS[threat.category as keyof typeof CATEGORY_LABELS] ?? threat.category}</p>
    <p><strong>Likelihood:</strong> ${threat.likelihood}/5 | <strong>Impact:</strong> ${threat.impact}/5</p>

    <p>${this.escapeHtml(threat.description)}</p>

    ${threat.affectedComponents && threat.affectedComponents.length > 0 ? `
    <p><strong>Affected Components:</strong></p>
    <div class="components">
      ${threat.affectedComponents.map(c => `<span class="component">${this.escapeHtml(c)}</span>`).join('')}
    </div>
    ` : ''}

    ${threat.attackVector ? `
    <p><strong>Attack Vector:</strong></p>
    <p>${this.escapeHtml(threat.attackVector)}</p>
    ` : ''}

    ${threat.mitigations && threat.mitigations.length > 0 ? `
    <p><strong>Mitigations:</strong></p>
    <table>
      <thead>
        <tr>
          <th>Mitigation</th>
          <th>Priority</th>
          <th>Effort</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${threat.mitigations.map(m => `
        <tr>
          <td>${this.escapeHtml(m.description)}</td>
          <td>${m.priority}</td>
          <td>${m.effort}</td>
          <td>${m.status}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  </div>
  `).join('')}

  ${model.recommendations && model.recommendations.length > 0 ? `
  <div class="recommendations">
    <h2>General Recommendations</h2>
    <ul>
      ${model.recommendations.map(r => `<li>${this.escapeHtml(r)}</li>`).join('')}
    </ul>
  </div>
  ` : ''}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px;">
    Generated by Threat Modeling Dashboard on ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export const exportService = new ExportService();
