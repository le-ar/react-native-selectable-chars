import * as React from 'react'
import { useState } from 'react'
import {
  ActivityIndicator,
  GestureResponderEvent,
  NativeModules,
  Pressable,
  View,
} from 'react-native'
import { ContextMenu } from './ContextMenu'
import { CustomSelection } from './models'
import { useSelectCharsController } from './SelectCharsController'
import { SelectCharsHelpers } from './SelectCharsHelper'
import { SelectCharsPreview } from './SelectCharsPreview'
import { SelectionsHints } from './SelectionsHints'
import { SelectCharsStyle } from './styles'
import { TextMeasure } from './TextMeasure'
import { TextViewMemo } from './TextView'

export interface SelectCharsProps {
  fontSize?: number
  selectEnabled?: boolean
  text: string
  onStartSelect?: () => void
  onEndSelect?: () => void
  selections?: CustomSelection[]
  onSelect?: (
    start: number,
    end: number,
    topY: number,
    centerX: number,
    cancelSelect: () => void
  ) => void | false | JSX.Element
}

export const SelectChars = (props: SelectCharsProps) => {
  const [layoutWidth, setLayoutWidth] = useState(0)
  const [layoutHeight, setLayoutHeight] = useState(0)

  const paddintTop = 40
  const paddingLeft = 8

  const controller = useSelectCharsController(
    props.selectEnabled ?? true,
    props.text.length,
    paddintTop,
    paddingLeft,
    props.onStartSelect,
    props.onEndSelect,
    props.onSelect
  )

  const onLongPress = (e: GestureResponderEvent) => {
    controller.startSelect(e.nativeEvent.locationX, e.nativeEvent.locationY)
  }

  const onTouchMove = (e: GestureResponderEvent) => {
    if (controller.isSelecting == null) {
      return
    }
    controller.continueSelect(e.nativeEvent.locationX, e.nativeEvent.locationY)
  }

  return (
    <View
      style={{
        paddingTop: paddintTop,
        paddingHorizontal: paddingLeft,
      }}
    >
      <View
        style={{ opacity: controller.isReady ? 1 : 0 }}
        onLayout={(e) => {
          setLayoutWidth(e.nativeEvent.layout.width)
          setLayoutHeight(e.nativeEvent.layout.height)
        }}
      >
        <TextMeasure
          fontSize={props.fontSize}
          text={props.text}
          setLines={controller.setLines}
        />
        <Pressable
          delayLongPress={300}
          style={SelectCharsStyle.pressable}
          onLongPress={onLongPress}
          onTouchMove={onTouchMove}
          onPressOut={() => {
            controller.setIsSelecting()
          }}
          onPress={() => {
            if (controller.isSelecting == null) {
              controller.setStartSelectedId(-1)
              controller.setEndSelectedId(-1)
            }
          }}
        >
          <TextViewMemo
            fontSize={props.fontSize}
            controller={controller}
            lines={controller.lines}
            selectFromId={controller.selectFromId}
            selectToId={controller.selectToId}
            selections={props.selections}
          />
          <SelectionsHints
            controller={controller}
            selections={props.selections}
          />
          <SelectCharsPreview
            controller={controller}
            selections={props.selections}
            maxRight={layoutWidth}
          />
          <View style={SelectCharsStyle.overlay} />
        </Pressable>
      </View>
      <SelectCharsHelpers controller={controller} />
      <ContextMenu
        controller={controller}
        layoutHeight={layoutHeight}
        layoutWidth={layoutWidth}
      />
      {controller.isReady || (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size='large' />
        </View>
      )}
    </View>
  )
}

export default NativeModules.RNSelectCharsModule
