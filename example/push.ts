/**
 * Push notifications: tell the user about a reply while the app is in the background or closed.
 *
 * Off in this example, because it runs in Expo Go and Firebase needs native code. To try it:
 *
 *   1. In app.talqui.chat → Plugins → WebChat → Notificações, choose "Pela Talqui" and upload a
 *      service account of YOUR Firebase project (role "Firebase Cloud Messaging API Admin" is enough).
 *   2. Add the app to that Firebase project and download google-services.json (Android) and
 *      GoogleService-Info.plist (iOS). On iOS, also upload your APNs key in Firebase and set
 *      "ios.entitlements": { "aps-environment": "development" } in app.json.
 *   3. npx expo install @react-native-firebase/app @react-native-firebase/messaging
 *      and list them in app.json "plugins", with "googleServicesFile" for each platform.
 *   4. Uncomment the code below and build a development client: npx expo run:android / run:ios.
 *
 * Talqui only notifies when the chat is not on screen, at most once per conversation every 5 minutes.
 */
// import messaging from '@react-native-firebase/messaging';
// import { useEffect } from 'react';
import type { TalquiApi } from '@talqui-oss/talqui-sdk-reactnative';

export function useTalquiPush(_talqui: TalquiApi): void {
  // useEffect(() => {
  //   void messaging()
  //     .requestPermission()
  //     .then(() => messaging().getToken())
  //     .then(_talqui.setPushToken);
  //   const unsubscribeRefresh = messaging().onTokenRefresh(_talqui.setPushToken);
  //
  //   // A tap on a Talqui notification opens the chat; anything else is yours to handle.
  //   const unsubscribeTap = messaging().onNotificationOpenedApp((message) => _talqui.handlePush(message.data ?? {}));
  //   void messaging()
  //     .getInitialNotification()
  //     .then((message) => message && _talqui.handlePush(message.data ?? {}));
  //
  //   return () => {
  //     unsubscribeRefresh();
  //     unsubscribeTap();
  //   };
  // }, []);
}
