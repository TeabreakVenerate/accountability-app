# Product Requirements Document (PRD)
1. Product Vision
A high-friction, Android-first accountability application that pairs users to monitor screen time and enforce digital boundaries. The system supports mutual accountability, manual and automated remote lockdowns, and features robust anti-tampering mechanisms.

2. Core Features & User Flow (MVP)
Supabase Auth & Pairing: Users authenticate via Supabase and generate one-time pairing links to connect with accountability partners.

Continuous Monitoring: Android background services (react-native-background-actions) poll UsageStatsManager and sync data to Supabase every 5 minutes.

The Lockdown Overlay: When an unauthorized app is opened, react-native-system-alert-window instantly draws an opaque React Native view over the screen.

Offline Fallbacks: Lock commands push local timestamps to the device. If the device loses connection, the background service enforces the block locally until the timer expires.

OTP Bypass: Monitored users can request access via in-app chat. The Partner generates a temporary OTP PIN for the user to enter into the lock screen to dismiss the overlay.

3. Anti-Tampering Security
Settings Block: If the user attempts to open the Android "Settings" app during an active block session, the overlay engages to prevent uninstallation or force-stopping.

Permission Polling: The background service continually verifies SYSTEM_ALERT_WINDOW and Usage Stats permissions. If revoked, it instantly alerts the Partner.

Battery Optimization: Onboarding forces the REQUEST_IGNORE_BATTERY_OPTIMIZATIONS prompt to prevent the OS from killing the background service.

The 1-Hour Cooldown: Unpairing a partner triggers a 1-hour countdown and notifies the Partner, preventing heat-of-the-moment uninstalls.
