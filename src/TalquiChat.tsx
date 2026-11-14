import { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { useTalquiContext } from './TalquiProvider';

export interface TalquiChatProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Whether this screen is the one on screen (unread messages are counted
   * while it is not). With React Navigation pass `useIsFocused()`.
   */
  visible?: boolean;
  /** The user tapped close in the chat header. */
  onCloseRequested?: () => void;
}

/**
 * The chat inline, filling its container — for a "Chat" tab or a screen of
 * your own. While it is mounted it owns the chat page, and `open()` does nothing.
 */
export function TalquiChat({ style, visible = true, onCloseRequested }: TalquiChatProps) {
  const { internals } = useTalquiContext();
  const host = useRef({ visible, onCloseRequested });
  host.current = { visible, onCloseRequested };

  useEffect(() => internals.registerInline(host.current), [internals]);
  useEffect(() => internals.updateInline({ visible, onCloseRequested }), [internals, visible, onCloseRequested]);

  return <>{internals.renderWebView(style as object | undefined)}</>;
}
