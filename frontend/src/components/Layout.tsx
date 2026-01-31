import { Outlet, Link, useLocation } from 'react-router-dom';
import { Shield, Plus, List } from 'lucide-react';
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/clerk-react';
import { cn } from '@/lib/utils';

export function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <Shield className="h-6 w-6 text-primary" />
            <span>Threat Modeling Dashboard</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              to="/"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                location.pathname === '/'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              <List className="h-4 w-4" />
              All Threat Models
            </Link>
            <Link
              to="/new"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                location.pathname === '/new'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              <Plus className="h-4 w-4" />
              New Model
            </Link>
            <div className="flex items-center gap-2 ml-4 pl-4 border-l">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors">
                    Sign In
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="px-3 py-2 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    Sign Up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
