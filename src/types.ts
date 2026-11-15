/** Who the visitor is, as far as your app knows. Every field is optional. */
export interface TalquiUser {
  /** Your own id for the user. Only used for your bookkeeping; never sent as the identity. */
  userId?: string;
  /**
   * Identifies the user across devices and keeps their history after they
   * log in again. Computed on YOUR backend, never in the app:
   * `HMAC_SHA256(secret, "<tenantId>:<userId>")` as lowercase hex.
   * Anyone holding it can read that user's conversation, so treat it like a
   * session token. 32 to 128 chars of `A-Z a-z 0-9 _ -`.
   */
  userHash?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface TalquiContact {
  name?: string;
  email?: string;
  phone?: string;
}

/** Custom data: strings, numbers or booleans (stored as text). `null` removes a key. */
export type TalquiMeta = Record<string, string | number | boolean | null>;

export interface TalquiEventMap {
  ready: { protocol: number; webchatVersion: string; identity: { kind: 'anonymous' | 'identified'; anonymousId?: string } };
  sessionStarted: { sessionId: string | null };
  messageSent: { messageId: string; type: string };
  messageReceived: { messageId: string; type: string; preview: string; operatorName: string | null };
  unreadChanged: { count: number };
  closeRequested: Record<string, never>;
  openUrl: { url: string };
  resetDone: Record<string, never>;
  error: { code: string; message: string; commandId?: string };
}

export type TalquiEventName = keyof TalquiEventMap;

export type TalquiEventListener<E extends TalquiEventName> = (payload: TalquiEventMap[E]) => void;

export interface TalquiApi {
  /** Shows the chat full screen. */
  open(): void;
  /** Hides the full-screen chat. The conversation keeps running in the background. */
  close(): void;
  /** Mounts the chat ahead of time (hidden), so `open()` is instant and unread messages are counted. */
  preload(): void;
  /**
   * Sets who the user is. With a `userHash` the chat reloads as that user
   * (their history follows them across devices); without one, the details
   * are attached to this device's anonymous visitor.
   */
  identify(user: TalquiUser): Promise<void>;
  setContact(contact: TalquiContact): void;
  /** Data about the person, kept on their contact. */
  setContactMeta(meta: TalquiMeta): void;
  /** Data about this conversation (an order, the screen they are on). Can change at any moment. */
  setSessionMeta(meta: TalquiMeta): void;
  /** Puts text in the message box. The user still decides to send it. */
  prefill(text: string): void;
  /** Call it when your user logs out: forgets this user and starts a fresh anonymous visitor. */
  logout(): Promise<void>;
  /**
   * The device's Firebase Cloud Messaging token, so a reply reaches the user while the app is
   * closed. Works when the WebChat connection sends notifications "through Talqui" with your
   * Firebase project (Settings → WebChat → Notificações). Call it at startup and on token refresh.
   */
  setPushToken(token: string): void;
  /** Opens the chat for a tapped Talqui notification. Returns whether it was one. */
  handlePush(data: Record<string, unknown> | null | undefined): boolean;
  /** Messages received while the chat was not on screen. */
  unreadCount: number;
  /** Whether the chat is loaded and accepting commands. */
  isReady: boolean;
  isOpen: boolean;
}
