import React, { useRef } from 'react'
import { GestureResponderEvent, Pressable, View } from 'react-native'
import { CharPos } from './models'
import { SelectCharsController } from './SelectCharsController'
import { SelectCharsHelpersStyle } from './styles'

export interface SelectCharsHelpersProps {
  controller: SelectCharsController
}

export function SelectCharsHelpers(props: SelectCharsHelpersProps) {
  if (
    (props.controller.isSelecting != null &&
      props.controller.isSelecting !== 'helper') ||
    props.controller.selectFromId == null ||
    props.controller.selectToId == null
  ) {
    return null
  }

  const firstSelected = props.controller.charsPositions.current.getById(
    props.controller.selectFromId
  )
  const lastSelected = props.controller.charsPositions.current.getById(
    props.controller.selectToId
  )

  const startSelectedChar =
    props.controller.selectFromId > -1 ? firstSelected : void 0
  const endSelectedChar =
    props.controller.selectToId > -1 ? lastSelected : void 0

  if (startSelectedChar == null) {
    return null
  }

  return (
    <React.Fragment>
      <SelectCharsHelper
        selectedChar={startSelectedChar}
        isStart
        controller={props.controller}
      />
      <SelectCharsHelper
        selectedChar={endSelectedChar}
        isStart={false}
        controller={props.controller}
      />
    </React.Fragment>
  )
}

export interface SelectCharsHelperProps {
  selectedChar?: CharPos
  isStart: boolean
  controller: SelectCharsController
}

export function SelectCharsHelper(props: SelectCharsHelperProps) {
  if (props.selectedChar == null) {
    return null
  }

  const controller = props.controller
  const locationPosStart = useRef<{ x: number; y: number }>()
  const pagePosStart = useRef<{ x: number; y: number }>()

  const top = props.selectedChar.pos.top + controller.paddingTop
  const height = props.selectedChar.pos.bottom - props.selectedChar.pos.top
  const left = props.isStart
    ? props.selectedChar.pos.left + controller.paddingLeft
    : props.selectedChar.pos.right + controller.paddingLeft

  const verticalCenter =
    props.selectedChar.pos.top +
    props.selectedChar.pos.bottom -
    props.selectedChar.pos.top
  const horizontalCenter =
    props.selectedChar.pos.left +
    props.selectedChar.pos.right -
    props.selectedChar.pos.left

  const locationPosFromPage = (
    x: number,
    y: number
  ): { x: number; y: number } => {
    if (locationPosStart.current == null || pagePosStart.current == null) {
      return { x: 0, y: 0 }
    }
    const deltaX = x - pagePosStart.current.x
    const deltaY = y - pagePosStart.current.y

    return {
      x: locationPosStart.current.x + deltaX,
      y: locationPosStart.current.y + deltaY,
    }
  }

  const onPressIn = (e: GestureResponderEvent) => {
    locationPosStart.current = { x: horizontalCenter, y: verticalCenter }
    pagePosStart.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    }
    controller.setIsSelecting('helper')

    if (props.isStart) {
      controller.setStartSelectedId(controller.selectToId)
    } else {
      controller.setStartSelectedId(controller.selectFromId)
    }
    controller.setEndSelectedId(props.selectedChar!.char.id)
  }

  const onTouchMove = (e: GestureResponderEvent) => {
    const pos = locationPosFromPage(e.nativeEvent.pageX, e.nativeEvent.pageY)
    controller.continueSelect(pos.x, pos.y)
  }

  const chEnd = (e: GestureResponderEvent) => {
    controller.setIsSelecting()
  }

  return (
    <Pressable
      hitSlop={8}
      onPressIn={onPressIn}
      onTouchMove={onTouchMove}
      onTouchEnd={chEnd}
      style={[
        SelectCharsHelpersStyle.wrapper,
        {
          top,
          left: left - 8,
          height: height + 16,
        },
      ]}
    >
      <View
        style={[
          SelectCharsHelpersStyle.line,
          {
            height,
          },
        ]}
      />
      <CenterHelper isLeft={!props.isStart} />
    </Pressable>
  )
}

const CenterHelper = (props: { isLeft: boolean }) => (
  <View
    style={[
      SelectCharsHelpersStyle.oval,
      {
        left: props.isLeft ? void 0 : -5,
        right: props.isLeft ? -1 : void 0,
      },
    ]}
  >
    <View
      style={
        props.isLeft
          ? SelectCharsHelpersStyle.ovalLeft
          : SelectCharsHelpersStyle.ovalRight
      }
    />
  </View>
)
