import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, BackHandler, Linking, Platform, StatusBar, StyleSheet, View } from 'react-native';

import { clearIdentity, readIdentity, writeIdentity } from './identity';
import {
  buildChatUrl,
  commandScript,
  DEFAULT_BASE_URL,
  isUuid,
  normalizeMeta,
  parseEvent,
  USER_HASH_PATTERN,
  type Identity,
} from './protocol';
import { TalquiWebView, type TalquiWebViewHandle } from './TalquiWebView';
import type {
  TalquiApi,
  TalquiContact,
  TalquiEventListener,
  TalquiEventMap,
  TalquiEventName,
  TalquiMeta,
  TalquiUser,
} from './types';

/** How long `logout()` waits for the page to confirm it dropped the conversation. */
const RESET_TIMEOUT_MS = 2_000;

export interface TalquiProviderProps {
  /** Your workspace id (app.talqui.chat → Plugins → WebChat → Installation). */
  tenantId: string;
  /** The WebChat connection id, on the same screen. */
  connectionId: string;
  /** Called for every link the user taps in the chat. Default: open it with `Linking`. */
  onOpenUrl?: (url: string) => void;
  /** Replaces the spinner shown while the chat loads. */
  renderLoading?: () => ReactNode;
  /** Replaces the screen shown when the chat cannot load. Call `retry` to try again. */
  renderError?: (retry: () => void) => ReactNode;
  /** Logs every message exchanged with the chat page. */
  debug?: boolean;
  /** @internal Points the SDK at another WebChat deployment (development only). */
  __unstableBaseUrl?: string;
  children: ReactNode;
}

interface InlineHost {
  visible: boolean;
  onCloseRequested?: () => void;
  hideCloseButton?: boolean;
}

interface TalquiInternals {
  renderWebView(style: object | undefined): ReactNode;
  registerInline(host: InlineHost): () => void;
  updateInline(host: InlineHost): void;
}

interface TalquiContextValue {
  api: TalquiApi;
  internals: TalquiInternals;
  subscribe<E extends TalquiEventName>(name: E, listener: TalquiEventListener<E>): () => void;
}

const TalquiContext = createContext<TalquiContextValue | null>(null);

/** What the app told the chat, replayed every time a page (re)loads so nothing is lost across reloads. */
interface ReplayState {
  contact: TalquiContact | null;
  contactMeta: Record<string, string | null>;
  sessionMeta: Record<string, string | null>;
  prefill: string | null;
}

const emptyReplay = (): ReplayState => ({ contact: null, contactMeta: {}, sessionMeta: {}, prefill: null });

/**
 * Puts the Talqui chat in your app. Wrap your app once, near the root:
 *
 *     <TalquiProvider tenantId="…" connectionId="…">
 *       <App />
 *     </TalquiProvider>
 *
 * then call `useTalqui().open()` anywhere, or render `<TalquiChat />` in a screen.
 */
export function TalquiProvider(props: TalquiProviderProps) {
  const { tenantId, connectionId, onOpenUrl, renderLoading, renderError, debug, children } = props;
  const baseUrl = props.__unstableBaseUrl ?? DEFAULT_BASE_URL;
  const supported = Platform.OS === 'ios' || Platform.OS === 'android';

  const log = useCallback((...args: unknown[]) => debug && console.log('[talqui]', ...args), [debug]);
  const warn = useCallback((message: string) => console.warn(`[talqui] ${message}`), []);

  // --- identity: who the page is booted as --------------------------------------------------
  // `bootIdentity` decides the URL. It only changes together with `pageKey`, which remounts the
  // WebView: a running page is never switched to another person in place.
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [bootIdentity, setBootIdentity] = useState<Identity | null>(null);
  const [pageKey, setPageKey] = useState(0);
  const identity = useRef<Identity | null>(null);

  useEffect(() => {
    if (!isUuid(tenantId) || !isUuid(connectionId)) {
      warn('tenantId and connectionId must be the UUIDs shown on the WebChat installation screen.');
    }
    let active = true;
    void readIdentity(tenantId).then((stored) => {
      if (!active) return;
      identity.current = stored;
      setBootIdentity(stored);
      setIdentityLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [tenantId, connectionId, warn]);

  const url = useMemo(
    () => buildChatUrl({ baseUrl, tenantId, connectionId, identity: bootIdentity }),
    [baseUrl, tenantId, connectionId, bootIdentity],
  );
  const allowedOrigin = useMemo(() => (/^https?:\/\/[^/]+/.exec(baseUrl)?.[0] ?? baseUrl), [baseUrl]);

  // --- presentation -------------------------------------------------------------------------
  const [isOpen, setIsOpen] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [inline, setInline] = useState<InlineHost | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  // --- page state ---------------------------------------------------------------------------
  const [isReady, setIsReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const webview = useRef<TalquiWebViewHandle | null>(null);
  const replay = useRef<ReplayState>(emptyReplay());
  const commandSeq = useRef(0);
  const listeners = useRef(new Map<TalquiEventName, Set<(payload: never) => void>>());
  const readyRef = useRef(false);

  const send = useCallback(
    (name: string, payload: object) => {
      // Before `ready` there is nothing to send to: the replay state is delivered on `ready`.
      if (!readyRef.current || !webview.current) return;
      const id = `c-${++commandSeq.current}`;
      log('→', name, payload);
      webview.current.inject(commandScript(name, payload, id));
    },
    [log],
  );

  const visible = appActive && (inline ? inline.visible : isOpen);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    send('setVisibility', { visible });
  }, [visible, send]);

  // The header's close control follows where the chat is: full screen always
  // shows it (on iOS it is the only way out); inline it can be turned off.
  const closeButtonVisible = !inline?.hideCloseButton;
  const closeButtonRef = useRef(closeButtonVisible);
  closeButtonRef.current = closeButtonVisible;
  /** What the loaded page shows. Sent only on a change, so an app that never hides it never sends the command. */
  const pageCloseButton = useRef(true);
  const syncCloseButton = useCallback(() => {
    if (!readyRef.current || pageCloseButton.current === closeButtonRef.current) return;
    send('setCloseButton', { visible: closeButtonRef.current });
    pageCloseButton.current = closeButtonRef.current;
  }, [send]);

  useEffect(() => {
    syncCloseButton();
  }, [closeButtonVisible, syncCloseButton]);

  const emit = useCallback(<E extends TalquiEventName>(name: E, payload: TalquiEventMap[E]) => {
    listeners.current.get(name)?.forEach((listener) => {
      try {
        (listener as TalquiEventListener<E>)(payload);
      } catch (error) {
        console.error('[talqui] event listener failed', error);
      }
    });
  }, []);

  const replayAll = useCallback(() => {
    const state = replay.current;
    if (state.contact) send('setContact', state.contact);
    if (Object.keys(state.contactMeta).length) send('setContactMeta', state.contactMeta);
    if (Object.keys(state.sessionMeta).length) send('setSessionMeta', state.sessionMeta);
    send('setVisibility', { visible: visibleRef.current });
    // A freshly loaded page shows the control again.
    pageCloseButton.current = true;
    syncCloseButton();
    if (state.prefill) {
      send('prefill', { text: state.prefill });
      state.prefill = null;
    }
  }, [send, syncCloseButton]);

  const closeOverlay = useCallback(() => setIsOpen(false), []);
  const inlineRef = useRef(inline);
  inlineRef.current = inline;

  const handleMessage = useCallback(
    (raw: string) => {
      const event = parseEvent(raw);
      if (!event) return;
      log('←', event.name, event.payload);

      switch (event.name) {
        case 'ready': {
          readyRef.current = true;
          setIsReady(true);
          // The page minted an anonymous identity: keep it, so this device stays the same visitor.
          // The URL is not touched — the running page already is that visitor.
          const minted = event.payload.identity?.anonymousId;
          if (minted && !identity.current) {
            identity.current = { kind: 'anonymous', id: minted };
            void writeIdentity(tenantId, identity.current);
          }
          replayAll();
          break;
        }
        case 'unreadChanged':
          setUnreadCount(event.payload.count);
          break;
        case 'openUrl':
          if (onOpenUrl) onOpenUrl(event.payload.url);
          else void Linking.openURL(event.payload.url).catch(() => undefined);
          break;
        case 'closeRequested':
          if (inlineRef.current) inlineRef.current.onCloseRequested?.();
          else closeOverlay();
          break;
        case 'error':
          warn(`${event.payload.code}: ${event.payload.message}`);
          break;
        default:
          break;
      }

      emit(event.name, event.payload as never);
    },
    [log, tenantId, replayAll, onOpenUrl, closeOverlay, warn, emit],
  );

  const handleLoadStart = useCallback(() => {
    readyRef.current = false;
    setIsReady(false);
  }, []);

  // A new page (another user, logout) starts with nothing unread.
  const remount = useCallback((next: Identity | null) => {
    readyRef.current = false;
    setIsReady(false);
    setUnreadCount(0);
    setBootIdentity(next);
    setPageKey((key) => key + 1);
  }, []);

  // --- Android back button closes the full-screen chat ---------------------------------------
  useEffect(() => {
    if (!isOpen || inline) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlay();
      return true;
    });
    return () => subscription.remove();
  }, [isOpen, inline, closeOverlay]);

  // --- public API -----------------------------------------------------------------------------
  const setContact = useCallback(
    (contact: TalquiContact) => {
      const next = { ...replay.current.contact, ...contact };
      replay.current.contact = next;
      send('setContact', next);
    },
    [send],
  );

  const setMeta = useCallback(
    (target: 'contactMeta' | 'sessionMeta', meta: TalquiMeta) => {
      const normalized = normalizeMeta(meta, warn);
      if (!Object.keys(normalized).length) return;
      replay.current[target] = { ...replay.current[target], ...normalized };
      send(target === 'contactMeta' ? 'setContactMeta' : 'setSessionMeta', normalized);
    },
    [send, warn],
  );

  const logout = useCallback(async () => {
    if (readyRef.current && webview.current) {
      // Ask the page to drop the conversation now (socket included), but never hang on it:
      // the remount below discards the page either way.
      await new Promise<void>((resolve) => {
        const timer = setTimeout(done, RESET_TIMEOUT_MS);
        const unsubscribe = subscribeRef.current('resetDone', done);
        function done() {
          clearTimeout(timer);
          unsubscribe();
          resolve();
        }
        send('reset', {});
      });
    }
    await clearIdentity(tenantId);
    identity.current = null;
    // The previous user's details must not be replayed into the next page.
    replay.current = emptyReplay();
    remount(null);
  }, [send, tenantId, remount]);

  const identify = useCallback(
    async (user: TalquiUser) => {
      const { userHash, name, email, phone } = user;
      if (userHash !== undefined) {
        if (!USER_HASH_PATTERN.test(userHash)) {
          warn('identify: userHash must be 32 to 128 chars of A-Z a-z 0-9 _ - (compute it on your backend). Ignored.');
        } else if (identity.current?.kind !== 'identified' || identity.current.id !== userHash) {
          const next: Identity = { kind: 'identified', id: userHash };
          identity.current = next;
          await writeIdentity(tenantId, next);
          // Another person: nothing from the previous one may carry over.
          replay.current = emptyReplay();
          remount(next);
        }
      }
      const contact: TalquiContact = {};
      if (name) contact.name = name;
      if (email) contact.email = email;
      if (phone) contact.phone = phone;
      if (Object.keys(contact).length) setContact(contact);
    },
    [tenantId, warn, remount, setContact],
  );

  const subscribe = useCallback(<E extends TalquiEventName>(name: E, listener: TalquiEventListener<E>) => {
    const set = listeners.current.get(name) ?? new Set();
    set.add(listener as (payload: never) => void);
    listeners.current.set(name, set);
    return () => {
      set.delete(listener as (payload: never) => void);
    };
  }, []);
  const subscribeRef = useRef(subscribe);
  subscribeRef.current = subscribe;

  const api = useMemo<TalquiApi>(() => {
    if (!supported) {
      const unsupported = () => warn('the chat SDK runs on iOS and Android only; on the web use the WebChat snippet.');
      return {
        open: unsupported,
        close: unsupported,
        preload: unsupported,
        identify: async () => unsupported(),
        setContact: unsupported,
        setContactMeta: unsupported,
        setSessionMeta: unsupported,
        prefill: unsupported,
        logout: async () => unsupported(),
        unreadCount: 0,
        isReady: false,
        isOpen: false,
      };
    }
    return {
      open: () => {
        if (inlineRef.current) warn('open() ignored: <TalquiChat /> is on screen and already shows the chat.');
        setOverlayMounted(true);
        setIsOpen(true);
      },
      close: closeOverlay,
      preload: () => setOverlayMounted(true),
      identify,
      setContact,
      setContactMeta: (meta) => setMeta('contactMeta', meta),
      setSessionMeta: (meta) => setMeta('sessionMeta', meta),
      prefill: (text) => {
        const trimmed = typeof text === 'string' ? text.trim().slice(0, 1000) : '';
        if (!trimmed) return;
        if (readyRef.current) send('prefill', { text: trimmed });
        else replay.current.prefill = trimmed;
      },
      logout,
      unreadCount,
      isReady,
      isOpen,
    };
  }, [supported, warn, closeOverlay, identify, setContact, setMeta, send, logout, unreadCount, isReady, isOpen]);

  // --- rendering --------------------------------------------------------------------------------
  const renderWebView = useCallback(
    (style: object | undefined) =>
      identityLoaded ? (
        <TalquiWebView
          key={pageKey}
          ref={webview}
          url={url}
          allowedOrigin={allowedOrigin}
          isReady={isReady}
          onMessage={handleMessage}
          onLoadStart={handleLoadStart}
          onOpenUrl={onOpenUrl}
          renderLoading={renderLoading}
          renderError={renderError}
          style={style}
          debug={debug}
        />
      ) : null,
    [identityLoaded, pageKey, url, allowedOrigin, isReady, handleMessage, handleLoadStart, onOpenUrl, renderLoading, renderError, debug],
  );

  const internals = useMemo<TalquiInternals>(
    () => ({
      renderWebView,
      registerInline: (host) => {
        setInline(host);
        setIsOpen(false);
        return () => setInline(null);
      },
      updateInline: (host) => setInline(host),
    }),
    [renderWebView],
  );

  const value = useMemo(() => ({ api, internals, subscribe }), [api, internals, subscribe]);

  return (
    <TalquiContext.Provider value={value}>
      {children}
      {/* One chat page at a time: while <TalquiChat /> is on screen it owns the WebView. */}
      {supported && overlayMounted && !inline && (
        <View style={[styles.overlay, !isOpen && styles.hidden]} pointerEvents={isOpen ? 'auto' : 'none'}>
          {renderWebView(undefined)}
        </View>
      )}
    </TalquiContext.Provider>
  );
}

/** The Talqui chat API. Must be used under `<TalquiProvider>`. */
export function useTalqui(): TalquiApi {
  return useTalquiContext().api;
}

/** Runs `listener` for every `name` event from the chat while the component is mounted. */
export function useTalquiEvent<E extends TalquiEventName>(name: E, listener: TalquiEventListener<E>): void {
  const { subscribe } = useTalquiContext();
  const latest = useRef(listener);
  latest.current = listener;
  useEffect(() => subscribe(name, (payload) => latest.current(payload)), [subscribe, name]);
}

export function useTalquiContext(): TalquiContextValue {
  const context = useContext(TalquiContext);
  if (!context) {
    throw new Error('[talqui] useTalqui must be used inside <TalquiProvider>.');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: '#FFFFFF',
    // Android draws the app under the status bar; the page only knows about the iOS safe areas.
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  },
  // Hidden, not unmounted: the conversation keeps running so unread messages are counted.
  hidden: { opacity: 0, transform: [{ translateY: 100_000 }] },
});
