import { useCallback } from 'react'
import { usePermissionsStore } from '../store/permissionsStore'
import api from '../api/axios'

/**
 * usePermissions — returns helpers to read from the permissions store.
 *
 * can(key)  → true if the permission key is truthy (falls back to true for unknown keys)
 * permissions → raw permissions object
 */
export function usePermissions() {
  const { permissions } = usePermissionsStore()

  const can = useCallback(
    (key) => {
      if (!(key in permissions)) return true   // unknown keys default to allowed
      return Boolean(permissions[key])
    },
    [permissions]
  )

  return { can, permissions }
}

/**
 * useMyPermissions — fetches /permissions/my from the API and
 * syncs the result into the permissions store.
 * On 401/403 or network errors it silently falls back to defaults.
 *
 * Returns { loading, refresh } — call refresh() to re-fetch at any time.
 */
export function useMyPermissions() {
  const { setPermissions, reset } = usePermissionsStore()

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/permissions/my', { silent: true })
      if (data && typeof data === 'object') {
        setPermissions(data)
      }
    } catch (err) {
      const status = err?.response?.status
      if (status === 401 || status === 403) {
        // Not authorised — fall back to defaults
        reset()
      }
      // For all other errors (network, 5xx) keep whatever is currently stored
    }
  }, [setPermissions, reset])

  return { refresh }
}
