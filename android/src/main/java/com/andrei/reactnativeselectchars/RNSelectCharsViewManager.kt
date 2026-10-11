package com.andrei.reactnativeselectchars

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.viewmanagers.RNSelectCharsViewManagerDelegate
import com.facebook.react.viewmanagers.RNSelectCharsViewManagerInterface

class RNSelectCharsViewManager : SimpleViewManager<RNSelectCharsView>(), RNSelectCharsViewManagerInterface<RNSelectCharsView> {
  private val delegate = RNSelectCharsViewManagerDelegate<RNSelectCharsView, RNSelectCharsViewManager>(this)
  override fun getDelegate(): ViewManagerDelegate<RNSelectCharsView> = delegate
  override fun getName() = "RNSelectCharsView"
  override fun createViewInstance(context: ThemedReactContext) = RNSelectCharsView(context)
  override fun setText(view: RNSelectCharsView, value: String?) = view.stageText(value.orEmpty())
  override fun setDocumentVersion(view: RNSelectCharsView, value: Int) = view.stageDocumentVersion(value)
  override fun setFontSize(view: RNSelectCharsView, value: Float) = view.setFontSize(value)
  override fun setLineHeight(view: RNSelectCharsView, value: Float) = view.setLineHeight(value)
  override fun setFontFamily(view: RNSelectCharsView, value: String?) = view.setFontFamily(value)
  override fun setTextColor(view: RNSelectCharsView, value: Int?) = view.setTextColor(value)
  override fun setSelectionColor(view: RNSelectCharsView, value: Int?) = view.setSelectionColor(value)
  override fun setSelectEnabled(view: RNSelectCharsView, value: Boolean) = view.setSelectEnabled(value)
  override fun setAllowFontScaling(view: RNSelectCharsView, value: Boolean) = view.setAllowFontScaling(value)

  override fun setHighlights(view: RNSelectCharsView, value: ReadableArray?) {
    val highlights = ArrayList<TextHighlight>(value?.size() ?: 0)
    if (value != null) for (index in 0 until value.size()) {
      val mark = value.getMap(index) ?: continue
      if (!mark.hasKey("start") || !mark.hasKey("end") || !mark.hasKey("color")) continue
      highlights.add(TextHighlight(mark.getInt("start"), mark.getInt("end"), mark.getInt("color"), if (mark.hasKey("hint")) mark.getString("hint").orEmpty() else ""))
    }
    view.setHighlights(highlights)
  }

  override fun onAfterUpdateTransaction(view: RNSelectCharsView) {
    super.onAfterUpdateTransaction(view)
    view.commitDocumentProps()
  }

  override fun clearSelection(view: RNSelectCharsView) = view.clearSelection()
  override fun setSelection(view: RNSelectCharsView, start: Int, end: Int) = view.setSelection(start, end)
  override fun scrollToOffset(view: RNSelectCharsView, offset: Int, animated: Boolean) = view.scrollToOffset(offset, animated)
  override fun receiveCommand(view: RNSelectCharsView, commandId: String, args: ReadableArray?) {
    if (commandId == "clearSelection") view.clearSelection() else if (args != null) delegate.receiveCommand(view, commandId, args)
  }

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> = mutableMapOf(
    "topNativeSelectionChange" to mapOf("registrationName" to "onNativeSelectionChange")
  )

  override fun onDropViewInstance(view: RNSelectCharsView) {
    view.dispose()
    super.onDropViewInstance(view)
  }
}
