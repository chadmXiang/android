package com.chadm.ledu.news

/**
 * Rewrites Aliyun OSS image URLs to a server-side resized variant. Yujing
 * article images are multi-megabyte raw uploads; requesting a resized copy
 * cuts download time and memory. Non-OSS URLs pass through untouched.
 */
fun resizedImageUrl(url: String?, widthPx: Int): String? {
    if (url == null) return null
    if (!url.contains("aliyuncs.com")) return url
    val separator = if ('?' in url) "&" else "?"
    return "$url${separator}x-oss-process=image/resize,w_$widthPx"
}
