import 'expo-dev-client';
import '../global.css';
import { AuthGuard } from '../components/AuthGuard';

export default function RootLayout() {
  return <AuthGuard />;
}
