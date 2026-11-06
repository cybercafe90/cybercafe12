import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { tokenHasAal2 } from './auth.ts'

function tokenWithClaims(claims: Record<string, unknown>) {
  const payload = btoa(JSON.stringify(claims)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${payload}.signature`
}

Deno.test('owner authorization accepts only verified AAL2 JWT claims', () => {
  assertEquals(tokenHasAal2(tokenWithClaims({ aal: 'aal2', sub: 'owner' })), true)
  assertEquals(tokenHasAal2(tokenWithClaims({ aal: 'aal1', sub: 'owner' })), false)
  assertEquals(tokenHasAal2(tokenWithClaims({ sub: 'owner' })), false)
  assertEquals(tokenHasAal2('not-a-jwt'), false)
})
