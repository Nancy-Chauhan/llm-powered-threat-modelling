import { Hono } from 'hono';
import { googleOAuthService, isGoogleOAuthConfigured } from '../services/google-oauth';
import { googleDriveService } from '../services/google-drive';

const app = new Hono();

// Check if Google OAuth is configured
app.get('/google/configured', (c) => {
  return c.json({ configured: isGoogleOAuthConfigured() });
});

// Redirect to Google OAuth
app.get('/google/authorize', (c) => {
  const authUrl = googleOAuthService.getAuthorizationUrl();
  return c.redirect(authUrl);
});

// OAuth callback - exchanges code for tokens
app.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  const closeWindowHtml = (success: boolean, message: string) => `
    <!DOCTYPE html>
    <html>
      <head><title>OAuth ${success ? 'Success' : 'Error'}</title></head>
      <body>
        <p>${message}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth_complete', success: ${success} }, '*');
          }
          window.close();
        </script>
      </body>
    </html>
  `;

  if (error) {
    return c.html(closeWindowHtml(false, 'Authorization failed: ' + error));
  }

  if (!code) {
    return c.html(closeWindowHtml(false, 'Missing authorization code'));
  }

  try {
    const { accessToken, refreshToken, expiresAt } = await googleOAuthService.exchangeCode(code);
    await googleOAuthService.saveTokens(accessToken, refreshToken, expiresAt);
    return c.html(closeWindowHtml(true, 'Connected successfully! This window will close.'));
  } catch (err) {
    console.error('OAuth callback error:', err);
    return c.html(closeWindowHtml(false, 'Token exchange failed'));
  }
});

// Check connection status
app.get('/google/status', async (c) => {
  const connected = await googleOAuthService.isConnected();
  return c.json({ connected });
});

// Disconnect
app.delete('/google', async (c) => {
  await googleOAuthService.disconnect();
  return c.json({ success: true });
});

// List Drive files
app.get('/google/drive/files', async (c) => {
  const query = c.req.query('q');
  const pageToken = c.req.query('pageToken');

  try {
    const result = await googleDriveService.listFiles(query, pageToken);
    return c.json(result);
  } catch (err) {
    console.error('Drive list error:', err);
    return c.json({ error: 'Failed to list files' }, 500);
  }
});

// Get file content
app.get('/google/drive/files/:fileId/content', async (c) => {
  const fileId = c.req.param('fileId');

  try {
    const result = await googleDriveService.getFileContent(fileId);
    return c.json(result);
  } catch (err) {
    console.error('Drive file content error:', err);
    return c.json({ error: 'Failed to get file content' }, 500);
  }
});

export default app;
