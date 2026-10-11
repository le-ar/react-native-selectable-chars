import type * as React from 'react';
import type {ColorValue, HostComponent, ViewProps} from 'react-native';
import type {
  DirectEventHandler,
  Float,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';
import {codegenNativeCommands, codegenNativeComponent} from 'react-native';

export type NativeHighlight = Readonly<{
  start: Int32;
  end: Int32;
  color: Int32;
  hint: string;
}>;

export type NativeSelectionEvent = Readonly<{
  documentVersion: Int32;
  start: Int32;
  end: Int32;
  phase: string;
  anchorX: Float;
  anchorY: Float;
  anchorWidth: Float;
  anchorHeight: Float;
}>;

export interface NativeProps extends ViewProps {
  text: string;
  documentVersion?: WithDefault<Int32, 0>;
  fontSize?: WithDefault<Float, 16>;
  lineHeight?: WithDefault<Float, 0>;
  fontFamily?: WithDefault<string, ''>;
  textColor?: ColorValue;
  selectionColor?: ColorValue;
  selectEnabled?: WithDefault<boolean, true>;
  allowFontScaling?: WithDefault<boolean, true>;
  highlights?: ReadonlyArray<NativeHighlight>;
  onNativeSelectionChange?: DirectEventHandler<NativeSelectionEvent>;
}

type NativeComponentType = HostComponent<NativeProps>;

interface NativeCommands {
  clearSelection: (viewRef: React.ElementRef<NativeComponentType>) => void;
  setSelection: (
    viewRef: React.ElementRef<NativeComponentType>,
    start: Int32,
    end: Int32,
  ) => void;
  scrollToOffset: (
    viewRef: React.ElementRef<NativeComponentType>,
    offset: Int32,
    animated: boolean,
  ) => void;
}

export const Commands = codegenNativeCommands<NativeCommands>({
  supportedCommands: ['clearSelection', 'setSelection', 'scrollToOffset'],
});

export default codegenNativeComponent<NativeProps>(
  'RNSelectCharsView',
) as NativeComponentType;
