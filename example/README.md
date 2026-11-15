# Example

A small app with an "Open chat" button and a "Chat" tab, connected to the Talqui demo workspace.

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go, or press `i` / `a` for a simulator. Use your own workspace by setting `EXPO_PUBLIC_TALQUI_TENANT_ID` and `EXPO_PUBLIC_TALQUI_CONNECTION_ID` (see `talqui.config.ts`).

`metro.config.js` points the app at the SDK source in `../src`; your app installs the package from npm instead.

Push notifications are off here because Expo Go has no Firebase. `push.ts` holds the code and the steps to turn them on in a development build.
