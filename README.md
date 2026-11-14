# Talqui for React Native

Add Talqui live chat to your React Native or Expo app in a few lines. Your users talk to your team, your bots and your AI agents from inside the app, with their history, attachments and voice messages.

- **Works in Expo Go.** No native code of its own, no config plugin, no dev build required.
- **Full screen or inline.** `open()` from any button, or `<TalquiChat />` in a tab.
- **Knows who is talking.** Pass the logged-in user and data about the conversation (an order, a plan, the screen they are on), at any moment.
- **Events.** Unread badge, new messages, chat closed.
- **Safe logout.** One call and the next user of the phone starts from nothing.

## Requirements

React Native 0.73+ (Expo SDK 50+), iOS 15+, Android 7+ (API 24).

## Install

```bash
npx expo install @talqui-oss/react-native react-native-webview @react-native-async-storage/async-storage
```

Bare React Native: `npm install` the same three packages, then `cd ios && pod install`.

## Get your IDs

You need your **Tenant ID** and your WebChat **Connection ID**: app.talqui.chat → Plugins → WebChat → Installation. [Step by step with screenshots →](https://docs.talqui.chat/guides/chat-sdks/get-your-ids)

## Quick start

```tsx
import { TalquiProvider, useTalqui } from '@talqui-oss/react-native';
import { Button } from 'react-native';

export default function App() {
  return (
    <TalquiProvider tenantId="YOUR_TENANT_ID" connectionId="YOUR_CONNECTION_ID">
      <Home />
    </TalquiProvider>
  );
}

function Home() {
  const talqui = useTalqui();
  return <Button title="Talk to us" onPress={talqui.open} />;
}
```

Want the chat in a tab instead? Render `<TalquiChat style={{ flex: 1 }} />` in that screen.

## Permissions

Attachments, photos and voice messages need these entries. With Expo, in `app.json`:

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

Bare React Native: the same keys in `Info.plist` and `AndroidManifest.xml`, and `android:windowSoftInputMode="adjustResize"` on your activity.

## Identify users

```ts
await talqui.identify({ name: 'Ana Souza', email: 'ana@example.com', phone: '+5511999990000' });
```

To keep a user's history across devices, also pass a `userHash` computed **on your backend**: `HMAC_SHA256(secret, "<tenantId>:<userId>")`. Never compute it in the app. [Read more →](https://docs.talqui.chat/guides/chat-sdks/identify-users)

## Metadata

```ts
talqui.setContactMeta({ plan: 'pro' });                    // about the person
talqui.setSessionMeta({ order_id: '4821', step: 'cart' });  // about this conversation, can change any time
```

Your team sees it next to the conversation. Keys: lowercase letters, digits, `_` and `-`. [Read more →](https://docs.talqui.chat/guides/chat-sdks/metadata)

## Events

```ts
useTalquiEvent('messageReceived', (event) => console.log(event.preview));
const { unreadCount } = useTalqui(); // for a badge
```

[All events →](https://docs.talqui.chat/guides/chat-sdks/events)

## Logout

```ts
await talqui.logout(); // call it when your user logs out
```

## Example app

```bash
cd example && npm install && npx expo start
```

Open it in Expo Go. It has an "Open chat" button and a "Chat" tab, connected to the Talqui demo workspace.

## Troubleshooting

- **The attach or camera button does nothing**: the permissions above are missing.
- **The keyboard covers the message box on Android**: set `softwareKeyboardLayoutMode: "resize"` (Expo) or `adjustResize`.
- **"Invalid link" screen**: `tenantId` or `connectionId` is wrong.

[More →](https://docs.talqui.chat/guides/chat-sdks/troubleshooting)

## Documentation

[docs.talqui.chat/guides/chat-sdks/react-native](https://docs.talqui.chat/guides/chat-sdks/react-native)

## License

MIT

Built by [Talqui](https://talqui.chat).
