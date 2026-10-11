#!/bin/bash
set -euo pipefail

repository=$(cd "$(dirname "$0")/../.." && pwd)
output=$(mktemp -d "${TMPDIR:-/tmp}/select-chars-ios-tests.XXXXXX")
echo "Native test artifacts: $output"
device=''
cleanup() {
  if [ -n "$device" ]; then
    xcrun simctl shutdown "$device" >/dev/null 2>&1 || true
    xcrun simctl delete "$device" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

xcrun clang -fobjc-arc -framework Foundation \
  "$repository/ios/RNSelectCharsRanges.m" \
  "$repository/ios/tests/RNSelectCharsRangesTests.m" \
  -o "$output/ranges-tests"
"$output/ranges-tests"
if [ "${1:-}" = '--foundation-only' ]; then exit 0; fi

# xcodeproj is also a CocoaPods dependency. No app or React Native installation
# is needed: only the UIKit engine and its focused XCTest bundle are compiled.
ruby "$repository/ios/tests/create-test-project.rb" "$output"
runtime=${SELECT_CHARS_TEST_RUNTIME:-$(xcrun simctl list runtimes --json | ruby -rjson -e '
  runtimes = JSON.parse(STDIN.read).fetch("runtimes").select { |r| r["isAvailable"] && r["identifier"].include?(".iOS-") }
  abort "Install an iOS Simulator runtime in Xcode first" if runtimes.empty?
  puts runtimes.max_by { |r| r.fetch("version").split(".").map(&:to_i) }.fetch("identifier")
')}
device_type=${SELECT_CHARS_TEST_DEVICE_TYPE:-$(xcrun simctl list devicetypes --json | ruby -rjson -e '
  device = JSON.parse(STDIN.read).fetch("devicetypes").find { |d| d["productFamily"] == "iPhone" }
  abort "No iPhone Simulator device type installed" unless device
  puts device.fetch("identifier")
')}
device=$(xcrun simctl create "SelectCharsUnit-$$" "$device_type" "$runtime")
echo "Testing UIKit engine in disposable simulator $device ($runtime)"
if xcodebuild test -project "$output/Engine.xcodeproj" -scheme EngineTests \
  -destination "platform=iOS Simulator,id=$device" \
  -derivedDataPath "$output/DerivedData" -resultBundlePath "$output/Results.xcresult" \
  CODE_SIGNING_ALLOWED=NO >"$output/test.log" 2>&1; then
  awk '/Test Suite|Test Case|Executed|TEST SUCCEEDED|TEST FAILED/' "$output/test.log"
else
  tail -80 "$output/test.log"
  exit 1
fi
