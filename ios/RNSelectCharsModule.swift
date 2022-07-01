//
//  RNSelectCharsModule.swift
//  RNSelectCharsModule
//
//  Copyright © 2022 Andrei. All rights reserved.
//

import Foundation

@objc(RNSelectCharsModule)
class RNSelectCharsModule: NSObject {
  @objc
  func constantsToExport() -> [AnyHashable : Any]! {
    return ["count": 1]
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
