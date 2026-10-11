import * as React from 'react';
import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {StyleProp, ViewStyle} from 'react-native';
import type {MenuAnchor} from './models';
import {menuPosition} from './selection';

interface Props {
  anchor: MenuAnchor;
  viewport: {width: number; height: number};
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** A sibling overlay keeps React controls interactive without a Modal stealing
 * native text focus, selection handles, or the active touch stream. */
export function SelectionMenu({anchor, viewport, style, children}: Props) {
  const [size, setSize] = useState({width: 0, height: 0});
  const position = menuPosition(anchor, viewport, size);
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View
        testID="select-chars-menu"
        accessibilityViewIsModal
        style={[
          styles.menu,
          style,
          position,
          size.width > 0 && size.height > 0 ? styles.visible : styles.hidden,
        ]}
        onLayout={({nativeEvent: {layout}}) => {
          setSize((current) =>
            current.width === layout.width && current.height === layout.height
              ? current
              : {width: layout.width, height: layout.height},
          );
        }}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {position: 'absolute', zIndex: 1, elevation: 8},
  visible: {opacity: 1},
  hidden: {opacity: 0},
});
