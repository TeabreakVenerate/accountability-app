# Design & UI Architecture
1. Visual Language & Palette
The application will utilize a high-contrast, modern utilitarian aesthetic, driven by the core brand palette:

Primary (Gold): #f5b212 - Used for primary actions, warnings, and active countdowns.

Secondary (Blue): #003049 - Used for headers, primary backgrounds in dark mode, and navigation structures.

Base (White): #ffffff - Used for text on dark backgrounds, cards, and modal surfaces.

2. Styling Framework
Engine: NativeWind (Tailwind CSS for React Native).

Rule: Avoid inline StyleSheet objects unless dynamically calculating absolute positioning or handling complex animations. Default to standard Tailwind utility classes to maximize styling velocity.

3. The Lockdown Overlay
The blocking screen must be highly visible and visually distinct from standard app screens. It should feature a solid #003049 background, #f5b212 warning iconography, and a centralized, large-touch-target OTP input field for bypass entry.
