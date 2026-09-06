// Physical keys keep robot controls stable across Korean/English input and Shift.
const controlCodes: Record<string, string> = {
  KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
  ArrowUp: 'arrowup', ArrowDown: 'arrowdown',
  ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', Space: ' ',
}

export function controlKey(event: { code: string; key: string }): string | null {
  if (event.code) return controlCodes[event.code] ?? null
  // Fallback for environments that don't provide KeyboardEvent.code.
  const key = event.key.toLowerCase()
  return Object.values(controlCodes).includes(key) ? key : null
}
