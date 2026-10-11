# Native iOS unit tests

Run on macOS with Xcode, an installed iOS Simulator runtime, and the Ruby
`xcodeproj` gem (included with CocoaPods):

```sh
bash ios/tests/run-tests.sh
```

The runner creates a UIKit-only host and XCTest project in the system temporary
directory. It creates and deletes its own simulator; existing simulators and the
React Native example are untouched. Logs and the `.xcresult` bundle remain in the
printed temporary output directory. A first simulator boot may take several minutes.

To choose an installed runtime and compatible device type, set
`SELECT_CHARS_TEST_RUNTIME` and `SELECT_CHARS_TEST_DEVICE_TYPE` to their `simctl`
identifiers. The default is the newest installed iOS runtime and first available
iPhone device type.

The Foundation-only UTF-16 and grapheme regression tests need no simulator:

```sh
bash ios/tests/run-tests.sh --foundation-only
```

UIKit tests cover a 1.16-million-UTF-16-unit document, continuous native ranges,
TextKit 2 retention, visible menu anchors, hiding offscreen anchors, native gesture
controller autoscroll, highlights, hints without text mutation, clearing on document
replacement/disable, and suppression of system edit actions. Synthetic gesture
tests exercise the controller directly; actual UIKit recognizer arbitration,
selection-handle interaction and physical-device performance need integration testing.
