# Android build

This project uses Capacitor as an Android WebView shell around the existing
Next.js app.

The app is not a static export: it uses Server Components, API routes, Server
Actions, MongoDB, and desktop SQLite. The Android app therefore needs a running
Next.js server URL.

## Development on Android emulator

Start the Next.js server:

```bash
npm run dev
```

In another terminal, run the app on an Android emulator:

```bash
npm run android:run
```

By default Capacitor points to `http://10.0.2.2:3000`, which is the Android
emulator alias for your computer's localhost.

## Build a debug APK

Install these first:

- Java JDK 17 or newer
- Android Studio
- Android SDK platform/tools

Then run:

```bash
npm run android:build
```

The debug APK will be written under:

```text
android/app/build/outputs/apk/debug/
```

## Build against a hosted server

For a physical phone or production-style APK, point Capacitor at a reachable
HTTPS deployment of the Next.js app:

```bash
CAPACITOR_SERVER_URL=https://your-domain.com npm run android:sync
cd android
./gradlew assembleDebug
```

Use HTTPS for real devices. Plain HTTP is only enabled for local emulator
development.
