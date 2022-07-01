import React from 'react'
import { Text, View } from 'react-native'
import { CustomSelection } from './models'
import { SelectCharsController } from './SelectCharsController'

interface SelectionsHintsProps {
  controller: SelectCharsController
  selections?: CustomSelection[]
}

export function SelectionsHints(props: SelectionsHintsProps) {
  const filtered =
    props.selections?.filter((selection) => selection.hint != null) ?? []

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1,
      }}
    >
      {filtered.map((selection) => {
        // const middleChar = Math.((selection.start+ selection.end)/2)
        const chars = props.controller.charsPositions.current
          .filter(
            (charPos) =>
              selection.start <= charPos.char.id &&
              charPos.char.id <= selection.end
          )
          .sort((a, b) => a.pos.left - b.pos.left)

        if (chars.length < 1) {
          return null
        }

        const top = chars[0].pos.top
        const left = chars[0].pos.left
        const firstLine = chars.filter((char) => char.pos.top === top)
        const right = firstLine[firstLine.length - 1].pos.right
        const center = left + (right - left) / 2
        const hintHalfWidth = selection.hint!.length * 1.7

        return (
          <SelectionHint
            key={selection.start}
            selection={selection}
            top={top}
            left={center - hintHalfWidth}
          />
        )
      })}
    </View>
  )
}

interface SelectionHintProps {
  selection: CustomSelection
  top: number
  left: number
}

export function SelectionHint(props: SelectionHintProps) {
  return (
    <Text
      style={{
        position: 'absolute',
        top: props.top - 8,
        left: props.left,
        fontWeight: 'bold',
        fontSize: 10,
      }}
    >
      {props.selection.hint}
    </Text>
  )
}
