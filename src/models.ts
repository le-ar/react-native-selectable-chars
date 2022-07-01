import { TextStyle } from 'react-native'

export interface CustomSelection {
  start: number
  end: number
  hint?: string
  color?: string
}

export interface SelectCharsText {
  text: string
  style?: TextStyle
}

export interface Char {
  id: number
  char: string
  style?: TextStyle
}

export interface CharPos {
  char: Char
  line: number
  pos: {
    left: number
    top: number
    right: number
    bottom: number
  }
}

export interface SelectCharsLine {
  text: Char[]
  y: number
  ascender: number
  height: number
}

export interface SelectCharsTextLine extends SelectCharsText {
  y: number
  ascender: number
  height: number
}

export function isSameSelectCharsLine(
  lineA: SelectCharsLine,
  lineB: SelectCharsLine
): boolean {
  if (
    lineA.ascender !== lineB.ascender ||
    lineA.height !== lineB.height ||
    lineA.text.length !== lineB.text.length ||
    lineA.y !== lineB.y
  ) {
    return false
  }

  for (let i = 0; i < lineA.text.length; i++) {
    if (!isSameChar(lineA.text[i], lineB.text[i])) {
      return false
    }
  }

  return true
}

function isSameChar(charA: Char, charB: Char): boolean {
  return (
    charA.char === charB.char &&
    charA.id === charB.id &&
    charA.style === charB.style
  )
}
