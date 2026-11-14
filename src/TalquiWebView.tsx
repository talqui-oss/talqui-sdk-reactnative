import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

/** How long the page may take to say it is ready before it is reloaded once, then shown as failed. */
const READY_TIMEOUT_MS = 15_000;
const BACKGROUND = '#FFFFFF';

export interface TalquiWebViewHandle {
  inject(script: string): void;
}

interface Props {
  url: string;
  /** Origin the WebView may navigate to; every other link goes to the system. */
  allowedOrigin: string;
  isReady: boolean;
  onMessage(raw: string): void;
  onLoadStart(): void;
  onOpenUrl?: (url: string) => void;
  renderLoading?: () => ReactNode;
  renderError?: (retry: () => void) => ReactNode;
  style?: StyleProp<ViewStyle>;
  debug?: boolean;
}

/**
 * The WebView that runs the chat page, with everything that tends to go wrong
 * in a chat WebView handled here once:
 *
 * - links never navigate inside it (they would replace the chat with no way back);
 * - camera, microphone, inline media and file pickers are allowed;
 * - a page killed by the OS in the background (blank white screen) is reloaded;
 * - a page that never becomes ready is reloaded once, then shown as failed with a retry.
 */
export const TalquiWebView = forwardRef<TalquiWebViewHandle, Props>(function TalquiWebView(props, ref) {
  const { url, allowedOrigin, isReady, onMessage, onLoadStart, onOpenUrl, renderLoading, renderError, style, debug } = props;
  const webview = useRef<WebView>(null);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({ inject: (script) => webview.current?.injectJavaScript(script) }), []);

  // Watchdog: restarted on every new page (url) and every reload attempt.
  useEffect(() => {
    if (isReady || failed) return undefined;
    const timer = setTimeout(() => {
      if (attempt === 0) {
        if (debug) console.log('[talqui] chat did not become ready, reloading once');
        setAttempt(1);
        webview.current?.reload();
      } else {
        setFailed(true);
      }
    }, READY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReady, failed, attempt, url, debug]);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [url]);

  const retry = useCallback(() => {
    setAttempt(0);
    setFailed(false);
    webview.current?.reload();
  }, []);

  const openOutside = useCallback(
    (target: string) => {
      if (onOpenUrl) onOpenUrl(target);
      else void Linking.openURL(target).catch(() => undefined);
    },
    [onOpenUrl],
  );

  const shouldStart = useCallback(
    (request: ShouldStartLoadRequest) => {
      // Sub-frames (embedded media) load freely; only the page itself is guarded.
      if (request.isTopFrame === false) return true;
      if (request.url === 'about:blank' || request.url.startsWith(allowedOrigin)) return true;
      openOutside(request.url);
      return false;
    },
    [allowedOrigin, openOutside],
  );

  const reloadAfterCrash = useCallback(() => webview.current?.reload(), []);

  return (
    <View style={[styles.root, style]}>
      <WebView
        ref={webview}
        source={{ uri: url }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={shouldStart}
        onMessage={(event: WebViewMessageEvent) => onMessage(event.nativeEvent.data)}
        onLoadStart={onLoadStart}
        onContentProcessDidTerminate={reloadAfterCrash}
        onRenderProcessGone={() => {
          reloadAfterCrash();
          return true;
        }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        allowFileAccess
        setSupportMultipleWindows={false}
        keyboardDisplayRequiresUserAction={false}
        // The page draws its own safe areas (viewport-fit=cover).
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        overScrollMode="never"
        style={styles.webview}
        webviewDebuggingEnabled={debug === true}
      />
      {!isReady && !failed && (
        <View style={styles.cover} pointerEvents="none">
          {renderLoading ? renderLoading() : <ActivityIndicator />}
        </View>
      )}
      {failed && (
        <View style={styles.cover}>
          {renderError ? (
            renderError(retry)
          ) : (
            <View style={styles.error}>
              <Text style={styles.errorText}>Não foi possível carregar o chat.</Text>
              <Pressable accessibilityRole="button" onPress={retry} style={styles.retry} hitSlop={8}>
                <Text style={styles.retryText}>Tentar de novo</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  webview: { flex: 1, backgroundColor: BACKGROUND },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: BACKGROUND },
  error: { alignItems: 'center', gap: 12, padding: 24 },
  errorText: { fontSize: 15, color: '#353849', textAlign: 'center' },
  retry: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1A66FF', minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#FFFFFF', fontSize: 15, fontWeight: Platform.OS === 'ios' ? '600' : 'bold' },
});
