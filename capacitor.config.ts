/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />
import type { CapacitorConfig } from '@capacitor/cli';

// Apps iOS e Android (Capacitor). Ver docs/apps-nativas.md.
//
// appId: identificador da app nas lojas, em domínio invertido (ionsportsbiz.com). Depois do primeiro envio
// para a App Store / Google Play não pode ser alterado; mudá-lo implica mudar também ios/ e android/ (ver documentação).

const ACCENT = '#000000';

const config: CapacitorConfig = {
  appId: 'com.ionsportsbiz.convidados',
  appName: 'ion Convidados',
  webDir: 'dist',
  // Cor por trás da WebView enquanto a página carrega (igual ao ecrã inicial).
  backgroundColor: ACCENT,
  android: {
    allowMixedContent: false,
    // Só se pode inspecionar a WebView em builds de desenvolvimento.
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'never',
    // O código de verificação do iOS (Associated Domains) e o esquema convites:// estão no projeto ios/.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      // Fica visível até a app desenhar o primeiro ecrã (src/native/init.ts esconde-o).
      launchAutoHide: false,
      backgroundColor: ACCENT,
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: ACCENT,
      overlaysWebView: false,
    },
  },
};

export default config;
