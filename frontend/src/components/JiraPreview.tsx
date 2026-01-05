import { X, MessageSquare, Paperclip, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JiraTicket } from './JiraInput';

interface JiraPreviewProps {
  ticket: JiraTicket;
  onRemove?: () => void;
}

export function JiraPreview({ ticket, onRemove }: JiraPreviewProps) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
              {ticket.issueKey}
            </span>
            <span className="text-xs text-muted-foreground">{ticket.issueType}</span>
            <StatusPill status={ticket.status} />
            {ticket.priority && (
              <span className="text-xs text-muted-foreground">
                Priority: {ticket.priority}
              </span>
            )}
          </div>

          <h4 className="font-medium mt-2 truncate">{ticket.title}</h4>

          {ticket.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {stripHtml(ticket.description)}
            </p>
          )}

          {ticket.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {ticket.labels.map((label) => (
                <span
                  key={label}
                  className="text-xs bg-muted px-1.5 py-0.5 rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Context summary */}
      <div className="mt-3 pt-3 border-t flex flex-wrap gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>{ticket.comments.length} comments</span>
        </div>
        <div className="flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" />
          <span>{ticket.attachments.length} attachments</span>
        </div>
        <div className="flex items-center gap-1">
          <Link2 className="h-3.5 w-3.5" />
          <span>{ticket.linkedIssues.length} linked issues</span>
        </div>
        <div className="flex items-center gap-1">
          <ExternalLink className="h-3.5 w-3.5" />
          <span>{ticket.remoteLinks.length} links</span>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const statusLower = status.toLowerCase();
  let bgColor = 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

  if (statusLower.includes('done') || statusLower.includes('closed') || statusLower.includes('resolved')) {
    bgColor = 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
  } else if (statusLower.includes('progress') || statusLower.includes('review')) {
    bgColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  } else if (statusLower.includes('blocked')) {
    bgColor = 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${bgColor}`}>
      {status}
    </span>
  );
}

function stripHtml(html: string): string {
  // Simple HTML stripping - for display purposes only
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
