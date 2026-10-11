import type * as React from 'react';
import type {ColorValue, StyleProp, ViewProps, ViewStyle} from 'react-native';

/** UTF-16 offsets into the unchanged source string; end is inclusive. */
export interface CustomSelection {
  start: number;
  end: number;
  color?: string;
  hint?: string;
}

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

/** Coordinates relative to the SelectChars viewport, in logical pixels. */
export interface MenuAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectionMenuContext extends TextSelection {
  anchor: MenuAnchor;
  cancelSelect: () => void;
}

export interface SelectCharsRef {
  clearSelection: () => void;
  /** Inclusive UTF-16 range. Native engines snap outwards to whole graphemes. */
  setSelection: (start: number, end: number) => void;
  scrollToOffset: (offset: number, animated?: boolean) => void;
}

export interface SelectCharsProps extends Omit<ViewProps, 'children'> {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  textColor?: ColorValue;
  selectionColor?: ColorValue;
  allowFontScaling?: boolean;
  selectEnabled?: boolean;
  selections?: readonly CustomSelection[];
  onStartSelect?: () => void;
  onEndSelect?: () => void;
  /** Fires when a range is committed, or an existing selection is cleared. */
  onSelectionChange?: (selection: TextSelection | null) => void;
  /** Render arbitrary React Native content; no native menu/button schema. */
  renderMenu?: (context: SelectionMenuContext) => React.ReactNode;
  menuStyle?: StyleProp<ViewStyle>;
  /**
   * v1-compatible callback. Returning false clears selection; returning React
   * content supplies the menu when renderMenu is not provided. End is inclusive.
   */
  onSelect?: (
    start: number,
    end: number,
    topY: number,
    centerX: number,
    cancelSelect: () => void,
  ) => void | false | React.ReactNode;
}
