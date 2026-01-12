import { useEffect } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOAuthStore } from '@/store/oauth-store';

export function GoogleDriveConnect() {
  const {
    isGoogleConfigured,
    isGoogleConnected,
    isLoading,
    checkGoogleConfigured,
    checkGoogleStatus,
    connectGoogle,
    disconnectGoogle,
  } = useOAuthStore();

  useEffect(() => {
    checkGoogleConfigured();
    checkGoogleStatus();

    // Check for OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth_success') === 'google_drive') {
      checkGoogleStatus();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkGoogleConfigured, checkGoogleStatus]);

  // Don't render if Google OAuth is not configured
  if (!isGoogleConfigured) {
    return null;
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking...
      </Button>
    );
  }

  if (isGoogleConnected) {
    return (
      <Button variant="outline" onClick={disconnectGoogle} className="gap-2">
        <Cloud className="h-4 w-4 text-green-500" />
        Google Drive Connected
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={connectGoogle} className="gap-2">
      <CloudOff className="h-4 w-4" />
      Connect Google Drive
    </Button>
  );
}
