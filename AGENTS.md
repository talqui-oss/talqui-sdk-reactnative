# AGENTS.md

> If a `TALQUI_GUIDELINES.md` file exists at the repository root, read it before doing anything else. It is mandatory for maintainers.

`@talqui-oss/react-native`: the Talqui live chat for React Native and Expo. A thin layer over `react-native-webview` that hosts the Talqui WebChat (`https://webchat.talqui.chat`) and talks to it through the bridge protocol in `docs/BRIDGE_PROTOCOL.md`.

## Commands

```bash
pnpm install --ignore-workspace
pnpm typecheck   # tsc
pnpm test        # node --test (protocol + fixtures)
pnpm build       # tsup -> dist/
cd example && npm install && npx expo start   # example app, runs in Expo Go
```

## Layout

- `src/protocol.ts`: URL, command envelope, event parsing, metadata normalization. Pure, tested.
- `src/identity.ts`: the visitor identity in AsyncStorage. The chat page persists nothing; the SDK owns the identity.
- `src/TalquiWebView.tsx`: the WebView with link guarding, media permissions, crash reload and the ready watchdog.
- `src/TalquiProvider.tsx`: state, command replay on every page load, identify/logout, the full-screen overlay.
- `src/TalquiChat.tsx`: the inline variant.
- `bridge-fixtures/v1.json`: one example of every bridge message, copied from the WebChat.

## Rules

- No native code and no dependency beyond the two peers: the SDK must keep working in Expo Go.
- Changing who the user is always remounts the WebView (new URL). Never switch identity inside a running page.
- `logout()` must leave nothing of the previous user: storage key removed, replay state cleared, page remounted.
- The bridge protocol is additive only. Never send a command the WebChat does not document.
- Code, comments and docs in English.
