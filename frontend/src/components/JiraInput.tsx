import { useState } from 'react';
import { Loader2, Link, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface JiraInputProps {
  onTicketAdded: (ticket: JiraTicket) => void;
  disabled?: boolean;
}

export interface JiraTicket {
  id: string;
  issueKey: string;
  projectKey: string;
  title: string;
  description: string | null;
  issueType: string;
  status: string;
  priority: string | null;
  labels: string[];
  comments: Array<{ id: string; author: string; body: string; created: string }>;
  attachments: Array<{ id: string; filename: string; mimeType: string; size: number }>;
  linkedIssues: Array<{ issueKey: string; title: string; linkType: string }>;
  remoteLinks: Array<{ title: string; url: string }>;
}

export function JiraInput({ onTicketAdded, disabled }: JiraInputProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // First check if JIRA is configured
      const statusRes = await fetch('/api/jira/status');
      const statusData = await statusRes.json();

      if (!statusData.configured) {
        setError('JIRA is not configured. Please set JIRA_HOST, JIRA_EMAIL, and JIRA_API_TOKEN in the server environment.');
        setIsLoading(false);
        return;
      }

      // Fetch the ticket
      const res = await fetch('/api/jira/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKeyOrUrl: input.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to fetch JIRA ticket');
        setIsLoading(false);
        return;
      }

      onTicketAdded(data.ticket);
      setInput('');
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading && input.trim()) {
      handleFetch();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter JIRA URL or ticket key (e.g., PROJ-123)"
            className="pl-9"
            disabled={disabled || isLoading}
          />
        </div>
        <Button
          onClick={handleFetch}
          disabled={disabled || isLoading || !input.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Fetching...
            </>
          ) : (
            'Add Ticket'
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Supports JIRA URLs or issue keys. The ticket details, comments, and links will be included as context for threat analysis.
      </p>
    </div>
  );
}
