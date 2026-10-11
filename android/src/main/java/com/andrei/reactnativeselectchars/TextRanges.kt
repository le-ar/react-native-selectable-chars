package com.andrei.reactnativeselectchars

/** Source positions always refer to the original UTF-16 string, never rendered decorations. */
internal data class TextChunk(val start: Int, val end: Int)

internal data class TextHighlight(val start: Int, val end: Int, val color: Int, val hint: String)

internal object SelectionRanges {
  fun normalize(first: Int, last: Int, length: Int, floor: (Int) -> Int, ceil: (Int) -> Int): TextChunk? {
    if (first < 0 || last <= first || length == 0) return null
    val start = floor(first.coerceIn(0, length))
    val end = ceil(last.coerceIn(0, length))
    return if (end > start) TextChunk(start, end) else null
  }

  fun extend(anchor: Int, offset: Int, length: Int, floor: (Int) -> Int, ceil: (Int) -> Int): TextChunk? =
    normalize(minOf(anchor, offset), if (offset <= anchor) anchor + 1 else offset, length, floor, ceil)
}

internal object TextChunks {
  const val MAX_LENGTH = 8192

  fun build(text: String, boundaryBefore: (Int) -> Int): List<TextChunk> {
    val result = ArrayList<TextChunk>((text.length / MAX_LENGTH) + 1)
    var start = 0
    while (start < text.length) {
      var end = minOf(start + MAX_LENGTH, text.length)
      if (end < text.length) {
        // Keep ordinary paragraphs intact; pathological paragraphs get bounded native layouts.
        val minimum = start + MAX_LENGTH / 2
        var preferred = end
        var foundWhitespace = false
        for (position in end - 1 downTo minimum) {
          if (text[position] == '\n') {
            preferred = position + 1
            break
          }
          if (!foundWhitespace && text[position].isWhitespace()) {
            preferred = position + 1
            foundWhitespace = true
          }
        }
        end = boundaryBefore(preferred)
        // An enormous single grapheme must not create an empty chunk or an unbounded layout.
        if (end <= start) {
          end = preferred
          if (end > start && text[end - 1].isHighSurrogate() && text[end].isLowSurrogate()) end--
        }
      }
      result.add(TextChunk(start, end))
      start = end
    }
    return result
  }

  fun find(chunks: List<TextChunk>, offset: Int): Int {
    if (chunks.isEmpty()) return -1
    var low = 0
    var high = chunks.lastIndex
    while (low < high) {
      val middle = (low + high + 1) ushr 1
      if (chunks[middle].start <= offset) low = middle else high = middle - 1
    }
    return low
  }
}

/** A balanced interval tree prunes irrelevant marks, including when a long mark spans many rows. */
internal class HighlightIndex(values: List<TextHighlight> = emptyList()) {
  private val highlights = values.sortedBy { it.start }
  private val maximumEnd = IntArray(highlights.size)

  init {
    build(0, highlights.size)
  }

  private fun build(low: Int, high: Int): Int {
    if (low >= high) return 0
    val middle = (low + high) ushr 1
    val result = maxOf(highlights[middle].end, build(low, middle), build(middle + 1, high))
    maximumEnd[middle] = result
    return result
  }

  fun intersecting(start: Int, end: Int): List<TextHighlight> = ArrayList<TextHighlight>().also { query(0, highlights.size, start, end, it) }

  private fun query(low: Int, high: Int, start: Int, end: Int, result: MutableList<TextHighlight>) {
    if (low >= high || highlights[low].start >= end) return
    val middle = (low + high) ushr 1
    if (maximumEnd[middle] <= start) return
    query(low, middle, start, end, result)
    val mark = highlights[middle]
    if (mark.start < end && mark.end > start) result.add(mark)
    if (mark.start < end) query(middle + 1, high, start, end, result)
  }
}
