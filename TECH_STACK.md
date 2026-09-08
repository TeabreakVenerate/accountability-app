# Technical Stack
1. Core Framework
React Native with Expo (Prebuild): We must use Development Builds (Custom Dev Client) via npx expo prebuild. Standard "Expo Go" is banned as it cannot run our custom native Android modules.

2. Backend & Authentication
Supabase (PostgreSQL): Handles database storage and WebSocket connections (Realtime) for instant remote lock commands.

Supabase Auth: Handles user sessions and directly integrates with PostgreSQL Row Level Security (RLS) policies to ensure users can only view data tied to their specific pairing ID.

3. Android Native Bridge Libraries
react-native-usage-stats-manager: Monitors foreground app usage.

react-native-system-alert-window: Required to draw the opaque UI lock over other apps.

react-native-background-actions: Keeps the monitoring loop alive in the background and interfaces with foreground service notifications.

4. State Management
Zustand: Lightweight, un-opinionated state manager for UI toggles and OTP generation logic.
