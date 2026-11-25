import type { FontAPI } from '../shared/ipc-contract'

declare global {
  interface Window {
    fontAPI: FontAPI
  }
}
