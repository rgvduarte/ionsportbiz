import { Capacitor } from '@capacitor/core';

/** true dentro das apps iOS/Android (Capacitor); false no browser. */
export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';
