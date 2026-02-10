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
      className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
    >
      Sign in
    </button>
  );
}
