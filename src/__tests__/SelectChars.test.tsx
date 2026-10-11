import * as React from 'react';
import {act, create} from 'react-test-renderer';
import type {ReactTestRenderer} from 'react-test-renderer';
import {Text, TouchableOpacity, View} from 'react-native';
import SelectChars, {SelectChars as NamedSelectChars} from '../index';
import type {SelectCharsProps, SelectCharsRef} from '../index';
import {Commands} from '../specs/NativeSelectCharsViewNativeComponent';
import {menuPosition} from '../selection';

jest.mock('../specs/NativeSelectCharsViewNativeComponent', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ReactModule.forwardRef((props: object, ref: unknown) =>
      ReactModule.createElement('RNSelectCharsView', {...props, ref}),
    ),
    Commands: {
      clearSelection: jest.fn(),
      setSelection: jest.fn(),
      scrollToOffset: jest.fn(),
    },
  };
});

let tree: ReactTestRenderer;
let ref: React.RefObject<SelectCharsRef | null>;

function mount(props: Partial<SelectCharsProps> = {}) {
  ref = React.createRef<SelectCharsRef>();
  act(() => {
    tree = create(
      <SelectChars ref={ref} text="same 👩‍💻 same\nnext line" {...props} />,
      {
        createNodeMock: (element) =>
          element.type === 'RNSelectCharsView' ? {nativeTag: 1} : null,
      },
    );
  });
  act(() => {
    tree.root.findAllByType(View)[0].props.onLayout({
      nativeEvent: {layout: {width: 320, height: 240}},
    });
  });
}

function native() {
  return tree.root.findByType('RNSelectCharsView' as never);
}

function menus() {
  return tree.root
    .findAllByType(View)
    .filter((node) => node.props.testID === 'select-chars-menu');
}

function event(phase: string, extra: object = {}) {
  act(() => {
    native().props.onNativeSelectionChange({
      nativeEvent: {
        documentVersion: native().props.documentVersion,
        start: 0,
        end: 4,
        phase,
        anchorX: 20,
        anchorY: 100,
        anchorWidth: 40,
        anchorHeight: 20,
        ...extra,
      },
    });
  });
}

beforeEach(() => jest.clearAllMocks());
afterEach(() => {
  if (tree) {
    act(() => tree.unmount());
  }
});

test('exports the actual component as both named and default export', () => {
  expect(SelectChars).toBe(NamedSelectChars);
});

test('renders a million-unit document as one native surface without character elements', () => {
  const text = 'paragraph 👩‍💻\n'.repeat(100000);
  mount({text});
  expect(native().props.text).toBe(text);
  expect(tree.root.findAllByType('RNSelectCharsView' as never)).toHaveLength(1);
  expect(tree.root.findAllByType(Text)).toHaveLength(0);
});

test('renders arbitrary React controls and converts native exclusive end to public inclusive end', () => {
  const onSelectionChange = jest.fn();
  const press = jest.fn();
  mount({
    onSelectionChange,
    renderMenu: (context) => (
      <View>
        <Text>{context.text}</Text>
        <TouchableOpacity
          testID="custom-action"
          onPress={() => {
            press(context.start, context.end);
            context.cancelSelect();
          }}
        >
          <Text>Custom content</Text>
        </TouchableOpacity>
      </View>
    ),
  });
  event('end');
  expect(onSelectionChange).toHaveBeenCalledWith({
    start: 0,
    end: 3,
    text: 'same',
  });
  expect(tree.root.findByProps({testID: 'custom-action'})).toBeTruthy();
  act(() => tree.root.findByProps({testID: 'custom-action'}).props.onPress());
  expect(press).toHaveBeenCalledWith(0, 3);
  expect(Commands.clearSelection).toHaveBeenCalledTimes(1);
  expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  expect(tree.root.findAllByProps({testID: 'select-chars-menu'})).toHaveLength(
    0,
  );
});

test('identifies the second occurrence by offsets instead of searching selected text', () => {
  const onSelectionChange = jest.fn();
  mount({text: 'same same', onSelectionChange});
  event('end', {start: 5, end: 9});
  expect(onSelectionChange).toHaveBeenCalledWith({
    start: 5,
    end: 8,
    text: 'same',
  });
});

test('preserves UTF-16 ranges for an entire emoji grapheme', () => {
  const onSelectionChange = jest.fn();
  mount({text: 'A👩‍💻B', onSelectionChange});
  event('end', {start: 1, end: 6});
  expect(onSelectionChange).toHaveBeenCalledWith({
    start: 1,
    end: 5,
    text: '👩‍💻',
  });
});

test('retains the legacy JSX menu callback and inclusive indices', () => {
  const onSelect = jest.fn(() => <Text>Legacy menu</Text>);
  mount({onSelect});
  event('end');
  expect(onSelect).toHaveBeenCalledWith(0, 3, 100, 40, expect.any(Function));
  expect(
    tree.root
      .findAllByType(Text)
      .some((node) => node.props.children === 'Legacy menu'),
  ).toBe(true);
});

test('cancels a rejected legacy selection and respects synchronous callback cancellation', () => {
  mount({onSelect: () => false});
  event('end');
  expect(Commands.clearSelection).toHaveBeenCalledTimes(1);
  act(() =>
    tree.update(
      <SelectChars
        text="same"
        onSelect={(_s, _e, _y, _x, cancel) => {
          cancel();
          return <Text>Must not reappear</Text>;
        }}
      />,
    ),
  );
  event('end');
  expect(tree.root.findAllByProps({testID: 'select-chars-menu'})).toHaveLength(
    0,
  );
});

test('balances gesture lifecycle and hides the menu during dragging', () => {
  const onStartSelect = jest.fn();
  const onEndSelect = jest.fn();
  mount({onStartSelect, onEndSelect, renderMenu: () => <Text>Menu</Text>});
  event('start');
  event('change');
  expect(onStartSelect).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByProps({testID: 'select-chars-menu'})).toHaveLength(
    0,
  );
  event('end');
  expect(onEndSelect).toHaveBeenCalledTimes(1);
  expect(menus()).toHaveLength(1);
  event('start');
  act(() => ref.current?.clearSelection());
  expect(onEndSelect).toHaveBeenCalledTimes(2);
});

test('anchor-only scroll events do not recommit the selection or rerun legacy callbacks', () => {
  const onSelect = jest.fn(() => <Text>Menu</Text>);
  const onSelectionChange = jest.fn();
  mount({onSelect, onSelectionChange});
  event('end');
  event('position', {anchorWidth: 0, anchorHeight: 0});
  expect(tree.root.findAllByProps({testID: 'select-chars-menu'})).toHaveLength(
    0,
  );
  event('position', {anchorY: 40});
  expect(menus()).toHaveLength(1);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onSelectionChange).toHaveBeenCalledTimes(1);
});

test('drops stale native events and old menu after replacing a document of the same length', () => {
  const onSelectionChange = jest.fn();
  mount({text: 'same', onSelectionChange, renderMenu: () => <Text>Menu</Text>});
  const oldVersion = native().props.documentVersion;
  event('end');
  act(() =>
    tree.update(
      <SelectChars
        text="else"
        onSelectionChange={onSelectionChange}
        renderMenu={() => <Text>Menu</Text>}
      />,
    ),
  );
  expect(native().props.documentVersion).not.toBe(oldVersion);
  onSelectionChange.mockClear();
  event('end', {documentVersion: oldVersion});
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({testID: 'select-chars-menu'})).toHaveLength(
    0,
  );
});

test('disabling selection clears it and rejects later native gestures', () => {
  const onSelectionChange = jest.fn();
  mount({text: 'same', onSelectionChange});
  event('end');
  act(() =>
    tree.update(
      <SelectChars
        text="same"
        selectEnabled={false}
        onSelectionChange={onSelectionChange}
      />,
    ),
  );
  expect(onSelectionChange).toHaveBeenLastCalledWith(null);
  onSelectionChange.mockClear();
  event('end');
  expect(onSelectionChange).not.toHaveBeenCalled();
});

test('passes valid saved highlights as exclusive native ranges without altering source', () => {
  mount({
    text: 'abc',
    selections: [
      {start: 0, end: 0, color: '#ff0000', hint: '(1)'},
      {start: 2, end: 2},
      {start: -1, end: 0},
      {start: 2, end: 3},
      {start: 1.5, end: 2},
    ],
  });
  expect(native().props.text).toBe('abc');
  expect(native().props.highlights).toEqual([
    {start: 0, end: 1, color: -65536, hint: '(1)'},
    {start: 2, end: 3, color: -6774, hint: ''},
  ]);
});

test('imperative commands validate ranges and convert inclusive end exactly once', () => {
  mount({text: 'abc'});
  act(() => ref.current?.setSelection(0, 0));
  expect(Commands.setSelection).toHaveBeenCalledWith(expect.any(Object), 0, 1);
  expect(() => ref.current?.setSelection(0, 3)).toThrow(RangeError);
  expect(() => ref.current?.setSelection(1.5, 2)).toThrow(RangeError);
  expect(() => ref.current?.scrollToOffset(4)).toThrow(RangeError);
  act(() => ref.current?.scrollToOffset(3, false));
  expect(Commands.scrollToOffset).toHaveBeenCalledWith(
    expect.any(Object),
    3,
    false,
  );
});

test('keeps measured custom menus inside the viewport at selection edges', () => {
  for (const anchor of [
    {x: 0, y: 0, width: 2, height: 20},
    {x: 319, y: 239, width: 1, height: 1},
    {x: -100, y: -100, width: 20, height: 20},
  ]) {
    const result = menuPosition(
      anchor,
      {width: 320, height: 240},
      {width: 200, height: 80},
    );
    expect(result.left).toBeGreaterThanOrEqual(8);
    expect(result.left + 200).toBeLessThanOrEqual(312);
    expect(result.top).toBeGreaterThanOrEqual(8);
    expect(result.top + 80).toBeLessThanOrEqual(232);
  }
});
