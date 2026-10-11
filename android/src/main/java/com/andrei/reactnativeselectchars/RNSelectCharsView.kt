package com.andrei.reactnativeselectchars

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PointF
import android.graphics.RectF
import android.graphics.Typeface
import android.icu.text.BreakIterator
import android.os.Bundle
import android.os.Build
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.util.TypedValue
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.LinearSmoothScroller
import androidx.recyclerview.widget.RecyclerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** A single logical document with recycled, bounded native text layouts. */
class RNSelectCharsView(context: Context) : FrameLayout(context) {
  private val density = resources.displayMetrics.density
  private val recycler = RecyclerView(context)
  private val manager = LinearLayoutManager(context)
  private val adapter = ChunkAdapter()
  private val overlay = HandleOverlay(context)
  private val graphemes = BreakIterator.getCharacterInstance(Locale.ROOT)
  private var document = ""
  private var documentVersion = 0
  private var incomingText: String? = null
  private var incomingVersion: Int? = null
  private var chunks: List<TextChunk> = emptyList()
  private var marks = HighlightIndex()
  private var enabledSelection = true
  private var fontSize = 16f
  private var lineHeight = 0f
  private var fontFamily = ""
  private var allowScaling = true
  private var textColorValue = Color.BLACK
  private var selectedColor = 0x663399FF
  private var start = -1
  private var end = -1
  private var dragging = false
  private var activeStart = false
  private var gestureAnchor = -1
  private var touchX = 0f
  private var touchY = 0f
  private var attached = false
  private var positionScheduled = false
  private var readyForLayout = false
  private var layoutScheduled = false
  private var pendingScroll: Pair<Int, Boolean>? = null

  private val layoutCallback = Runnable {
    layoutScheduled = false
    if (width > 0 && height > 0 && attached) {
      measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
      layout(left, top, right, bottom)
      schedulePosition()
    }
  }

  private val positionCallback = Runnable {
    positionScheduled = false
    overlay.invalidate()
    if (start >= 0 && attached) emit("position")
  }

  private val autoScroll = object : Runnable {
    override fun run() {
      if (!dragging || !attached) return
      val margin = min(height / 3f, 56f * density)
      val direction = when {
        touchY < margin -> -((margin - touchY) / margin).coerceIn(0f, 1f)
        touchY > height - margin -> ((touchY - height + margin) / margin).coerceIn(0f, 1f)
        else -> 0f
      }
      if (direction != 0f) {
        recycler.scrollBy(0, (direction * 18f * density).toInt())
        updateDrag(touchX, touchY.coerceIn(1f, max(1f, height - 1f)))
      }
      postOnAnimation(this)
    }
  }

  private val detector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
    override fun onDown(event: MotionEvent): Boolean = true

    override fun onSingleTapUp(event: MotionEvent): Boolean {
      if (!enabledSelection || document.isEmpty()) return false
      val offset = hitTest(event.x, event.y, true) ?: return false
      selectCharacter(offset)
      emit("end")
      return true
    }

    override fun onLongPress(event: MotionEvent) {
      if (!enabledSelection || document.isEmpty()) return
      val offset = hitTest(event.x, event.y, true) ?: return
      selectCharacter(offset)
      gestureAnchor = start
      activeStart = false
      beginDrag(event)
    }
  })

  init {
    clipChildren = true
    recycler.layoutManager = manager
    recycler.adapter = adapter
    recycler.itemAnimator = null
    recycler.setItemViewCacheSize(2)
    recycler.recycledViewPool.setMaxRecycledViews(0, 4)
    recycler.isVerticalScrollBarEnabled = true
    recycler.addOnScrollListener(object : RecyclerView.OnScrollListener() {
      override fun onScrolled(view: RecyclerView, dx: Int, dy: Int) = schedulePosition()
    })
    addView(recycler, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    addView(overlay, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    graphemes.setText(document)
    readyForLayout = true
  }

  override fun requestLayout() {
    super.requestLayout()
    // React parents intentionally stop Android's requestLayout propagation. Our native children
    // still need a pass when recycled rows or font metrics change within the same Yoga bounds.
    if (readyForLayout && !layoutScheduled) {
      layoutScheduled = true
      post(layoutCallback)
    }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    resetLayouts()
  }

  fun setText(value: String) {
    if (document == value) return
    stopDrag()
    clearSelection()
    document = value
    graphemes.setText(document)
    chunks = TextChunks.build(document, ::floorBoundary)
    adapter.notifyDataSetChanged()
    manager.scrollToPositionWithOffset(0, 0)
    pendingScroll = null
    overlay.invalidate()
  }

  internal fun stageText(value: String) { incomingText = value }
  internal fun stageDocumentVersion(value: Int) { incomingVersion = value }
  internal fun commitDocumentProps() {
    incomingText?.let(::setText)
    incomingVersion?.let { documentVersion = it }
    incomingText = null
    incomingVersion = null
  }

  fun setFontSize(value: Float) { if (fontSize != value) { fontSize = value.coerceAtLeast(1f); resetLayouts() } }
  fun setLineHeight(value: Float) { if (lineHeight != value) { lineHeight = max(0f, value); resetLayouts() } }
  fun setFontFamily(value: String?) { if (fontFamily != value.orEmpty()) { fontFamily = value.orEmpty(); resetLayouts() } }
  fun setAllowFontScaling(value: Boolean) { if (allowScaling != value) { allowScaling = value; resetLayouts() } }
  fun setTextColor(value: Int?) { textColorValue = value ?: Color.BLACK; resetLayouts() }
  fun setSelectionColor(value: Int?) { selectedColor = value ?: 0x663399FF; invalidateVisible() }
  fun setSelectEnabled(value: Boolean) {
    enabledSelection = value
    if (!value) { stopDrag(); clearSelection() }
  }

  internal fun setHighlights(values: List<TextHighlight>) {
    marks = HighlightIndex(values.filter { it.start >= 0 && it.end > it.start })
    forEachVisible { it.refreshHighlights() }
  }

  fun clearSelection() {
    stopDrag()
    val hadSelection = start >= 0
    start = -1
    end = -1
    gestureAnchor = -1
    invalidateVisible()
    if (hadSelection) emit("clear")
  }

  fun setSelection(first: Int, last: Int) {
    stopDrag()
    val range = SelectionRanges.normalize(first, last, document.length, ::floorBoundary, ::ceilBoundary)
    if (!enabledSelection || range == null) {
      clearSelection()
      return
    }
    start = range.start
    end = range.end
    invalidateVisible()
    emit("end")
  }

  fun scrollToOffset(offset: Int, animated: Boolean) {
    if (chunks.isEmpty()) return
    val safeOffset = offset.coerceIn(0, document.length)
    if (width == 0 || height == 0) { pendingScroll = safeOffset to animated; return }
    val index = TextChunks.find(chunks, safeOffset)
    // One bounded temporary layout gives the exact line inside the destination chunk.
    val row = ChunkView(context)
    row.bind(index)
    row.ensureLayout(max(1, recycler.width))
    val y = row.lineTop(safeOffset)
    if (animated) {
      val scroller = object : LinearSmoothScroller(context) {
        override fun getVerticalSnapPreference() = SNAP_TO_START
        override fun calculateDyToMakeVisible(view: View, snapPreference: Int) = super.calculateDyToMakeVisible(view, snapPreference) - y
      }
      scroller.targetPosition = index
      manager.startSmoothScroll(scroller)
    } else {
      manager.scrollToPositionWithOffset(index, -y)
    }
    schedulePosition()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    if (w != oldw) resetLayouts()
    pendingScroll?.let { pendingScroll = null; scrollToOffset(it.first, it.second) }
    schedulePosition()
  }

  override fun onAttachedToWindow() { super.onAttachedToWindow(); attached = true; requestLayout(); schedulePosition() }
  override fun onDetachedFromWindow() {
    stopDrag()
    removeCallbacks(positionCallback)
    removeCallbacks(layoutCallback)
    layoutScheduled = false
    positionScheduled = false
    clearSelection()
    attached = false
    super.onDetachedFromWindow()
  }

  internal fun dispose() {
    stopDrag()
    clearSelection()
    removeCallbacks(positionCallback)
    removeCallbacks(layoutCallback)
    layoutScheduled = false
    pendingScroll = null
    recycler.stopScroll()
    recycler.adapter = null
  }

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    if (!enabledSelection) return super.dispatchTouchEvent(event)
    if (event.actionMasked == MotionEvent.ACTION_DOWN && start >= 0) {
      val first = endpoint(start, false)
      val last = endpoint(end, true)
      val radius = 28f * density
      fun near(point: PointF?) = point != null && abs(event.x - point.x) <= radius && abs(event.y - point.y - 7f * density) <= radius
      if (near(first) || near(last)) {
        activeStart = near(first) && (!near(last) || abs(event.x - first!!.x) < abs(event.x - last!!.x))
        gestureAnchor = -1
        beginDrag(event)
        return true
      }
    }
    if (dragging) {
      touchX = event.x
      touchY = event.y
      when (event.actionMasked) {
        MotionEvent.ACTION_MOVE -> updateDrag(event.x, event.y)
        MotionEvent.ACTION_UP -> { stopDrag(); emit("end") }
        MotionEvent.ACTION_CANCEL -> { stopDrag(); emit("end") }
      }
      return true
    }
    detector.onTouchEvent(event)
    return super.dispatchTouchEvent(event)
  }

  private fun beginDrag(event: MotionEvent) {
    dragging = true
    touchX = event.x
    touchY = event.y
    recycler.stopScroll()
    parent?.requestDisallowInterceptTouchEvent(true)
    val cancel = MotionEvent.obtain(event)
    cancel.action = MotionEvent.ACTION_CANCEL
    recycler.dispatchTouchEvent(cancel)
    cancel.recycle()
    emit("start")
    removeCallbacks(autoScroll)
    postOnAnimation(autoScroll)
  }

  private fun stopDrag() {
    dragging = false
    gestureAnchor = -1
    removeCallbacks(autoScroll)
    parent?.requestDisallowInterceptTouchEvent(false)
  }

  private fun selectCharacter(offset: Int) {
    val safe = min(offset, document.length - 1).coerceAtLeast(0)
    start = floorBoundary(safe)
    end = ceilBoundary(safe + 1)
    invalidateVisible()
  }

  private fun updateDrag(x: Float, y: Float) {
    val offset = hitTest(x, y.coerceIn(0f, max(0f, height - 1f))) ?: return
    val previousStart = start
    val previousEnd = end
    if (gestureAnchor >= 0) {
      val range = SelectionRanges.extend(gestureAnchor, offset, document.length, ::floorBoundary, ::ceilBoundary) ?: return
      start = range.start
      end = range.end
    } else if (activeStart) {
      start = floorBoundary(offset.coerceAtMost(max(0, end - 1)))
    } else {
      end = ceilBoundary(offset.coerceAtLeast(min(document.length, start + 1)))
    }
    if (start != previousStart || end != previousEnd) {
      invalidateVisible()
      emit("change")
    }
  }

  private fun floorBoundary(offset: Int): Int {
    val safe = offset.coerceIn(0, document.length)
    return if (graphemes.isBoundary(safe)) safe else graphemes.preceding(safe).coerceAtLeast(0)
  }

  private fun ceilBoundary(offset: Int): Int {
    val safe = offset.coerceIn(0, document.length)
    return if (graphemes.isBoundary(safe)) safe else graphemes.following(safe).let { if (it < 0) document.length else it }
  }

  private fun hitTest(x: Float, y: Float, character: Boolean = false): Int? {
    val child = recycler.findChildViewUnder(x.coerceIn(0f, max(0f, recycler.width - 1f)), y)
      ?: if (y <= 0f) recycler.getChildAt(0) else recycler.getChildAt(recycler.childCount - 1)
    val row = child as? ChunkView ?: return null
    return row.offsetAt(x - row.left, y - row.top, character)
  }

  private fun endpoint(offset: Int, trailing: Boolean): PointF? {
    if (offset < 0 || chunks.isEmpty()) return null
    val index = TextChunks.find(chunks, if (trailing && offset > 0) offset - 1 else offset)
    val row = manager.findViewByPosition(index) as? ChunkView ?: return null
    val point = row.caret(offset, trailing) ?: return null
    point.offset(row.left.toFloat(), row.top.toFloat())
    return if (point.y >= 0f && point.y <= height) point else null
  }

  private fun selectionAnchor(): RectF {
    val rectangles = ArrayList<RectF>(recycler.childCount)
    forEachVisible { row -> row.selectedBounds()?.let { it.offset(row.left.toFloat(), row.top.toFloat()); rectangles.add(it) } }
    if (rectangles.isEmpty()) return RectF()
    val bounds = RectF(rectangles[0])
    rectangles.drop(1).forEach { bounds.union(it) }
    bounds.left = bounds.left.coerceIn(0f, width.toFloat())
    bounds.right = bounds.right.coerceIn(bounds.left, width.toFloat())
    bounds.top = bounds.top.coerceIn(0f, height.toFloat())
    bounds.bottom = bounds.bottom.coerceIn(bounds.top, height.toFloat())
    return bounds
  }

  private fun emit(phase: String) {
    val reactContext = context as? ReactContext ?: return
    if (id == NO_ID) return
    val bounds = if (start >= 0) selectionAnchor() else RectF()
    val data = Arguments.createMap().apply {
      putInt("start", start)
      putInt("end", end)
      putInt("documentVersion", documentVersion)
      putString("phase", phase)
      putDouble("anchorX", (bounds.left / density).toDouble())
      putDouble("anchorY", (bounds.top / density).toDouble())
      putDouble("anchorWidth", (bounds.width() / density).toDouble())
      putDouble("anchorHeight", (bounds.height() / density).toDouble())
    }
    UIManagerHelper.getEventDispatcher(reactContext)?.dispatchEvent(
      object : Event<SelectionEvent>(UIManagerHelper.getSurfaceId(this@RNSelectCharsView), id) {
        override fun getEventName() = "topNativeSelectionChange"
        override fun canCoalesce() = false
        override fun getEventData() = data
      }
    )
  }

  // Event's recursive type needs a named type, while the immutable payload stays in the instance.
  private abstract class SelectionEvent : Event<SelectionEvent>()

  private fun schedulePosition() {
    overlay.invalidate()
    if (!positionScheduled && attached && start >= 0) {
      positionScheduled = true
      postOnAnimation(positionCallback)
    }
  }

  private fun resetLayouts() {
    adapter.notifyDataSetChanged()
    schedulePosition()
  }

  private inline fun forEachVisible(action: (ChunkView) -> Unit) {
    for (index in 0 until recycler.childCount) (recycler.getChildAt(index) as? ChunkView)?.let(action)
  }

  private fun invalidateVisible() { forEachVisible { it.invalidate() }; overlay.invalidate() }

  private inner class ChunkAdapter : RecyclerView.Adapter<ChunkHolder>() {
    override fun getItemCount() = chunks.size
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ChunkHolder(ChunkView(parent.context))
    override fun onBindViewHolder(holder: ChunkHolder, position: Int) = holder.row.bind(position)
    override fun onViewRecycled(holder: ChunkHolder) = holder.row.recycle()
  }

  private inner class ChunkHolder(val row: ChunkView) : RecyclerView.ViewHolder(row)

  private inner class ChunkView(context: Context) : View(context) {
    private var chunk = TextChunk(0, 0)
    private var value = ""
    private var layout: StaticLayout? = null
    private var layoutWidth = 0
    private var lastChunk = false
    private var highlights: List<TextHighlight> = emptyList()
    private val textPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val selectionPath = Path()
    private var measuredTextHeight = 1

    init {
      layoutParams = RecyclerView.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
      importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
      isFocusable = true
    }

    fun bind(index: Int) {
      chunk = chunks[index]
      value = document.substring(chunk.start, chunk.end)
      lastChunk = index == chunks.lastIndex
      layout = null
      layoutWidth = 0
      refreshHighlights()
      requestLayout()
      invalidate()
    }

    fun recycle() { layout = null; value = ""; highlights = emptyList() }

    fun refreshHighlights() { highlights = marks.intersecting(chunk.start, chunk.end); invalidate() }

    fun ensureLayout(availableWidth: Int) {
      if (layout != null && layoutWidth == availableWidth) return
      layoutWidth = max(1, availableWidth)
      val unit = if (allowScaling) TypedValue.COMPLEX_UNIT_SP else TypedValue.COMPLEX_UNIT_DIP
      textPaint.textSize = TypedValue.applyDimension(unit, fontSize, resources.displayMetrics)
      textPaint.color = textColorValue
      textPaint.typeface = if (fontFamily.isEmpty()) Typeface.DEFAULT else ReactFontManager.getInstance().getTypeface(fontFamily, Typeface.NORMAL, context.assets)
      val spacing = if (lineHeight > 0f) TypedValue.applyDimension(unit, lineHeight, resources.displayMetrics) - textPaint.fontSpacing else 0f
      val result = StaticLayout.Builder.obtain(value, 0, value.length, textPaint, layoutWidth)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
        .setTextDirection(android.text.TextDirectionHeuristics.FIRSTSTRONG_LTR)
        .setIncludePad(false)
        .setBreakStrategy(Layout.BREAK_STRATEGY_SIMPLE)
        .setHyphenationFrequency(Layout.HYPHENATION_FREQUENCY_NONE)
        .setLineSpacing(spacing, 1f)
        .build()
      layout = result
      // The following chunk supplies this empty trailing line, without duplicating blank paragraphs.
      val lines = if (!lastChunk && value.endsWith('\n') && result.lineCount > 1 && result.getLineStart(result.lineCount - 1) == value.length) result.lineCount - 1 else result.lineCount
      measuredTextHeight = max(1, result.getLineBottom(lines - 1))
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
      ensureLayout(max(1, MeasureSpec.getSize(widthMeasureSpec)))
      setMeasuredDimension(layoutWidth, measuredTextHeight)
    }

    override fun onDraw(canvas: Canvas) {
      super.onDraw(canvas)
      val textLayout = layout ?: return
      canvas.save()
      canvas.clipRect(0, 0, width, measuredTextHeight)
      highlights.forEach { mark -> drawRange(canvas, mark.start, mark.end, mark.color) }
      if (start >= 0) drawRange(canvas, start, end, selectedColor)
      textLayout.draw(canvas)
      highlights.forEach { mark ->
        if (mark.hint.isNotEmpty() && mark.end > chunk.start && mark.end <= chunk.end) {
          val caret = caret(mark.end, true) ?: return@forEach
          val hintPaint = TextPaint(textPaint).apply { textSize = max(10f * density, textPaint.textSize * .7f); color = textColorValue }
          val label = android.text.TextUtils.ellipsize(mark.hint, hintPaint, max(1f, width * .4f), android.text.TextUtils.TruncateAt.END).toString()
          val badgeWidth = hintPaint.measureText(label) + 8f * density
          val badgeHeight = hintPaint.fontSpacing + 2f * density
          val left = (caret.x + 3f * density).coerceIn(0f, max(0f, width - badgeWidth))
          val top = (caret.y - badgeHeight).coerceIn(0f, max(0f, height - badgeHeight))
          fill.color = mark.color
          canvas.drawRoundRect(left, top, left + badgeWidth, top + badgeHeight, 3f * density, 3f * density, fill)
          canvas.drawText(label, left + 4f * density, top - hintPaint.fontMetrics.top, hintPaint)
        }
      }
      canvas.restore()
    }

    private fun drawRange(canvas: Canvas, first: Int, last: Int, color: Int) {
      if (first >= chunk.end || last <= chunk.start) return
      selectionPath.reset()
      layout?.getSelectionPath(max(0, first - chunk.start), min(value.length, last - chunk.start), selectionPath)
      fill.color = color
      canvas.drawPath(selectionPath, fill)
    }

    fun selectedBounds(): RectF? {
      if (start < 0 || start >= chunk.end || end <= chunk.start) return null
      selectionPath.reset()
      layout?.getSelectionPath(max(0, start - chunk.start), min(value.length, end - chunk.start), selectionPath) ?: return null
      return RectF().also { selectionPath.computeBounds(it, true) }
    }

    fun offsetAt(x: Float, y: Float, character: Boolean): Int {
      val textLayout = layout ?: return chunk.start
      val line = textLayout.getLineForVertical(y.toInt().coerceIn(0, max(0, measuredTextHeight - 1)))
      var offset = textLayout.getOffsetForHorizontal(line, x.coerceIn(0f, width.toFloat()))
      if (character && offset > textLayout.getLineStart(line)) {
        val caretX = textLayout.getPrimaryHorizontal(offset)
        val rtl = textLayout.isRtlCharAt(max(0, offset - 1))
        if ((!rtl && x < caretX) || (rtl && x > caretX)) offset--
      }
      return chunk.start + offset
    }

    fun lineTop(offset: Int): Int {
      val textLayout = layout ?: return 0
      return textLayout.getLineTop(textLayout.getLineForOffset((offset - chunk.start).coerceIn(0, value.length)))
    }

    fun caret(offset: Int, trailing: Boolean): PointF? {
      val textLayout = layout ?: return null
      val local = (offset - chunk.start).coerceIn(0, value.length)
      val line = textLayout.getLineForOffset(if (trailing && local > 0) local - 1 else local)
      val x = if (trailing && textLayout.getLineForOffset(local) != line) {
        if (textLayout.getParagraphDirection(line) == Layout.DIR_RIGHT_TO_LEFT) textLayout.getLineLeft(line) else textLayout.getLineRight(line)
      } else textLayout.getPrimaryHorizontal(local)
      return PointF(x, textLayout.getLineBottom(line).toFloat())
    }

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
      super.onInitializeAccessibilityNodeInfo(info)
      info.className = "android.widget.TextView"
      info.text = value
      if (Build.VERSION.SDK_INT >= 33) info.isTextSelectable = enabledSelection
      if (enabledSelection) {
        info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SET_SELECTION)
        info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_COPY)
      }
      if (start >= 0 && start < chunk.end && end > chunk.start) info.setTextSelection(max(0, start - chunk.start), min(value.length, end - chunk.start))
    }

    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
      if (enabledSelection && action == AccessibilityNodeInfo.ACTION_SET_SELECTION && arguments != null) {
        val first = arguments.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, -1)
        val last = arguments.getInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, -1)
        if (first >= 0 && last > first) {
          setSelection(chunk.start + first.coerceAtMost(value.length), chunk.start + last.coerceAtMost(value.length))
          sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED)
          return true
        }
      }
      if (action == AccessibilityNodeInfo.ACTION_COPY && start >= 0 && end > start) {
        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(ClipData.newPlainText("", document.substring(start, end)))
        return true
      }
      return super.performAccessibilityAction(action, arguments)
    }
  }

  private inner class HandleOverlay(context: Context) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    init { importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO; isClickable = false }
    override fun onDraw(canvas: Canvas) {
      if (start < 0 || !enabledSelection) return
      paint.color = selectedColor or -0x1000000
      listOf(endpoint(start, false), endpoint(end, true)).forEach { point ->
        if (point != null) {
          canvas.drawRect(point.x - density, point.y - fontSize * density, point.x + density, point.y, paint)
          canvas.drawCircle(point.x, point.y + 5f * density, 6f * density, paint)
        }
      }
    }
  }
}
