import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { AuthPage } from '@/pages/AuthPage';
import { setTokenGetter } from '@/lib/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isTokenReady, setIsTokenReady] = useState(false);

  // Set up token getter before rendering children
  useEffect(() => {
    if (isSignedIn && getToken) {
      setTokenGetter(getToken);
      setIsTokenReady(true);
    }
  }, [isSignedIn, getToken]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <AuthPage />;
  }

  // Wait for token to be ready before rendering protected content
  if (!isTokenReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
