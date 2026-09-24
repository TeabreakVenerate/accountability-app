import 'expo-dev-client';
import '../global.css';
import { Slot } from 'expo-router';
import { AuthGuard } from '../components/AuthGuard';

export default function RootLayout() {
  return (
    <AuthGuard>
      <Slot />
    </AuthGuard>
  );
}
