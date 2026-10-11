package com.andrei.reactnativeselectchars

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.BreakIterator
import java.util.Locale
import java.util.Random

class TextRangesTest {
  private fun chunks(text: String): List<TextChunk> {
    val boundaries = BreakIterator.getCharacterInstance(Locale.ROOT).apply { setText(text) }
    return TextChunks.build(text) { if (boundaries.isBoundary(it)) it else boundaries.preceding(it) }
  }

  @Test fun emptyDocumentHasNoPhantomRow() {
    assertTrue(chunks("").isEmpty())
    assertEquals(-1, TextChunks.find(emptyList(), 0))
  }

  @Test fun bookChunksPreserveEverySourceOffsetAndBlankParagraph() {
    val text = ("Chapter\n\nA paragraph with punctuation, spaces and 😀.\n").repeat(25000) + "The end.\n"
    val result = chunks(text)
    assertEquals(text, result.joinToString("") { text.substring(it.start, it.end) })
    assertTrue(result.all { it.end > it.start && it.end - it.start <= TextChunks.MAX_LENGTH })
    assertEquals(text.length, result.last().end)
    result.forEachIndexed { index, chunk ->
      assertEquals(index, TextChunks.find(result, chunk.start))
      assertEquals(index, TextChunks.find(result, chunk.end - 1))
      if (index > 0) assertEquals(result[index - 1].end, chunk.start)
    }
    assertEquals(result.lastIndex, TextChunks.find(result, text.length))
  }

  @Test fun hugeParagraphDoesNotCreateAnUnboundedNativeLayout() {
    val text = "a".repeat(1000000)
    val result = chunks(text)
    assertTrue(result.size > 100)
    assertTrue(result.all { it.end - it.start <= TextChunks.MAX_LENGTH })
    assertEquals(text.length, result.sumOf { it.end - it.start })
  }

  @Test fun chunkCutDoesNotSplitASurrogatePairOrCombiningCharacter() {
    val text = "a".repeat(TextChunks.MAX_LENGTH - 1) + "😀" + "e\u0301".repeat(10000)
    val result = chunks(text)
    assertTrue(result.dropLast(1).all { !text[it.end].isLowSurrogate() && text[it.end] != '\u0301' })
    assertEquals(text, result.joinToString("") { text.substring(it.start, it.end) })
  }

  @Test fun highlightsUseHalfOpenIntersectionsAndRetainNestedSpanningRanges() {
    val marks = listOf(
      TextHighlight(0, 1000, 0, "outer"),
      TextHighlight(4, 5, 1, "before"),
      TextHighlight(5, 6, 2, "inside"),
      TextHighlight(6, 7, 3, "after"),
    )
    assertEquals(listOf("outer", "inside"), HighlightIndex(marks).intersecting(5, 6).map { it.hint })
  }

  @Test fun intervalIndexMatchesSourceRangesAcrossOverlapsAndFarAwayMarks() {
    val random = Random(42)
    val marks = (0 until 10000).map {
      val first = random.nextInt(1000000)
      TextHighlight(first, first + 1 + random.nextInt(10000), it, "")
    } + TextHighlight(0, 10000000, -1, "long")
    val index = HighlightIndex(marks)
    repeat(300) {
      val first = random.nextInt(1000000)
      val last = first + 100
      val expected = marks.filter { it.start < last && it.end > first }.map { it.color }.sorted()
      assertEquals(expected, index.intersecting(first, last).map { it.color }.sorted())
    }
  }

  @Test fun selectionExpandsPartialUtf16GraphemesAndKeepsHalfOpenOffsets() {
    // "a😀é\n b": exact boundaries include a surrogate pair and a combining sequence.
    val boundaries = listOf(0, 1, 3, 5, 6, 7, 8)
    fun floor(offset: Int) = boundaries.last { it <= offset }
    fun ceil(offset: Int) = boundaries.first { it >= offset }
    assertEquals(TextChunk(1, 5), SelectionRanges.normalize(2, 4, 8, ::floor, ::ceil))
    assertEquals(TextChunk(6, 7), SelectionRanges.normalize(6, 7, 8, ::floor, ::ceil))
    assertEquals(TextChunk(7, 8), SelectionRanges.normalize(7, 100, 8, ::floor, ::ceil))
    assertEquals(null, SelectionRanges.normalize(8, 100, 8, ::floor, ::ceil))
    assertEquals(null, SelectionRanges.normalize(-1, 5, 8, ::floor, ::ceil))
    assertEquals(null, SelectionRanges.normalize(5, 5, 8, ::floor, ::ceil))
  }

  @Test fun reverseDragAcrossParagraphsRetainsTheWholeInitialCharacter() {
    val boundaries = listOf(0, 1, 3, 5, 6, 7, 8)
    fun floor(offset: Int) = boundaries.last { it <= offset }
    fun ceil(offset: Int) = boundaries.first { it >= offset }
    assertEquals(TextChunk(0, 8), SelectionRanges.extend(7, 0, 8, ::floor, ::ceil))
    assertEquals(TextChunk(1, 8), SelectionRanges.extend(1, 8, 8, ::floor, ::ceil))
    assertEquals(TextChunk(1, 3), SelectionRanges.extend(1, 1, 8, ::floor, ::ceil))
  }
}
