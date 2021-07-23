
// https://en.wikipedia.org/wiki/Braille_Patterns

export function fromBitmap(bitmap) {
  let byte = 0
  for (let i=0; i<bitmap.length; i++) {
    if (!bitmap[i]) continue
    if (i < 6) byte |= 1 << i/2 + (i%2 ? 3 : 0)
    else byte |= 1 << i
  }
  return String.fromCharCode(0x2800+byte)
}

export function bars(bar1, bar2, fromTop = false) {
  const b = []
  for (let i=0; i<4; i++) {
    if (bar1 > i) fromTop ? b[i*2]   = 1 : b[(3-i)*2]   = 1
    if (bar2 > i) fromTop ? b[i*2+1] = 1 : b[(3-i)*2+1] = 1
  }
  return fromBitmap(b)
}
