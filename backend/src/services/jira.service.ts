import { Version3Client } from 'jira.js';

// =============================================================================
// Types
// =============================================================================

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: string;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface JiraLinkedIssue {
  issueKey: string;
  title: string;
  linkType: string;
  direction: 'inward' | 'outward';
}

export interface JiraRemoteLink {
  title: string;
  url: string;
}

export interface JiraTicketData {
  issueId: string;
  issueKey: string;
  projectKey: string;
  title: string;
  description: string | null;
  issueType: string;
  status: string;
  priority: string | null;
  labels: string[];
  reporter: { displayName: string; email?: string } | null;
  assignee: { displayName: string; email?: string } | null;
  comments: JiraComment[];
  attachments: JiraAttachment[];
  linkedIssues: JiraLinkedIssue[];
  remoteLinks: JiraRemoteLink[];
  created: string;
  updated: string;
}

export interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
}

// =============================================================================
// JIRA URL Parser
// =============================================================================

export interface ParsedJiraUrl {
  host: string | null;
  issueKey: string;
  projectKey: string;
}

export function parseJiraUrl(input: string): ParsedJiraUrl | null {
  // Trim whitespace
  input = input.trim();

  // Pattern 1: Full browse URL
  // https://company.atlassian.net/browse/PROJ-123
  const browsePattern = /^(https?:\/\/[^\/]+)\/browse\/([A-Z][A-Z0-9]+-\d+)$/i;

  // Pattern 2: Board URL with selected issue
  // https://company.atlassian.net/jira/software/projects/PROJ/boards/1?selectedIssue=PROJ-123
  const boardPattern =
    /^(https?:\/\/[^\/]+)\/jira\/.*[?&]selectedIssue=([A-Z][A-Z0-9]+-\d+)/i;

  // Pattern 3: Just issue key
  // PROJ-123
  const keyPattern = /^([A-Z][A-Z0-9]+-\d+)$/i;

  let match = input.match(browsePattern);
  if (match) {
    const issueKey = match[2].toUpperCase();
    return {
      host: match[1],
      issueKey,
      projectKey: issueKey.split('-')[0],
    };
  }

  match = input.match(boardPattern);
  if (match) {
    const issueKey = match[2].toUpperCase();
    return {
      host: match[1],
      issueKey,
      projectKey: issueKey.split('-')[0],
    };
  }

  match = input.match(keyPattern);
  if (match) {
    const issueKey = match[1].toUpperCase();
    return {
      host: null, // Host needs to come from env config
      issueKey,
      projectKey: issueKey.split('-')[0],
    };
  }

  return null;
}

// =============================================================================
// JIRA Service
// =============================================================================

export class JiraService {
  private client: Version3Client;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
    this.client = new Version3Client({
      host: config.host,
      authentication: {
        basic: {
          email: config.email,
          apiToken: config.apiToken,
        },
      },
    });
  }

  /**
   * Test the JIRA connection by fetching current user
   */
  async testConnection(): Promise<{ success: boolean; user?: string; error?: string }> {
    try {
      const user = await this.client.myself.getCurrentUser();
      return {
        success: true,
        user: user.displayName || user.emailAddress || 'Unknown',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch a JIRA issue with all related data
   */
  async fetchIssue(issueKey: string): Promise<JiraTicketData> {
    // Fetch main issue with all fields
    const issue = await this.client.issues.getIssue({
      issueIdOrKey: issueKey,
      fields: ['*all'],
      expand: ['renderedFields'],
    });

    // Fetch comments
    let comments: JiraComment[] = [];
    try {
      const commentsResponse = await this.client.issueComments.getComments({
        issueIdOrKey: issueKey,
        orderBy: '-created',
        maxResults: 100,
      });
      comments = (commentsResponse.comments || []).map((c) => ({
        id: c.id || '',
        author: c.author?.displayName || 'Unknown',
        body: (c as any).renderedBody || c.body || '',
        created: c.created || '',
      }));
    } catch (e) {
      console.warn('Could not fetch comments:', e);
    }

    // Fetch remote links
    let remoteLinks: JiraRemoteLink[] = [];
    try {
      const links = await this.client.issueRemoteLinks.getRemoteIssueLinks({
        issueIdOrKey: issueKey,
      });
      remoteLinks = (links || []).map((rl) => ({
        title: (rl as any).object?.title || 'Link',
        url: (rl as any).object?.url || '',
      }));
    } catch (e) {
      console.warn('Could not fetch remote links:', e);
    }

    // Extract linked issues from issue links
    const linkedIssues = this.extractLinkedIssues(issue.fields?.issuelinks || []);

    // Extract attachments
    const attachments: JiraAttachment[] = (issue.fields?.attachment || []).map((a: any) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      url: a.content,
    }));

    return {
      issueId: issue.id || '',
      issueKey: issue.key || issueKey,
      projectKey: issueKey.split('-')[0],
      title: issue.fields?.summary || '',
      description:
        (issue as any).renderedFields?.description || issue.fields?.description || null,
      issueType: issue.fields?.issuetype?.name || 'Unknown',
      status: issue.fields?.status?.name || 'Unknown',
      priority: issue.fields?.priority?.name || null,
      labels: issue.fields?.labels || [],
      reporter: issue.fields?.reporter
        ? {
            displayName: issue.fields.reporter.displayName || 'Unknown',
            email: issue.fields.reporter.emailAddress,
          }
        : null,
      assignee: issue.fields?.assignee
        ? {
            displayName: issue.fields.assignee.displayName || 'Unknown',
            email: issue.fields.assignee.emailAddress,
          }
        : null,
      comments,
      attachments,
      linkedIssues,
      remoteLinks,
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    };
  }

  /**
   * Extract linked issues from issue links array
   */
  private extractLinkedIssues(issueLinks: any[]): JiraLinkedIssue[] {
    return issueLinks.flatMap((link) => {
      const results: JiraLinkedIssue[] = [];

      if (link.inwardIssue) {
        results.push({
          issueKey: link.inwardIssue.key,
          title: link.inwardIssue.fields?.summary || '',
          linkType: link.type?.inward || 'related to',
          direction: 'inward',
        });
      }

      if (link.outwardIssue) {
        results.push({
          issueKey: link.outwardIssue.key,
          title: link.outwardIssue.fields?.summary || '',
          linkType: link.type?.outward || 'related to',
          direction: 'outward',
        });
      }

      return results;
    });
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

let jiraServiceInstance: JiraService | null = null;

/**
 * Get the default JIRA service instance from env vars
 */
export function getJiraService(): JiraService {
  if (jiraServiceInstance) {
    return jiraServiceInstance;
  }

  const host = process.env.JIRA_HOST;
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;

  if (!host || !email || !apiToken) {
    throw new Error(
      'JIRA configuration is incomplete. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.'
    );
  }

  jiraServiceInstance = new JiraService({ host, email, apiToken });
  return jiraServiceInstance;
}

/**
 * Check if JIRA is configured
 */
export function isJiraConfigured(): boolean {
  return !!(process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);
}

/**
 * Build context string from JIRA ticket data for LLM consumption
 */
export function buildJiraContext(ticket: JiraTicketData): string {
  let context = `## JIRA Ticket: ${ticket.issueKey}\n\n`;
  context += `**Title:** ${ticket.title}\n`;
  context += `**Type:** ${ticket.issueType}\n`;
  context += `**Status:** ${ticket.status}\n`;
  context += `**Priority:** ${ticket.priority || 'Not set'}\n\n`;

  if (ticket.description) {
    context += `### Description\n${ticket.description}\n\n`;
  }

  if (ticket.labels.length > 0) {
    context += `**Labels:** ${ticket.labels.join(', ')}\n\n`;
  }

  if (ticket.reporter) {
    context += `**Reporter:** ${ticket.reporter.displayName}\n`;
  }
  if (ticket.assignee) {
    context += `**Assignee:** ${ticket.assignee.displayName}\n`;
  }
  context += '\n';

  // Add comments
  if (ticket.comments.length > 0) {
    context += `### Comments (${ticket.comments.length})\n\n`;
    for (const comment of ticket.comments) {
      context += `**${comment.author}** (${comment.created}):\n`;
      context += `${comment.body}\n\n`;
    }
  }

  // Add linked issues
  if (ticket.linkedIssues.length > 0) {
    context += `### Linked Issues\n`;
    for (const link of ticket.linkedIssues) {
      context += `- ${link.linkType}: ${link.issueKey} - ${link.title}\n`;
    }
    context += '\n';
  }

  // Add external links
  if (ticket.remoteLinks.length > 0) {
    context += `### External Links\n`;
    for (const link of ticket.remoteLinks) {
      context += `- [${link.title}](${link.url})\n`;
    }
    context += '\n';
  }

  // Add attachments list
  if (ticket.attachments.length > 0) {
    context += `### Attachments\n`;
    for (const att of ticket.attachments) {
      context += `- ${att.filename} (${att.mimeType}, ${formatBytes(att.size)})\n`;
    }
    context += '\n';
  }

  return context;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
