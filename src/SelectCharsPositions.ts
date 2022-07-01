import { CharPos } from './models'

export class SelectCharsPositions {
  private charsPositions: CharPos[] = []
  private listeners: (() => void)[] = []
  private charsPositionsSettedUp = 0

  constructor(textLength: number) {
    this.init(textLength)
  }

  addListener(cb: () => void) {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  init(textLength: number) {
    this.charsPositionsSettedUp = 0
    this.charsPositions = Array.from({ length: textLength }).map(
      (_, i) =>
        ({
          char: { char: '', id: i },
          line: -1,
          pos: { left: 0, right: 0, top: 0, bottom: 0 },
        } as CharPos)
    )
  }

  getFirstLineWidth(selectFromId: number, selectToId: number): number {
    let result: number = 0
    this.iterateFirstLine(selectFromId, selectToId, (char) => {
      result += char.pos.right - char.pos.left
    })
    return result
  }

  getFirstLine(selectFromId: number, selectToId: number): CharPos[] {
    const result: CharPos[] = []
    this.iterateFirstLine(selectFromId, selectToId, (char) => {
      result.push(char)
    })

    return result
  }

  iterateFirstLine(
    selectFromId: number,
    selectToId: number,
    cb: (char: CharPos) => void
  ) {
    const firstChar = this.getById(selectFromId)
    if (firstChar == null) {
      return
    }

    for (let i = selectFromId; i <= selectToId; i++) {
      const char = this.getById(i)
      if (char == null) {
        continue
      }

      const isFirstLineAndSelected =
        this.isSameLine(char, firstChar) &&
        this.isSelected(char, selectFromId, selectToId)

      if (isFirstLineAndSelected) {
        cb(char)
      } else {
        return
      }
    }
  }

  getById(id: number): CharPos | undefined {
    return this.charsPositions[id]
  }

  isSameLine(charA: CharPos, charB: CharPos) {
    return charA.line === charB.line
  }

  isSelected(char: CharPos, selectFromId: number, selectToId: number) {
    return selectFromId <= char.char.id && char.char.id <= selectToId
  }

  findByPosition(x: number, y: number, chars?: CharPos[]): CharPos | undefined {
    const charsPositions = chars ?? this.charsPositions
    const line = this.findByPositionY(charsPositions, y)
    return this.findByPositionX(line, x)
  }

  findByPositionX(chars: CharPos[], x: number): CharPos | undefined {
    if (chars.length < 1) {
      return void 0
    }

    let left = 0
    let right = chars.length - 1
    while (left <= right) {
      let mid = Math.floor((left + right) / 2)

      if (this.isXInChar(chars[mid], x)) {
        return chars[mid]
      } else if (chars[mid].pos.left > x) {
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    return void 0
  }

  findByPositionY(chars: CharPos[], y: number): CharPos[] {
    if (chars.length < 1) {
      return []
    }

    let left = 0
    let right = chars.length - 1
    let firstId: number | null = null
    while (left <= right) {
      let mid = Math.floor((left + right) / 2)

      if (this.isYInChar(chars[mid], y)) {
        firstId = mid
        right = mid - 1
      } else if (chars[mid].pos.top > y) {
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    if (firstId == null) {
      return []
    }

    const result: CharPos[] = []
    for (
      let i = firstId;
      i < chars.length && this.isYInChar(chars[i], y);
      i++
    ) {
      result.push(chars[i])
    }

    return result
  }

  isDotInChar(char: CharPos, x: number, y: number): boolean {
    return this.isXInChar(char, x) && this.isYInChar(char, y)
  }

  isXInChar(char: CharPos, x: number): boolean {
    return char.pos.left <= x && x <= char.pos.right
  }

  isYInChar(char: CharPos, y: number): boolean {
    return char.pos.top <= y && y <= char.pos.bottom
  }

  setChar(char: CharPos) {
    if (this.getById(char.char.id) != null) {
      let wasSettedUp = this.charsPositions[char.char.id].line > -1
      this.charsPositions[char.char.id] = char

      if (!wasSettedUp) {
        this.charsPositionsSettedUp++
        if (this.charsPositionsSettedUp >= this.charsPositions.length) {
          this.emit()
        }
      }
    }
  }

  emit() {
    this.listeners.forEach((l) => l())
  }
}
