import { SignIn } from '@clerk/clerk-react';

export function AuthPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SignIn
        appearance={{
          layout: {
            logoImageUrl: '/shield.svg',
            logoPlacement: 'inside',
          },
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-lg',
          },
        }}
        afterSignInUrl="/"
        afterSignUpUrl="/"
      />
    </div>
  );
}
