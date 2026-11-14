
# Talqui bridge protocol v1

Contract between the Talqui WebChat (served at `https://webchat.talqui.chat`) and the native SDKs that host it inside a WebView (`@talqui-oss/react-native`, `talqui_flutter`, and later Swift/Kotlin). The same vocabulary is exposed to websites as `window.$talqui` (section 9). Written in English because it is copied verbatim into the public repositories and into docs.talqui.chat.

**The WebChat is deployed continuously; SDK versions live inside customer apps for years.** Every rule below exists so that an app built today keeps working against the WebChat deployed in 2028. Changes to this protocol are additive only (see [Compatibility](#7-compatibility)).

## 1. Boot URL

The SDK loads the WebChat fullscreen route with these params. **All params live in the URL fragment** (after `#`), which browsers never send to a server, so identity values never reach access logs or CDN logs.

```text
https://webchat.talqui.chat/#/chat?T_ID=<tenantId>&PC_ID=<connectionId>&EMBED=1&SDK=<name>@<version>&A_ID=<anonymousId>
https://webchat.talqui.chat/#/chat?T_ID=<tenantId>&PC_ID=<connectionId>&EMBED=1&SDK=<name>@<version>&S_ID=<userHash>
```

| Param | Required | Meaning |
|---|---|---|
| `T_ID` | yes | Tenant UUID. Strict, as today. |
| `PC_ID` | yes | WebChat plugin connection UUID. Strict, as today. |
| `EMBED` | yes for SDKs | `1` turns on embed mode (section 2). Any other value is ignored. |
| `SDK` | yes for SDKs | `react-native@0.1.0`, `flutter@0.1.0`. Pattern `^[a-z-]{2,20}@[0-9A-Za-z.+-]{1,32}$`, dropped leniently when invalid. Written by the WebChat as session metadata key `sdk` (`sessionMeta.custom.sdk = "react-native@0.1.0"`) for support and adoption metrics. |
| `A_ID` | one of `A_ID`/`S_ID` | Anonymous device identity, previously minted by the WebChat and persisted by the SDK (section 4). Pre-chat form rules apply normally. |
| `S_ID` | one of `A_ID`/`S_ID` | Identified user: the `userHash` computed by the customer backend. Same semantics as the handoff `S_ID` that already exists: linked identity, pre-chat form skipped. |

Both `A_ID` and `S_ID` use the existing `SHADOW_ID_PATTERN` (`^[A-Za-z0-9_-]{8,128}$`). The SDK additionally requires `userHash` to be at least 32 chars, which rejects raw database ids such as `"123"` before they ever reach the WebChat.

If both are present, `S_ID` wins and `A_ID` is ignored. If neither is present in embed mode, the WebChat mints a fresh anonymous id with `crypto.randomUUID()` and reports it in the `ready` event so the SDK can persist it.

## 2. Embed mode (`EMBED=1`)

Behavior differences from the regular fullscreen route:

1. **Identity is owned by the SDK.** The WebChat never reads or writes the identity keys (`talqui:shadowID:<tenant>`, `talqui_shadowID_<tenant>` cookie) in embed mode. The identity for this boot is exactly the `S_ID`/`A_ID` from the URL, or the freshly minted one. Any other local state that depends on the visitor (`talqui:contact`, handoff tokens) is namespaced by that identity: `<key>:<tenantId>:<identity>`. Logging out on the native side therefore cannot leave the previous user's data reachable, even if the WebView storage is never cleared.
2. **Header:** the close control posts `closeRequested` instead of acting locally. The host decides whether that means dismissing a modal or doing nothing (chat in a tab).
3. **Links:** clicks on `http(s)`, `mailto:`, `tel:` and `whatsapp:` links, and any `window.open`, post `openUrl` instead of navigating. Native SDKs also guard navigation themselves (defense in depth).
4. **Layout:** `viewport-fit=cover`, safe areas through `env(safe-area-inset-*)`, height from the existing `classes/viewport.ts` (visualViewport). No balloon, no outer card.
5. **Unread tracking:** the WebChat counts inbound operator messages while the host reports it is not visible (`setVisibility`) and posts `unreadChanged`.

## 3. Transport and envelope

| Direction | Mechanism |
|---|---|
| Native → web | The SDK evaluates `window.TalquiBridge && window.TalquiBridge.receive(<JSON string>)` (React Native `injectJavaScript`, Flutter `runJavaScript`). |
| Web → native | The WebChat calls the first available of `window.ReactNativeWebView.postMessage(json)` (react-native-webview) or `window.TalquiNative.postMessage(json)` (Flutter JavaScript channel named `TalquiNative`, also used by future Swift/Kotlin SDKs). |

There is **no `window.addEventListener("message")`**: only code that the native host injects can issue commands, so a third-party script or iframe cannot drive the bridge.

Every message is one JSON object:

```json
{ "talqui": 1, "kind": "command", "name": "setSessionMeta", "id": "c-7", "payload": { "order_id": "4821" } }
```

| Field | Rule |
|---|---|
| `talqui` | Protocol major version. The WebChat ignores messages whose `talqui` is not `1`. |
| `kind` | `command` (native → web) or `event` (web → native). |
| `name` | One of the names below. Unknown names produce an `error` event with code `unknown_command` and are otherwise ignored. |
| `id` | Optional, set by the sender. An `error` caused by a command echoes its `id`. |
| `payload` | Object. Missing means `{}`. |

**Ordering:** the SDK queues every command issued before `ready` and flushes the queue, in order, right after `ready`. Commands are idempotent, so a flush after a WebView reload replays the latest state safely (the SDK keeps the latest value per command, not the full history).

## 4. Commands (native → web)

| Name | Payload | Effect |
|---|---|---|
| `setContact` | `{ name?: string, email?: string, phone?: string }` | Fills the contact traits that ride on every outbound message . When the traits cover every required pre-chat field, the form is considered submitted. |
| `setContactMeta` | flat object, see [Metadata rules](#6-metadata-rules) | Written to the visitor's contact (`contactMeta.<key>`) through the WebChat API as soon as the contact exists, and immediately on later calls. Before the first message it stays pending. `null` deletes a key. |
| `setSessionMeta` | flat object, see [Metadata rules](#6-metadata-rules) | Written to the visitor's active conversation (`sessionMeta.custom.<key>`) as soon as one exists, and immediately on later calls, so it can change mid-conversation. Re-applied to the next conversation when one starts. `null` deletes a key. |
| `prefill` | `{ text: string }` (1..1000 chars) | Seeds the composer. Never auto-sends (unlike `MSG`). |
| `setVisibility` | `{ visible: boolean }` | Host tells whether the chat is on screen. `visible: true` resets the unread counter and posts `unreadChanged { count: 0 }`. |
| `reset` | `{}` | Disconnects the socket, drops in-memory identity, contact and metadata, and posts `resetDone`. The SDK then deletes its stored identity and reloads the WebView. |

`identify` is deliberately **not** a bridge command. Changing who the user is changes `S_ID`, which decides session restore and the socket handshake; doing that mid-flight is the class of bug that leaks conversations between users in other SDKs. The SDK implements `identify()` as: store the new identity, reload the WebView with the new `S_ID`, replay `setContact`.

## 5. Events (web → native)

| Name | Payload | When |
|---|---|---|
| `ready` | `{ protocol: 1, webchatVersion: string, identity: { kind: "anonymous" \| "identified", anonymousId?: string } }` | App mounted and bridge installed. `anonymousId` is present when the WebChat minted one (no `A_ID`/`S_ID` in the URL); the SDK must persist it and pass it as `A_ID` on the next boot. |
| `sessionStarted` | `{ sessionId: string \| null }` | First outbound message of a new conversation was acknowledged, or a restore found a conversation in progress. |
| `messageSent` | `{ messageId: string, type: string }` | Visitor message acknowledged by the server. `type` is the WebChat `messageKey`. |
| `messageReceived` | `{ messageId: string, type: string, preview: string, operatorName: string \| null }` | Inbound operator or bot message. `preview` is plain text, max 140 chars, empty for media. |
| `unreadChanged` | `{ count: number }` | Counter changed (see `setVisibility`). |
| `closeRequested` | `{}` | Visitor tapped close in the embed header. |
| `openUrl` | `{ url: string }` | Visitor tapped a link. The SDK opens it with the system handler (`Linking.openURL` / `url_launcher`). |
| `resetDone` | `{}` | `reset` finished. |
| `error` | `{ code: string, message: string, commandId?: string }` | Codes: `invalid_params` (bad `T_ID`/`PC_ID`; the invalid-link screen is shown), `unknown_command`, `invalid_payload`, `connection_failed`. |

## 6. Metadata rules


- Flat object only. Keys match `^[a-z0-9_-]{1,60}$` (lowercase letters, digits, `_`, `-`): no dots, no `$`, no `:` (blocks Mongo operator and dotted-path injection, and the platform's own colon-separated keys). `__proto__`, `constructor` and `prototype` are refused. SDKs lowercase keys and warn when they had to.
- **Contact keys are stored with the `app_` prefix** (`setContactMeta({ plan: "pro" })` is stored as `contactMeta.app_plan`). Plugins and bot flows keep keys of their own on the contact and trust them (a provider's contract id, a CRM link); app data must never be able to overwrite or shadow them.
- Values: string (trimmed, max 255 chars) or `null` (delete). SDKs convert numbers and booleans to strings (`3` → `"3"`, `true` → `"true"`); objects and arrays are rejected.
- Max 20 keys per command. At most 50 app keys per contact and 50 keys per session: a new key beyond that is reported as failed; changing or removing an existing key always works.
- Session keys always live under `sessionMeta.custom`, so they can never overwrite platform keys (`device`, `tlID`, …). The key `sdk` is written by the WebChat itself.
- Ownership: a key written by the SDK is owned by the app. The app overwrites it on the next message even if an operator edited it in the Talqui inbox. Documented, not prevented.

## 7. Compatibility

- The WebChat must accept every v1 command and emit every v1 event forever. New commands, events and payload fields are additive.
- A breaking change means `talqui: 2`, and the WebChat must keep serving v1 for SDK versions that still send `talqui: 1`.
- SDKs ignore unknown events and unknown payload fields.
- Contract fixtures (one example of every command and event) live in `bridge-fixtures/` and are copied into each SDK repository; any WebChat PR that changes `src/classes/bridge.ts` must keep them parsing.

## 8. Security notes

- `userHash` is a bearer credential to the user's chat history: anyone who has it can restore that conversation. It must be computed on the customer backend, never in the app: `HMAC_SHA256(secret, "<tenantId>:<userId>")` as lowercase hex (64 chars). Talqui does not hold the secret in v1; nothing server-side verifies it. Server-verified identity is a follow-up.
- Native SDKs only allow top-level navigation to `https://webchat.talqui.chat` and `about:blank`.

## 9. Web JavaScript API (`window.$talqui`)

The same command and event vocabulary is exposed to websites that install the WebChat with the `t.js` snippet (the widget runs in the page context, not in an iframe). One command core serves both transports.

- **Before the script loads:** `window.$talqui = window.$talqui || []; $talqui.push(["setSessionMeta", { plan: "pro" }]); $talqui.push(["on", "messageReceived", cb]);`. The queue is replayed in order when the widget boots.
- **After it loads:** `window.$talqui` becomes an object. `push([...])` keeps working, and each command is also a method: `$talqui.setSessionMeta({ plan: "pro" })`.
- **Commands:** every command from section 4 except `setVisibility` (the widget knows when it is open), plus `identify({ userHash?, name?, email?, phone? })`, `open`, `close`, `toggle`, `show`, `hide`.
- **Events:** every event from section 5 except `openUrl` and `closeRequested`, plus `chatOpened` and `chatClosed`. `on("ready", cb)` fires immediately when the widget is already ready.
- **Reads:** `isOpen()`, `getUnreadCount()`, `version`, `help()`.
- Data commands never trigger network traffic before the visitor first opens the chat, so installing the snippet stays free of requests until there is visitor intent.
- Errors never throw into the host page: invalid input logs `console.warn("[talqui] …")`; exceptions in customer callbacks are caught and logged.
- Compatibility rules from section 7 apply to the web API as well.
