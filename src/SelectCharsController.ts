import React from 'react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  CharPos,
  isSameSelectCharsLine,
  SelectCharsLine,
  SelectCharsTextLine,
} from './models'

export interface SelectCharsController {
  lines: SelectCharsLine[]
  textLines: SelectCharsTextLine[]
  charsPositions: React.MutableRefObject<CharPos[]>

  isSelecting?: string
  setIsSelecting: (isSeleting?: string) => void

  currentChar: CharPos | undefined
  selectFromId: number
  selectToId: number
  startSelectId: number
  setStartSelectedId: (startSelectId: number) => void
  endSelectId: number
  endSelectIdRef: React.MutableRefObject<number>
  setEndSelectedId: (endSelectId: number) => void

  setLines: (textLines: SelectCharsTextLine[]) => void
  findByTouch: (x: number, y: number) => CharPos | undefined

  startSelect: (x: number, y: number) => void
  continueSelect: (x: number, y: number) => void

  contextMenu?: JSX.Element
  paddingTop: number
  paddingLeft: number

  hintUpdateId: number
  setHintUpdateId: (cb: (hintUpdateId: number) => number) => void
}

export function useSelectCharsController(
  textLength: number,
  paddingTop: number,
  paddingLeft: number,
  onStartSelect?: () => void,
  onEndSelect?: () => void,
  onSelect?: (
    start: number,
    end: number,
    topY: number,
    centerX: number,
    cancelSelect: () => void
  ) => void | false | JSX.Element
): SelectCharsController {
  const [textLines, setLines] = useState<SelectCharsTextLine[]>([])
  const lines: SelectCharsLine[] = useMemo(
    () => convertToSelectCharsLine(textLines),
    [textLines]
  )

  const [contextMenu, setContextMenu] = useState<JSX.Element>()
  const [hintUpdateId, setHintUpdateId] = useState<number>(0)
  const [isSelecting, setIsSelecting] = useState<string>()
  const charsPositions = useRef<CharPos[]>([])
  const [startSelectId, setStartSelectedId] = useState(-1)
  const [endSelectId, setEndSelectedId] = useState(-1)
  const selectFromId =
    startSelectId < endSelectId
      ? startSelectId
      : endSelectId > -1
      ? endSelectId
      : startSelectId
  const selectToId = startSelectId < endSelectId ? endSelectId : startSelectId
  const endSelectIdRef = useRef(-1)

  const initCharPositions = () => {
    charsPositions.current = Array.from({ length: textLength }).map(
      (_, i) =>
        ({
          char: { char: '', id: i },
          line: -1,
          pos: { left: 0, right: 0, top: 0, bottom: 0 },
        } as CharPos)
    )
  }

  const cancelSelect = () => {
    setStartSelectedId(-1)
    setEndSelectedId(-1)
    setIsSelecting(void 0)
  }

  useEffect(() => {
    if (isSelecting == null) {
      if (onEndSelect != null) {
        onEndSelect()
      }
      if (onSelect != null) {
        if (selectFromId > -1) {
          const startX = charsPositions.current[selectFromId].pos.left
          const startY = charsPositions.current[selectFromId].pos.top
          const line = charsPositions.current[selectFromId].line
          let width = 0
          const firstLine = charsPositions.current.filter((char) => {
            if (
              char.line === line &&
              selectFromId <= char.char.id &&
              char.char.id <= selectToId
            ) {
              width += char.pos.right - char.pos.left
              return true
            }
            return false
          })

          const result = onSelect(
            selectFromId,
            selectToId,
            startY,
            startX + width / 2,
            cancelSelect
          )
          if (result === false) {
            setStartSelectedId(-1)
            setEndSelectedId(-1)
            setIsSelecting(void 0)
          } else if (React.isValidElement(result as {})) {
            setContextMenu(result as JSX.Element)
          }
        }
      }
    } else {
      if (onStartSelect != null) {
        onStartSelect()
        setContextMenu(void 0)
      }
    }
  }, [isSelecting, onStartSelect, onEndSelect])

  useEffect(() => {
    if (startSelectId === -1) {
      setContextMenu(void 0)
    }
  }, [startSelectId])

  const setEndSelectedIdR = (endSelectId: number) => {
    endSelectIdRef.current = endSelectId
    setEndSelectedId(endSelectId)
  }

  const prevLines = useRef<SelectCharsLine[]>([])
  // useLayoutEffect(() => {
  //   if (lines.length === prevLines.current.length) {
  //     const isSame = lines.every((l, i) =>
  //       isSameSelectCharsLine(l, prevLines.current[i])
  //     )
  //     if (isSame) {
  //       return
  //     }
  //   }

  //   prevLines.current = lines
  //   initCharPositions()
  // }, [lines])
  useLayoutEffect(() => {
    initCharPositions()
  }, [textLength])

  const currentChar = useMemo(
    () => charsPositions.current.find((char) => char.char.id === endSelectId),
    [endSelectId, lines]
  )

  const findByTouch = useCallback(
    (x: number, y: number) => {
      return charsPositions.current.find(
        (cp) =>
          cp.pos.left <= x &&
          x <= cp.pos.right &&
          cp.pos.top <= y &&
          y <= cp.pos.bottom
      )
    },
    [charsPositions.current]
  )

  const startSelect = (x: number, y: number) => {
    const char = findByTouch(x, y)

    if (char !== null) {
      setIsSelecting('default')
    }

    setStartSelectedId(char?.char.id ?? -1)
    setEndSelectedIdR(char?.char.id ?? -1)
  }

  const continueSelect = (x: number, y: number) => {
    if (startSelectId > -1) {
      const char = findByTouch(x, y)

      const currChar = charsPositions.current.find(
        (char) => char.char.id === endSelectIdRef.current
      )
      if (char == null && currChar != null) {
        const curr = currChar.pos
        const nextChar = findByTouch(x, curr.top + curr.bottom - curr.top)
        setEndSelectedIdR(nextChar?.char.id ?? endSelectIdRef.current)
        return
      }

      setEndSelectedIdR(char?.char.id ?? endSelectIdRef.current)
    }
  }

  return {
    paddingTop,
    paddingLeft,
    lines,
    textLines,
    currentChar,
    charsPositions,
    isSelecting,
    setIsSelecting,
    hintUpdateId,
    setHintUpdateId,
    selectFromId,
    selectToId,
    startSelectId,
    endSelectId,
    endSelectIdRef,
    contextMenu,
    startSelect,
    continueSelect,
    setEndSelectedId: setEndSelectedIdR,
    setStartSelectedId,
    setLines,
    findByTouch,
  }
}

function convertToSelectCharsLine(
  lines: SelectCharsTextLine[]
): SelectCharsLine[] {
  let id = 0
  return lines.map((line) => ({
    y: line.y,
    text: line.text.split('').map((char) => ({ id: id++, char })),
    ascender: line.ascender,
    height: line.height,
  }))
}
