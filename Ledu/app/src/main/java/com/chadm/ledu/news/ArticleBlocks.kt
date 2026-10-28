package com.chadm.ledu.news

/**
 * Renderable blocks extracted from an article body.
 *
 * LingoWhale serves WeChat articles as html; the reader page shows an ordered
 * sequence of paragraphs and full-width images instead of one text wall.
 */
sealed interface ArticleBlock {
    data class Paragraph(val text: String) : ArticleBlock
    data class Image(val url: String) : ArticleBlock
}

object ArticleBodyParser {

    private val SCRIPT_OR_STYLE =
        Regex("""<script\b.*?</script>|<style\b.*?</style>""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    private val IMG = Regex("""<img[^>]*\ssrc\s*=\s*["']([^"']+)["'][^>]*>""", RegexOption.IGNORE_CASE)
    // closing block tags become paragraph breaks
    private val BLOCK_END = Regex("""</(?:p|div|section|dplv|h[1-6]|li|tr|blockquote|br)>|<br\s*/?>""", RegexOption.IGNORE_CASE)
    private val TAG = Regex("<[^>]*>")

    /** Parses html (entry_detail data.resource.html) into ordered blocks. */
    fun parseHtml(html: String): List<ArticleBlock> {
        val body = run {
            val start = html.indexOf("<body", ignoreCase = true)
            if (start < 0) html
            else {
                val contentStart = html.indexOf('>', start) + 1
                val end = html.indexOf("</body", contentStart, ignoreCase = true)
                if (end < 0) html.substring(contentStart) else html.substring(contentStart, end)
            }
        }
        val cleaned = SCRIPT_OR_STYLE.replace(body, "")

        val blocks = mutableListOf<ArticleBlock>()
        var cursor = 0
        for (match in IMG.findAll(cleaned)) {
            addTextBlocks(cleaned.substring(cursor, match.range.first), blocks)
            val url = match.groupValues[1]
            if (url.startsWith("http")) blocks.add(ArticleBlock.Image(url))
            cursor = match.range.last + 1
        }
        addTextBlocks(cleaned.substring(cursor), blocks)
        return blocks
    }

    /** Splits plain text / RSS description into paragraphs (blank-line and single-newline breaks). */
    fun parsePlainText(text: String): List<ArticleBlock> =
        text.split(Regex("\n+"))
            .map { decodeAndCollapse(it) }
            .filter { it.isNotBlank() }
            .map { ArticleBlock.Paragraph(it) }

    private fun addTextBlocks(chunk: String, out: MutableList<ArticleBlock>) {
        BLOCK_END.replace(chunk, "\n")
            .split('\n')
            .map { decodeAndCollapse(TAG.replace(it, " ")) }
            .filter { it.isNotBlank() }
            .forEach { out.add(ArticleBlock.Paragraph(it)) }
    }

    private fun decodeAndCollapse(s: String): String =
        s.replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&apos;", "'")
            .replace(Regex("\\s+"), " ")
            .trim()
}
