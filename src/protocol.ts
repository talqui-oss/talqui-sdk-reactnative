import type { TalquiEventMap, TalquiEventName, TalquiMeta } from './types';

/**
 * talqui.bridge.v1: the messages exchanged with the chat page running in the
 * WebView. Commands go in through `window.TalquiBridge.receive(json)`, events
 * come out through `window.ReactNativeWebView.postMessage(json)`.
 */
export const PROTOCOL = 1;
export const DEFAULT_BASE_URL = 'https://webchat.talqui.chat';
export const SDK_LABEL = 'react-native@0.1.1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const IDENTITY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
export const USER_HASH_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const META_KEY = /^[a-z0-9_-]{1,60}$/;
const UNSAFE_KEYS = ['__proto__', 'constructor', 'prototype'];

export type Identity = { kind: 'anonymous' | 'identified'; id: string };

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/**
 * The page to load. Everything lives in the URL fragment (after `#`), which
 * is never sent to a server, so the identity never reaches access logs.
 */
export function buildChatUrl(options: {
  baseUrl: string;
  tenantId: string;
  connectionId: string;
  identity: Identity | null;
}): string {
  const query = new URLSearchParams({
    T_ID: options.tenantId,
    PC_ID: options.connectionId,
    EMBED: '1',
    SDK: SDK_LABEL,
  });
  if (options.identity) {
    query.set(options.identity.kind === 'identified' ? 'S_ID' : 'A_ID', options.identity.id);
  }
  return `${options.baseUrl.replace(/\/+$/, '')}/#/chat?${query.toString()}`;
}

/** The JavaScript injected into the WebView to deliver one command. */
export function commandScript(name: string, payload: object, id: string): string {
  const json = JSON.stringify({ talqui: PROTOCOL, kind: 'command', name, id, payload });
  // The JSON is passed as a string literal, so nothing in it is evaluated as code.
  return `window.TalquiBridge&&window.TalquiBridge.receive(${JSON.stringify(json)});true;`;
}

export type ParsedEvent = { [E in TalquiEventName]: { name: E; payload: TalquiEventMap[E] } }[TalquiEventName];

/** Reads an event posted by the page; `null` for anything that is not a v1 event. */
export function parseEvent(raw: string): ParsedEvent | null {
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof message !== 'object' || message === null) return null;
  const { talqui, kind, name, payload } = message as Record<string, unknown>;
  if (talqui !== PROTOCOL || kind !== 'event' || typeof name !== 'string') return null;
  return { name, payload: typeof payload === 'object' && payload !== null ? payload : {} } as ParsedEvent;
}

/**
 * Turns what the app passed into what the chat accepts: keys lowercased,
 * numbers and booleans as text, long values cut. Anything that cannot be
 * fixed is dropped with a warning — never an exception in the host app.
 */
export function normalizeMeta(meta: TalquiMeta, warn: (message: string) => void): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    warn('metadata must be an object of key/value pairs; ignored.');
    return out;
  }
  for (const rawKey of Object.getOwnPropertyNames(meta)) {
    const key = rawKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (key !== rawKey) warn(`metadata key "${rawKey}" was sent as "${key}".`);
    if (!META_KEY.test(key) || UNSAFE_KEYS.includes(key)) {
      warn(`metadata key "${rawKey}" ignored: use lowercase letters, digits, "_" and "-" (max 60 chars).`);
      continue;
    }
    const value = (meta as Record<string, unknown>)[rawKey];
    if (value === null) {
      out[key] = null;
    } else if (typeof value === 'string') {
      out[key] = value.trim().slice(0, 255);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = String(value);
    } else if (typeof value === 'boolean') {
      out[key] = String(value);
    } else {
      warn(`metadata "${rawKey}" ignored: values are strings, numbers, booleans or null.`);
    }
  }
  return out;
}

/** Whether a push message was sent by Talqui (check the message's `data`). */
export function isTalquiPush(data: Record<string, unknown> | null | undefined): boolean {
  return data?.talqui === '1';
}
