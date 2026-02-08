import {
  SignInButton,
  UserButton as ClerkUserButton,
  useAuth,
} from '@clerk/clerk-react';

export default function UserButton() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <ClerkUserButton afterSignOutUrl="/" />;
  }

  return (
    <SignInButton mode="modal">
      <button className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
        Sign in
      </button>
    </SignInButton>
  );
}
