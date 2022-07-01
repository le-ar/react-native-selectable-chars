import React from 'react'
import { Text, View } from 'react-native'
import { CustomSelection } from './models'
import { SelectCharsController } from './SelectCharsController'
import { SelectionsHintsStyle } from './styles'

interface SelectionsHintsProps {
  controller: SelectCharsController
  selections?: CustomSelection[]
}

export function SelectionsHints(props: SelectionsHintsProps) {
  const filtered =
    props.selections?.filter((selection) => selection.hint != null) ?? []

  return (
    <View style={SelectionsHintsStyle.wrapper}>
      {filtered.map((selection) => {
        const firstLine = props.controller.charsPositions.current.getFirstLine(
          selection.start,
          selection.end
        )
        if (firstLine.length < 1) {
          return null
        }

        const top = firstLine[0].pos.top
        const left = firstLine[0].pos.left
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
      style={[
        SelectionsHintsStyle.hint,
        {
          top: props.top - 8,
          left: props.left,
        },
      ]}
    >
      {props.selection.hint}
    </Text>
  )
}
