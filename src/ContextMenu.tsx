import React, { useState } from 'react'
import { View } from 'react-native'
import { SelectCharsController } from './SelectCharsController'
import { ContextMenuStyles } from './styles'

export interface ContextMenuProps {
  controller: SelectCharsController
  layoutHeight: number
  layoutWidth: number
}

export function ContextMenu(props: ContextMenuProps) {
  const [width, setWidth] = useState(0)

  const controller = props.controller

  const firstSelected = controller.charsPositions.current.getById(
    controller.selectFromId
  )
  if (props.controller.contextMenu == null || firstSelected == null) {
    return null
  }

  const selectionWidth = controller.charsPositions.current.getFirstLineWidth(
    controller.selectFromId,
    controller.selectToId
  )

  const left = Math.max(
    0,
    Math.min(
      firstSelected.pos.left + selectionWidth / 2 - width / 2,
      props.layoutWidth - width - 4
    )
  )

  return (
    <View
      style={[
        ContextMenuStyles.wrapper,
        {
          bottom: props.layoutHeight - firstSelected.pos.top + 8,
          left: left,
        },
      ]}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width)
      }}
    >
      {props.controller.contextMenu}
    </View>
  )
}
