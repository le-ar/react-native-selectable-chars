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
import { SelectCharsPositions } from './SelectCharsPositions'

export interface SelectCharsController {
  lines: SelectCharsLine[]
  textLines: SelectCharsTextLine[]
  charsPositions: React.MutableRefObject<SelectCharsPositions>

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

  isReady: boolean
  setIsReady: (isReady: boolean) => void
}

export function useSelectCharsController(
  selectEnabled: boolean,
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

  const [isReady, setIsReady] = useState<boolean>(false)
  const [contextMenu, setContextMenu] = useState<JSX.Element>()
  const [hintUpdateId, setHintUpdateId] = useState<number>(0)
  const [isSelecting, setIsSelectingR] = useState<string>()
  const charsPositions = useRef<SelectCharsPositions>(
    new SelectCharsPositions(textLength)
  )
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

  const cancelSelect = () => {
    setStartSelectedId(-1)
    setEndSelectedId(-1)
    setIsSelectingR(void 0)
  }

  useEffect(() => {
    const remove = charsPositions.current.addListener(() => {
      setIsReady(true)
    })

    return () => {
      remove()
    }
  }, [])

  useEffect(() => {
    if (isSelecting == null) {
      if (onEndSelect != null) {
        onEndSelect()
      }
      if (onSelect != null) {
        if (selectFromId > -1) {
          const selectedFromChar = charsPositions.current.getById(selectFromId)
          if (selectedFromChar == null) {
            return
          }

          const startX = selectedFromChar.pos.left
          const startY = selectedFromChar.pos.top
          const firstLineWidth = charsPositions.current.getFirstLineWidth(
            selectFromId,
            selectToId
          )

          const result = onSelect(
            selectFromId,
            selectToId,
            startY,
            startX + firstLineWidth / 2,
            cancelSelect
          )
          if (result === false) {
            setStartSelectedId(-1)
            setEndSelectedId(-1)
            setIsSelectingR(void 0)
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

  useLayoutEffect(() => {
    charsPositions.current.init(textLength)
  }, [textLength])

  const currentChar = useMemo(
    () => charsPositions.current.getById(endSelectId),
    [endSelectId, lines]
  )

  const findByTouch = useCallback(
    (x: number, y: number) => {
      return charsPositions.current.findByPosition(x, y)
    },
    [charsPositions.current]
  )

  const startSelect = (x: number, y: number) => {
    if (!selectEnabled) {
      return
    }

    const char = findByTouch(x, y)

    if (char !== null) {
      setIsSelectingR('default')
    }

    setStartSelectedId(char?.char.id ?? -1)
    setEndSelectedIdR(char?.char.id ?? -1)
  }

  const continueSelect = (x: number, y: number) => {
    if (startSelectId > -1 && selectEnabled) {
      const char = findByTouch(x, y)

      const currChar = charsPositions.current.getById(endSelectIdRef.current)
      if (char == null && currChar != null) {
        const curr = currChar.pos
        const nextChar = findByTouch(x, curr.top + curr.bottom - curr.top)
        setEndSelectedIdR(nextChar?.char.id ?? endSelectIdRef.current)
        return
      }

      setEndSelectedIdR(char?.char.id ?? endSelectIdRef.current)
    }
  }

  const setIsSelecting = (isSelecting?: string) => {
    if (selectEnabled) {
      setIsSelectingR(isSelecting)
    }
  }

  useEffect(() => {
    if (!selectEnabled) {
      cancelSelect()
    }
  }, [selectEnabled])

  return {
    isReady,
    setIsReady,
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
