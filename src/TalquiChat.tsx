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
  /**
   * Hides the close control in the chat header, which has nothing to close in
   * a tab. Default `false`. Only affects the chat shown here: `open()` full
   * screen always keeps it.
   */
  hideCloseButton?: boolean;
}

/**
 * The chat inline, filling its container — for a "Chat" tab or a screen of
 * your own. While it is on screen `open()` does nothing; once the screen is
 * left (a tab navigator keeps it mounted), `open()` shows the chat full screen.
 */
export function TalquiChat({ style, visible = true, onCloseRequested, hideCloseButton = false }: TalquiChatProps) {
  const { internals } = useTalquiContext();
  const host = useRef({ visible, onCloseRequested, hideCloseButton });
  host.current = { visible, onCloseRequested, hideCloseButton };

  useEffect(() => internals.registerInline(host.current), [internals]);
  useEffect(
    () => internals.updateInline({ visible, onCloseRequested, hideCloseButton }),
    [internals, visible, onCloseRequested, hideCloseButton],
  );

  return <>{internals.renderInline(style as object | undefined)}</>;
}
