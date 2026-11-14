/**
 * Where the example connects. The defaults are the Talqui demo workspace;
 * replace them with your own ids (app.talqui.chat → Plugins → WebChat →
 * Installation), or set them in `.env` without touching the code:
 *
 *   EXPO_PUBLIC_TALQUI_TENANT_ID=…
 *   EXPO_PUBLIC_TALQUI_CONNECTION_ID=…
 */
export const TALQUI_TENANT_ID = process.env.EXPO_PUBLIC_TALQUI_TENANT_ID ?? 'a0047199-8537-4f7d-bef8-2fae04a7ffd6';
export const TALQUI_CONNECTION_ID = process.env.EXPO_PUBLIC_TALQUI_CONNECTION_ID ?? 'a575c54c-4f0e-49e9-87c1-1b80df59e9df';

/** Only for developing the SDK against a local WebChat. Leave unset. */
export const TALQUI_BASE_URL = process.env.EXPO_PUBLIC_TALQUI_BASE_URL;
