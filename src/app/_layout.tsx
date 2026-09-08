import 'expo-dev-client';
import '../global.css';
import { Stack } from 'expo-router';
import { AuthGuard } from '../components/AuthGuard';

export default function RootLayout() {
  return (
    <AuthGuard>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AuthGuard>
  );
}
