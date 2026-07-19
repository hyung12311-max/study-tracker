let authenticatedMember = null
let familyApiToken = null

export function isAuthorizedDayul(auth) {
  const member = auth?.member
  return Boolean(auth?.token && auth?.realtimeToken && member?.id && member?.family_id && member?.role === 'child' && member?.member_key === 'dayul')
}

export async function restoreDayulAuth() {
  try {
    // Reuse study-tracker's existing token validation and storage policy.
    const familyAuth = await import(/* @vite-ignore */ '/js/family-auth.js')
    const auth = familyAuth.restoreFamilyAuth()
    if (!isAuthorizedDayul(auth)) {
      authenticatedMember = null
      familyApiToken = null
      return null
    }
    familyApiToken = auth.token
    authenticatedMember = Object.freeze({ id: auth.member.id, family_id: auth.member.family_id, member_key: auth.member.member_key, role: auth.member.role, display_name: auth.member.display_name || '다율이' })
    return { member: authenticatedMember }
  } catch (error) {
    authenticatedMember = null
    familyApiToken = null
    console.warn('[hangul auth] study-tracker authentication is unavailable', error)
    return null
  }
}

export function currentDayulMember() { return authenticatedMember }
export function currentFamilyApiToken() { return familyApiToken }
