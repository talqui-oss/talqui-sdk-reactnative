# Talqui React Native SDK: instructions for AI coding agents

Quick install guide for AI agents adding Talqui live chat to a React Native or Expo app. Follow the steps in order. Every step ends with something to check before moving on.

Package: `@talqui-oss/talqui-sdk-reactnative`. Human docs: [README](./README.md).

**Full documentation:** [docs.talqui.chat/guides/chat-sdks/react-native](https://docs.talqui.chat/guides/chat-sdks/react-native). Open it whenever you need more than this guide: identifying users, metadata, every event, permissions per platform and troubleshooting. The rest of the Talqui platform (REST API, webhooks, chatbots, AI agents) is documented at [docs.talqui.chat](https://docs.talqui.chat).

## 0. What you need from the user

Two IDs from their Talqui workspace. They are public (the same values go in a website snippet), so they can live in the app code or in env vars.

| Value | Where it is |
| --- | --- |
| `tenantId` | The workspace UUID. In the app URL: `https://app.talqui.chat/tenant/<tenantId>/...` |
| `connectionId` | The WebChat connection UUID. app.talqui.chat → Plugins → WebChat → Installation, or in the URL of that connection: `.../connections/<connectionId>` |

How to get them:

1. **Ask the user** for both IDs.
2. **No Talqui account yet?** Open `https://app.talqui.chat/initiate/signup/` in their browser and ask them to create the account. If you can see the browser, wait until they are logged in, then read `tenantId` from the address bar (`/tenant/<tenantId>/`).
3. **No WebChat connection yet?** Ask them to add one in Plugins → WebChat, then read `connectionId` from the Installation screen or the connection URL.

Never ask for, type or read the user's password or any secret. You only need the two IDs. Both are UUIDs (`xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx`); if a value does not look like one, ask again.

## 1. Detect the project type

| Signal | Project type | Go to |
| --- | --- | --- |
| `expo` in `package.json`, no `ios/` and `android/` folders | Expo managed (works in Expo Go) | 2a |
| `expo` in `package.json` and native folders exist | Expo with prebuild / dev build | 2a, then `npx expo prebuild` or rebuild the dev client |
| No `expo`, `ios/Podfile` exists | Bare React Native | 2b |
| `app/_layout.tsx` with `expo-router` | Expo Router | provider goes in `app/_layout.tsx` (step 3) |
| `@react-navigation/native` | React Navigation | provider goes around `NavigationContainer` (step 3) |

Requirements: React Native 0.73+ (Expo SDK 50+), iOS 15+, Android 7+ (API 24).

## 2. Install

### 2a. Expo

```bash
npx expo install @talqui-oss/talqui-sdk-reactnative react-native-webview @react-native-async-storage/async-storage
```

Use `npx expo install` (not `npm install`) so the two peer dependencies match the Expo SDK.

### 2b. Bare React Native

```bash
npm install @talqui-oss/talqui-sdk-reactnative react-native-webview @react-native-async-storage/async-storage
cd ios && pod install && cd ..
```

Use the project's package manager (`yarn add`, `pnpm add`) if it has a lockfile for it.

**Check:** the three packages are in `package.json` dependencies.

## 3. Add the provider once, at the root

```tsx
import { TalquiProvider } from '@talqui-oss/talqui-sdk-reactnative';

export default function App() {
  return (
    <TalquiProvider tenantId="TENANT_ID" connectionId="CONNECTION_ID">
      {/* the rest of the app, including NavigationContainer */}
    </TalquiProvider>
  );
}
```

- **Expo Router:** wrap the `<Stack />` / `<Slot />` in `app/_layout.tsx`.
- **React Navigation:** put `TalquiProvider` outside `NavigationContainer`.
- Only one `TalquiProvider` per app. Every `useTalqui()` must be below it.
- Prefer env vars when the project already uses them: `process.env.EXPO_PUBLIC_TALQUI_TENANT_ID` (Expo) or the project's config module.
- During integration add `debug` to see every message exchanged with the chat in the Metro logs. Remove it before shipping.

## 4. Open the chat

Full screen, from any button (support screen, settings, help menu):

```tsx
import { useTalqui } from '@talqui-oss/talqui-sdk-reactnative';

function HelpButton() {
  const talqui = useTalqui();
  return <Button title="Talk to us" onPress={talqui.open} />;
}
```

Or inline, as a tab or screen of its own:

```tsx
import { TalquiChat } from '@talqui-oss/talqui-sdk-reactnative';
import { useIsFocused } from '@react-navigation/native';

function ChatScreen() {
  return <TalquiChat style={{ flex: 1 }} visible={useIsFocused()} hideCloseButton />;
}
```

- `visible` tells the SDK when the tab is on screen (unread counting). With Expo Router use `useIsFocused` from `@react-navigation/native` too.
- `hideCloseButton` removes the header's close button, which has nothing to close in a tab.
- Do not put the chat inside a `Modal` or a bottom sheet: `open()` already presents it full screen and handles the Android back button.

## 5. Permissions (attachments, camera, voice messages)

Expo, in `app.json` / `app.config.*`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSCameraUsageDescription": "Take photos to send in the support chat.",
        "NSMicrophoneUsageDescription": "Record voice messages for the support chat.",
        "NSPhotoLibraryUsageDescription": "Choose photos to send in the support chat."
      }
    },
    "android": {
      "softwareKeyboardLayoutMode": "resize",
      "permissions": ["android.permission.CAMERA", "android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"]
    }
  }
}
```

Bare: the same three keys in `ios/<App>/Info.plist`; `CAMERA`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` in `android/app/src/main/AndroidManifest.xml`; `android:windowSoftInputMode="adjustResize"` on the main activity. Merge with existing entries; never replace the file.

## 6. Connect it to the app's login (when the app has users)

```ts
const talqui = useTalqui();

// after login
await talqui.identify({ name: user.name, email: user.email, phone: user.phone });

// on logout, always
await talqui.logout();
```

- Find the app's existing login and logout handlers (auth context, store action, `signOut`) and call these there. Do not create a new auth flow.
- `phone` in international format (`+5511999990000`). Invalid values are ignored, the rest still applies.
- `userHash` keeps a user's history across devices. It must be computed **on the backend**: `HMAC_SHA256(secret, "<tenantId>:<userId>")`, lowercase hex. Never put the secret in the app. If the project has no backend endpoint for it, skip `userHash` and tell the user.

Optional context the support team sees next to the conversation:

```ts
talqui.setContactMeta({ plan: 'pro' });                      // about the person
talqui.setSessionMeta({ screen: 'checkout', order_id: '4821' }); // about this conversation
```

Keys: `a-z 0-9 _ -`, up to 60 chars, 20 per call. Values: string, number, boolean (stored as text, 255 chars) or `null` to remove. Never send passwords, tokens or card data.

## 7. Validate

Run these and report the result to the user:

1. `npx tsc --noEmit` (TypeScript projects) has no new errors.
2. Start the app (`npx expo start` or `npx react-native run-ios` / `run-android`) and trigger `open()`.
3. With `debug` on, Metro shows `[talqui] ← ready {...}` within a few seconds.
4. The chat shows the workspace name and a message box. Send "Test from the app".
5. Ask the user to confirm the message arrived in their inbox at app.talqui.chat.
6. If the app identifies users: after login the pre-chat form does not appear (when name, email and phone cover the fields the workspace requires); after logout and opening again, the chat starts as a new visitor.

## 8. Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Invalid link" screen | `tenantId` or `connectionId` is wrong or not a UUID. |
| `useTalqui must be used inside <TalquiProvider>` | The provider is not above that component. Move it to the root. |
| Attach / camera / mic does nothing | Permissions from step 5 are missing; rebuild native apps after editing them. |
| Keyboard covers the message box on Android | `softwareKeyboardLayoutMode: "resize"` (Expo) or `adjustResize` (bare). |
| `open()` does nothing | An inline `<TalquiChat />` is on screen; it already shows the chat. |
| Native module errors after install (bare) | Run `pod install` and rebuild; Expo Go needs no native step. |

## Rules

- Do not fork the SDK, copy its source or call the chat page directly. Use the package API.
- Do not edit files inside `node_modules`.
- Keep the change small: provider, one entry point, permissions, login hooks. Ask before adding screens the user did not request.
