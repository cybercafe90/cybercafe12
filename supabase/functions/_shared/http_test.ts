import { assertEquals, assertMatch } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { createTrackingReference, normalizeMobile } from './http.ts'

Deno.test('tracking references are unique and match the database format', () => {
  const references = new Set(Array.from({ length: 1000 }, createTrackingReference))
  assertEquals(references.size, 1000)
  for (const reference of references) assertMatch(reference, /^BABA-[A-HJ-NP-Z2-9]{10}$/)
})

Deno.test('mobile numbers normalize to the stored Indian international form', () => {
  assertEquals(normalizeMobile('7006865909'), '+917006865909')
  assertEquals(normalizeMobile('07006865909'), '+917006865909')
  assertEquals(normalizeMobile('+91 70068 65909'), '+917006865909')
  assertEquals(normalizeMobile('abc'), null)
  assertEquals(normalizeMobile(null), null)
})
