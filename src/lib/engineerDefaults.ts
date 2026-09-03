/**
 * "Engineer defaults are remembered from last use" (Visit Setup, §4.2) — a
 * plain localStorage entry rather than a Dexie query, since it's a
 * per-device UI convenience, not report data.
 */

const STORAGE_KEY = 'site-wizard:last-engineer'

export interface EngineerDefaults {
  engineerName: string
  engineerTitle: string
  engineerCredential: string
}

export function getEngineerDefaults(): EngineerDefaults {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { engineerName: '', engineerTitle: '', engineerCredential: '' }
    const parsed = JSON.parse(raw)
    return {
      engineerName: typeof parsed.engineerName === 'string' ? parsed.engineerName : '',
      engineerTitle: typeof parsed.engineerTitle === 'string' ? parsed.engineerTitle : '',
      engineerCredential: typeof parsed.engineerCredential === 'string' ? parsed.engineerCredential : '',
    }
  } catch {
    return { engineerName: '', engineerTitle: '', engineerCredential: '' }
  }
}

export function saveEngineerDefaults(defaults: EngineerDefaults): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  } catch {
    // Private browsing / storage disabled — defaults just won't persist.
  }
}
