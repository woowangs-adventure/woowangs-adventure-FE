import assert from 'node:assert/strict'
import test from 'node:test'
import { controlKey } from '../src/features/robot-keyboard.ts'

test('Korean and English inputs resolve to the same physical drive keys', () => {
  for (const [code, key, expected] of [
    ['KeyW', 'ㅈ', 'w'], ['KeyA', 'ㅁ', 'a'],
    ['KeyS', 'ㄴ', 's'], ['KeyD', 'ㅇ', 'd'],
    ['KeyW', 'W', 'w'], ['KeyW', 'Process', 'w'],
  ]) assert.equal(controlKey({ code, key }), expected)
})

test('release after input language change clears the pressed key', () => {
  const keys = new Set([controlKey({ code: 'KeyW', key: 'ㅈ' })])
  keys.delete(controlKey({ code: 'KeyW', key: 'w' }))
  assert.equal(keys.size, 0)
})

test('arrows and Space are retained; unrelated physical keys are ignored', () => {
  assert.equal(controlKey({ code: 'ArrowUp', key: 'ArrowUp' }), 'arrowup')
  assert.equal(controlKey({ code: 'Space', key: ' ' }), ' ')
  assert.equal(controlKey({ code: 'KeyQ', key: 'w' }), null)
  assert.equal(controlKey({ code: '', key: 'W' }), 'w')
})
