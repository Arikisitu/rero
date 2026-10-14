import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.rero.app',
  appName: 'Rero',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
}

export default config
