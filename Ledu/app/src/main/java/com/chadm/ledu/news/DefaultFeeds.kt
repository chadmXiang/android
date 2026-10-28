package com.chadm.ledu.news

/**
 * One curated default feed: URL + catalog category. Selected from the RSS
 * portion of the LingoWhale (yujing) channel catalog; each URL was verified
 * reachable and parseable before inclusion. Sources that failed (36kr empty
 * feed, a16z/zaobao/digitaling 404, venturebeat rate-limited) are excluded.
 */
data class DefaultFeed(val url: String, val category: String)

val DEFAULT_FEEDS: List<DefaultFeed> = listOf(
    DefaultFeed("https://sspai.com/feed", "科技"),
    DefaultFeed("https://www.qbitai.com/feed", "AI"),
    DefaultFeed("https://www.ithome.com/rss/", "科技"),
    DefaultFeed("https://www.ifanr.com/feed", "科技"),
    DefaultFeed("https://www.gcores.com/rss", "科技"),
    DefaultFeed("http://export.arxiv.org/rss/cs.AI", "AI"),
    DefaultFeed("http://export.arxiv.org/rss/cs.LG", "AI"),
    DefaultFeed("https://openai.com/news/rss.xml", "AI"),
    DefaultFeed("https://www.technologyreview.com/feed/", "AI"),
    DefaultFeed("https://www.techmeme.com/feed.xml", "科技"),
    DefaultFeed("https://www.theverge.com/rss/index.xml", "科技"),
    DefaultFeed("https://techcrunch.com/feed/", "科技"),
)
