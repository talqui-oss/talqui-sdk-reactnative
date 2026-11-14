import AsyncStorage from '@react-native-async-storage/async-storage';

import { IDENTITY_PATTERN, type Identity } from './protocol';

/**
 * The visitor identity lives here, in the app's storage — never in the
 * WebView's. The chat page persists nothing about the visitor; it receives
 * the identity in its URL on every load. So `logout()` deleting this one key
 * is enough for the next user of the phone to start from nothing.
 */
const key = (tenantId: string) => `talqui:identity:${tenantId}`;

export async function readIdentity(tenantId: string): Promise<Identity | null> {
  try {
    const raw = await AsyncStorage.getItem(key(tenantId));
    const parsed = raw ? (JSON.parse(raw) as Identity) : null;
    if (parsed && (parsed.kind === 'anonymous' || parsed.kind === 'identified') && IDENTITY_PATTERN.test(parsed.id)) {
      return parsed;
    }
  } catch {
    // Unreadable storage: start as a new anonymous visitor.
  }
  return null;
}

export async function writeIdentity(tenantId: string, identity: Identity): Promise<void> {
  try {
    await AsyncStorage.setItem(key(tenantId), JSON.stringify(identity));
  } catch {
    // The chat still works; the visitor just starts anew on the next app launch.
  }
}

export async function clearIdentity(tenantId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(tenantId));
  } catch {
    // Nothing more can be done; the page itself keeps nothing.
  }
}
