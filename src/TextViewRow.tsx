import React, { useCallback } from 'react'
import { LayoutChangeEvent, Text, View } from 'react-native'
import {
  Char,
  CharPos,
  CustomSelection,
  isSameSelectCharsLine,
  SelectCharsLine,
} from './models'
import { SelectCharsController } from './SelectCharsController'

export const TextViewRowMemo = React.memo(
  TextViewRow,
  (prevProps, nextProps) => {
    const prevSelectedCount = countSelectedChars(
      prevProps.line.text,
      prevProps.selectFromId,
      prevProps.selectToId
    )
    const nextSelectedCount = countSelectedChars(
      nextProps.line.text,
      nextProps.selectFromId,
      nextProps.selectToId
    )

    const prevCustomSelections = prevProps.selections.reduce(
      (sum, selection) =>
        sum +
        countSelectedChars(prevProps.line.text, selection.start, selection.end),
      0
    )
    const nextCustomSelections = nextProps.selections.reduce(
      (sum, selection) =>
        sum +
        countSelectedChars(nextProps.line.text, selection.start, selection.end),
      0
    )

    const isSame: boolean =
      prevProps.lineId === nextProps.lineId &&
      prevCustomSelections === nextCustomSelections &&
      prevSelectedCount === nextSelectedCount &&
      prevProps.charsPositions === nextProps.charsPositions &&
      isSameSelectCharsLine(prevProps.line, nextProps.line) &&
      prevProps.top === nextProps.top

    return isSame
  }
)

function countSelectedChars(
  chars: Char[],
  selectFromId: number,
  selectToId: number
): number {
  return chars.filter(
    (char) => selectFromId <= char.id && char.id <= selectToId
  ).length
}

export function TextViewRow(props: {
  lineId: number
  line: SelectCharsLine
  top: number
  selectFromId: number
  selectToId: number
  charsPositions: React.MutableRefObject<CharPos[]>
  selections: CustomSelection[]
  controller: SelectCharsController
}) {
  const top = props.top
  const line = props.line

  return (
    <View
      style={{
        height: line.height,
        position: 'absolute',
        overflow: 'hidden',
        top: top,
        left: 0,
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'flex-end',
        zIndex: 1,
      }}
    >
      {line.text.map((char) => (
        <TextViewCharLayout
          key={char.id}
          {...props}
          char={char}
          lineId={props.lineId}
        />
      ))}
    </View>
  )
}

export function TextViewCharLayout(props: {
  lineId: number
  char: Char
  top: number
  selectFromId: number
  selectToId: number
  charsPositions: React.MutableRefObject<CharPos[]>
  selections: CustomSelection[]
  controller: SelectCharsController
}) {
  const charsPositions = props.charsPositions

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const top = props.top
      const char = props.char

      const pos = {
        left: e.nativeEvent.layout.x,
        top: top + e.nativeEvent.layout.y,
        right: e.nativeEvent.layout.x + e.nativeEvent.layout.width,
        bottom: top + e.nativeEvent.layout.y + e.nativeEvent.layout.height,
      }

      charsPositions.current[char.id] = {
        char,
        line: props.lineId,
        pos,
      }

      if (props.selections.length > 0) {
        props.controller.setHintUpdateId((u) => u + 1)
      }
    },
    [charsPositions.current, props.top, props.char, props.selections.length]
  )

  return <TextViewCharMemo {...props} onLayout={onLayout} />
}

export const TextViewCharMemo = React.memo(TextViewChar)

export function TextViewChar(props: {
  char: Char
  selectFromId: number
  selectToId: number
  selections: CustomSelection[]
  onLayout?: (event: LayoutChangeEvent) => void
}) {
  const char = props.char
  const selectFromId = props.selectFromId
  const selectToId = props.selectToId

  const getBackgroundColor = () => {
    if (selectFromId <= char.id && char.id <= selectToId) {
      return '#0074ff40'
    }

    const selection = props.selections.find(
      (selection) => selection.start <= char.id && char.id <= selection.end
    )

    if (selection == null) {
      return void 0
    }

    return selection.color ?? '#ff000040'
  }

  return (
    <Text
      style={{
        backgroundColor: getBackgroundColor(),
      }}
      onLayout={props.onLayout}
    >
      {char.char}
    </Text>
  )
}
