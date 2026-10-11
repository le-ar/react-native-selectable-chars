import * as React from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import type {HostComponent, NativeSyntheticEvent} from 'react-native';
import type {
  MenuAnchor,
  SelectCharsProps,
  SelectCharsRef,
  TextSelection,
} from './models';
import {SelectionMenu} from './SelectionMenu';
import {
  EMPTY_ANCHOR,
  equalAnchor,
  toNativeRange,
  validHighlights,
} from './selection';
import NativeSelectCharsView, {
  Commands,
} from './specs/NativeSelectCharsViewNativeComponent';
import type {
  NativeHighlight,
  NativeProps,
  NativeSelectionEvent,
} from './specs/NativeSelectCharsViewNativeComponent';

export type {
  CustomSelection,
  MenuAnchor,
  SelectCharsProps,
  SelectCharsRef,
  SelectionMenuContext,
  TextSelection,
} from './models';

const NO_HIGHLIGHTS: readonly never[] = [];
const DEFAULT_HIGHLIGHT_COLOR = -6774;

/** A bounded native reading viewport. The source string is never split into
 * React elements, and selection geometry never crosses the JS boundary. */
export const SelectChars = forwardRef<SelectCharsRef, SelectCharsProps>(
  function SelectCharsComponent(
    {
      text,
      fontSize = 16,
      fontFamily = '',
      lineHeight = 0,
      textColor = '#222222',
      selectionColor = '#B3D4FF',
      allowFontScaling = true,
      selectEnabled = true,
      selections = NO_HIGHLIGHTS,
      onStartSelect,
      onEndSelect,
      onSelectionChange,
      onSelect,
      renderMenu,
      menuStyle,
      style,
      onLayout,
      ...viewProps
    },
    forwardedRef,
  ) {
    const nativeRef =
      useRef<React.ComponentRef<HostComponent<NativeProps>>>(null);
    const document = useRef({text, version: 0});
    if (document.current.text !== text) {
      document.current = {
        text,
        version: (document.current.version + 1) % 0x7fffffff,
      };
    }
    const version = document.current.version;
    const callbacks = useRef({
      onStartSelect,
      onEndSelect,
      onSelectionChange,
      onSelect,
      selectEnabled,
    });
    callbacks.current = {
      onStartSelect,
      onEndSelect,
      onSelectionChange,
      onSelect,
      selectEnabled,
    };
    const mounted = useRef(true);
    const dragActive = useRef(false);
    const clearEpoch = useRef(0);
    const committed = useRef<{
      selection: TextSelection;
      version: number;
    } | null>(null);
    const [selection, setSelectionState] = useState<TextSelection | null>(null);
    const [anchor, setAnchor] = useState<MenuAnchor>(EMPTY_ANCHOR);
    const [legacyMenu, setLegacyMenu] = useState<React.ReactNode>(null);
    const [dragging, setDragging] = useState(false);
    const [viewport, setViewport] = useState({width: 0, height: 0});

    const finishDrag = useCallback(() => {
      if (dragActive.current) {
        dragActive.current = false;
        setDragging(false);
        callbacks.current.onEndSelect?.();
      }
    }, []);

    const clearLocalSelection = useCallback(() => {
      clearEpoch.current += 1;
      finishDrag();
      const hadSelection = committed.current !== null;
      committed.current = null;
      setSelectionState(null);
      setAnchor(EMPTY_ANCHOR);
      setLegacyMenu(null);
      if (hadSelection) {
        callbacks.current.onSelectionChange?.(null);
      }
    }, [finishDrag]);

    const cancelSelect = useCallback(() => {
      if (nativeRef.current) {
        Commands.clearSelection(nativeRef.current);
      }
      clearLocalSelection();
    }, [clearLocalSelection]);

    useImperativeHandle(
      forwardedRef,
      () => ({
        clearSelection: cancelSelect,
        setSelection: (start, end) => {
          const range = toNativeRange(document.current.text.length, start, end);
          if (!range) {
            throw new RangeError(
              'Selection must be a non-empty inclusive UTF-16 range within text.',
            );
          }
          if (nativeRef.current && callbacks.current.selectEnabled) {
            Commands.setSelection(nativeRef.current, range.start, range.end);
          }
        },
        scrollToOffset: (offset, animated = true) => {
          if (
            !Number.isInteger(offset) ||
            offset < 0 ||
            offset > document.current.text.length
          ) {
            throw new RangeError(
              'Scroll offset must be an integer UTF-16 position within text.',
            );
          }
          if (nativeRef.current) {
            Commands.scrollToOffset(nativeRef.current, offset, animated);
          }
        },
      }),
      [cancelSelect],
    );

    const previousVersion = useRef(version);
    useLayoutEffect(() => {
      if (previousVersion.current !== version || !selectEnabled) {
        cancelSelect();
      }
      previousVersion.current = version;
    }, [version, selectEnabled, cancelSelect]);

    useEffect(() => {
      mounted.current = true;
      return () => {
        mounted.current = false;
        if (dragActive.current) {
          dragActive.current = false;
          callbacks.current.onEndSelect?.();
        }
      };
    }, []);

    const highlights = useMemo<NativeHighlight[]>(
      () =>
        validHighlights(text.length, selections).map((highlight) => {
          const color = processColor(highlight.color ?? '#FFE58A');
          return {
            start: highlight.start,
            end: highlight.end + 1,
            color:
              typeof color === 'number'
                ? color > 0x7fffffff
                  ? color - 0x100000000
                  : color
                : DEFAULT_HIGHLIGHT_COLOR,
            hint: highlight.hint ?? '',
          };
        }),
      [text.length, selections],
    );

    const onNativeSelectionChange = useCallback(
      ({nativeEvent: event}: NativeSyntheticEvent<NativeSelectionEvent>) => {
        if (
          !mounted.current ||
          event.documentVersion !== document.current.version
        ) {
          return;
        }
        if (event.phase === 'clear') {
          clearLocalSelection();
          return;
        }
        if (!callbacks.current.selectEnabled) {
          return;
        }
        const nextAnchor: MenuAnchor = {
          x: Number.isFinite(event.anchorX) ? event.anchorX : 0,
          y: Number.isFinite(event.anchorY) ? event.anchorY : 0,
          width: Number.isFinite(event.anchorWidth)
            ? Math.max(0, event.anchorWidth)
            : 0,
          height: Number.isFinite(event.anchorHeight)
            ? Math.max(0, event.anchorHeight)
            : 0,
        };
        if (event.phase === 'position') {
          if (
            committed.current?.selection.start === event.start &&
            committed.current.selection.end + 1 === event.end
          ) {
            setAnchor((current) =>
              equalAnchor(current, nextAnchor) ? current : nextAnchor,
            );
          }
          return;
        }
        if (event.phase === 'start' || event.phase === 'change') {
          if (!dragActive.current) {
            dragActive.current = true;
            setDragging(true);
            callbacks.current.onStartSelect?.();
          }
          return;
        }
        if (event.phase !== 'end') {
          return;
        }
        finishDrag();
        const source = document.current.text;
        if (!toNativeRange(source.length, event.start, event.end - 1)) {
          clearLocalSelection();
          return;
        }
        const previous = committed.current;
        const next: TextSelection = {
          start: event.start,
          end: event.end - 1,
          text: source.slice(event.start, event.end),
        };
        committed.current = {
          selection: next,
          version: document.current.version,
        };
        setSelectionState(next);
        setAnchor(nextAnchor);
        const epoch = clearEpoch.current;
        const result = callbacks.current.onSelect?.(
          next.start,
          next.end,
          nextAnchor.y,
          nextAnchor.x + nextAnchor.width / 2,
          cancelSelect,
        );
        if (epoch !== clearEpoch.current) {
          return;
        }
        if (result === false) {
          cancelSelect();
          return;
        }
        setLegacyMenu(result ?? null);
        if (
          previous?.selection.start !== next.start ||
          previous.selection.end !== next.end ||
          previous.version !== document.current.version
        ) {
          callbacks.current.onSelectionChange?.(next);
        }
      },
      [cancelSelect, clearLocalSelection, finishDrag],
    );

    const currentSelection =
      committed.current?.version === version ? selection : null;
    const menu =
      currentSelection && !dragging && selectEnabled
        ? renderMenu
          ? renderMenu({...currentSelection, anchor, cancelSelect})
          : legacyMenu
        : null;

    return (
      <View
        {...viewProps}
        style={[styles.viewport, style]}
        onLayout={(event) => {
          const {width, height} = event.nativeEvent.layout;
          setViewport((current) =>
            current.width === width && current.height === height
              ? current
              : {width, height},
          );
          onLayout?.(event);
        }}
      >
        <NativeSelectCharsView
          ref={nativeRef}
          style={StyleSheet.absoluteFill}
          text={text}
          documentVersion={version}
          fontSize={Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16}
          fontFamily={fontFamily}
          lineHeight={
            Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 0
          }
          textColor={textColor}
          selectionColor={selectionColor}
          allowFontScaling={allowFontScaling}
          selectEnabled={selectEnabled}
          highlights={highlights}
          onNativeSelectionChange={onNativeSelectionChange}
        />
        {menu != null &&
          menu !== false &&
          anchor.width > 0 &&
          anchor.height > 0 && (
            <SelectionMenu
              anchor={anchor}
              viewport={viewport}
              style={menuStyle}
            >
              {menu}
            </SelectionMenu>
          )}
      </View>
    );
  },
);

const styles = StyleSheet.create({viewport: {height: 320, minHeight: 0}});

export default SelectChars;
