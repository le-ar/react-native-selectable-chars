package com.andrei.reactnativeselectchars

/** One owner per pointer sequence; a drag's eventual UP can never become a tap. */
internal class SelectionGesture {
  private enum class Phase { IDLE, TRACKING, DRAGGING, CONSUMED }
  private var phase = Phase.IDLE
  val isDragging: Boolean get() = phase == Phase.DRAGGING
  val canClearOnTap: Boolean get() = phase == Phase.TRACKING

  fun down() { phase = Phase.TRACKING }
  fun drag() { phase = Phase.DRAGGING }
  fun finish() { phase = Phase.CONSUMED }
}

internal data class LoupeGeometry(
  val left: Float,
  val top: Float,
  val width: Float,
  val height: Float,
  val sourceX: Float,
  val sourceY: Float,
) {
  companion object {
    const val ZOOM = 1.5f

    fun calculate(viewWidth: Int, viewHeight: Int, density: Float, x: Float, y: Float): LoupeGeometry? {
      if (viewWidth <= 0 || viewHeight <= 0) return null
      val viewportWidth = viewWidth.toFloat()
      val viewportHeight = viewHeight.toFloat()
      val inset = minOf(4f * density, minOf(viewportWidth, viewportHeight) / 4f)
      val width = minOf(140f * density, viewportWidth - 2f * inset)
      val height = minOf(56f * density, viewportHeight - 2f * inset)
      val sourceX = x.coerceIn(0f, viewportWidth)
      val sourceY = y.coerceIn(0f, viewportHeight)
      val gap = 24f * density
      val above = sourceY - gap - height
      val below = sourceY + gap
      val top = when {
        above >= inset -> above
        below + height <= viewportHeight - inset -> below
        else -> above.coerceIn(inset, viewportHeight - inset - height)
      }
      val left = (sourceX - width / 2f).coerceIn(inset, viewportWidth - inset - width)
      return LoupeGeometry(left, top, width, height, sourceX, sourceY)
    }
  }
}
