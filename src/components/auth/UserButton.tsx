import {
  UserButton as ClerkUserButton,
  useAuth,
} from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function UserButton() {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();

  if (!isLoaded) return null;

  if (isSignedIn) {
    return <ClerkUserButton afterSignOutUrl="/" />;
  }

  return (
    <button
      onClick={() => navigate('/sign-in')}
      style={{ color: 'var(--color-btn-text)', backgroundColor: 'var(--color-btn-bg)', borderColor: 'var(--color-cell-border)' }}
      className="px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors whitespace-nowrap"
    >
      Sign in
    </button>
  );
}
