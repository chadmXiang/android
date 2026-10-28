package com.chadm.ledu.news

import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.InputStream
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Minimal RSS 2.0 / Atom parser. Namespace prefixes are ignored; matching is
 * done on local tag names, which covers the common feeds.
 */
object RssParser {

    data class FeedInfo(val title: String, val siteLink: String, val description: String)
    data class ItemInfo(val title: String, val link: String, val publishedAt: Long, val description: String)
    data class Result(val feed: FeedInfo, val items: List<ItemInfo>)

    fun parse(input: InputStream): Result {
        val parser = XmlPullParserFactory.newInstance()
            .apply { isNamespaceAware = true }
            .newPullParser()
        parser.setInput(input, null)

        var feedTitle = ""
        var feedLink = ""
        var feedDescription = ""

        val items = mutableListOf<ItemInfo>()
        var inItem = false
        var inEntry = false
        var itemTitle = ""
        var itemLink = ""
        var itemDate = ""
        var itemDescription = ""

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> {
                    val name = parser.name.lowercase()
                    when {
                        name == "item" -> {
                            inItem = true
                            itemTitle = ""; itemLink = ""; itemDate = ""; itemDescription = ""
                        }

                        name == "entry" -> {
                            inEntry = true
                            itemTitle = ""; itemLink = ""; itemDate = ""; itemDescription = ""
                        }

                        inItem || inEntry -> when (name) {
                            "title" -> itemTitle = parser.nextText().trim()
                            "link" -> {
                                // Atom: <link rel="alternate" href="..."/>, others carry href too.
                                // RSS 2.0: plain text element.
                                val href = parser.getAttributeValue(null, "href")
                                if (href != null) {
                                    val rel = parser.getAttributeValue(null, "rel")
                                    if (itemLink.isEmpty() || rel == "alternate") itemLink = href
                                } else {
                                    itemLink = parser.nextText().trim()
                                }
                            }

                            "pubdate", "published", "updated", "date", "modified" ->
                                if (itemDate.isEmpty()) itemDate = parser.nextText().trim()

                            "description", "summary" -> itemDescription = parser.nextText().trim()

                            "content" -> if (itemDescription.isEmpty()) {
                                itemDescription = parser.nextText().trim()
                            }
                        }

                        else -> when (name) {
                            // Feed-level fields (channel/feed head, before any item/entry).
                            "title" -> if (feedTitle.isEmpty()) feedTitle = parser.nextText().trim()
                            "link" -> {
                                val href = parser.getAttributeValue(null, "href")
                                if (feedLink.isEmpty()) {
                                    feedLink = href ?: parser.nextText().trim()
                                }
                            }

                            "subtitle", "description" ->
                                if (feedDescription.isEmpty()) feedDescription = parser.nextText().trim()
                        }
                    }
                }

                XmlPullParser.END_TAG -> {
                    val name = parser.name.lowercase()
                    if (name == "item" || name == "entry") {
                        items += ItemInfo(
                            title = stripHtml(itemTitle),
                            link = itemLink.trim(),
                            publishedAt = parseDate(itemDate),
                            description = itemDescription,
                        )
                        inItem = false
                        inEntry = false
                    }
                }
            }
            event = parser.next()
        }
        return Result(FeedInfo(stripHtml(feedTitle), feedLink, stripHtml(feedDescription)), items)
    }

    /** Best-effort date parsing; feeds mix RFC-1123 and ISO-8601 variants. */
    fun parseDate(raw: String): Long {
        if (raw.isBlank()) return 0L
        val trimmed = raw.trim()
        parseDate@ for (candidate in sequence {
            yield(runCatching { Instant.parse(trimmed).toEpochMilli() }.getOrNull())
            yield(runCatching { OffsetDateTime.parse(trimmed).toInstant().toEpochMilli() }.getOrNull())
            yield(runCatching { ZonedDateTime.parse(trimmed).toInstant().toEpochMilli() }.getOrNull())
            yield(
                runCatching {
                    OffsetDateTime.parse(trimmed, DateTimeFormatter.RFC_1123_DATE_TIME).toInstant().toEpochMilli()
                }.getOrNull(),
            )
        }) {
            if (candidate != null) return candidate
        }
        return 0L
    }

    /** Crude HTML strip for titles/snippets (descriptions keep raw text, stripped only for display). */
    fun stripHtml(input: String): String {
        if (input.isEmpty()) return input
        return input
            .replace(Regex("<[^>]*>"), " ")
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&apos;", "'")
            .replace(Regex("\\s+"), " ")
            .trim()
    }
}
