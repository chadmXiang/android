package com.chadm.ledu.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF3F6CFF),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8AB4F8),
)

@Composable
fun LeduTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}

@Composable
fun MusicTheme(enabled: Boolean, content: @Composable () -> Unit) {
    if (!enabled) {
        content()
        return
    }
    val colors = if (isSystemInDarkTheme()) {
        darkColorScheme(
            primary = Color(0xFF56D9ED),
            onPrimary = Color(0xFF003940),
            primaryContainer = Color(0xFF123E48),
            onPrimaryContainer = Color(0xFF9CECF7),
            background = Color(0xFF101C22),
            surface = Color(0xFF101C22),
            onSurface = Color(0xFFE1EEF1),
            onSurfaceVariant = Color(0xFF91A5AC),
            surfaceContainerLow = Color(0xFF172831),
            surfaceContainer = Color(0xFF1D303A),
            surfaceContainerHigh = Color(0xFF243B46),
            surfaceContainerHighest = Color(0xFF2A4550),
            secondaryContainer = Color(0xFF244E59),
            onSecondaryContainer = Color(0xFF9CECF7),
            outlineVariant = Color(0xFF304852),
        )
    } else {
        lightColorScheme(
            primary = Color(0xFF13BBD7),
            onPrimary = Color.White,
            primaryContainer = Color(0xFFC6F5FC),
            onPrimaryContainer = Color(0xFF087C92),
            background = Color(0xFFF5FAFD),
            surface = Color(0xFFF5FAFD),
            onSurface = Color(0xFF202729),
            onSurfaceVariant = Color(0xFF8C969C),
            surfaceContainerLow = Color(0xFFEDF7FC),
            surfaceContainer = Color(0xFFF0F8FC),
            surfaceContainerHigh = Color(0xFFE0F1F7),
            surfaceContainerHighest = Color(0xFFD6EDF4),
            secondaryContainer = Color(0xFFD8F6FC),
            onSecondaryContainer = Color(0xFF087C92),
            outlineVariant = Color(0xFFE1EDF2),
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}

@Composable
fun NewsTheme(enabled: Boolean, content: @Composable () -> Unit) {
    if (!enabled) {
        content()
        return
    }
    val colors = if (isSystemInDarkTheme()) {
        MaterialTheme.colorScheme.copy(
            background = Color(0xFF121212),
            surface = Color(0xFF181818),
            onSurface = Color(0xFFE8E8E8),
            onSurfaceVariant = Color(0xFFA4A4A4),
            surfaceVariant = Color(0xFF292929),
            surfaceContainer = Color(0xFF202020),
            surfaceContainerLow = Color(0xFF202020),
            surfaceContainerHighest = Color(0xFF303030),
            secondaryContainer = Color(0xFF243854),
            onSecondaryContainer = Color(0xFFB6D4FF),
            outlineVariant = Color(0xFF333333),
        )
    } else {
        MaterialTheme.colorScheme.copy(
            background = Color.White,
            surface = Color.White,
            onSurface = Color(0xFF202124),
            onSurfaceVariant = Color(0xFF7B8088),
            surfaceVariant = Color(0xFFF0F1F3),
            surfaceContainer = Color.White,
            surfaceContainerLow = Color(0xFFF5F6F8),
            surfaceContainerHighest = Color(0xFFEEF0F3),
            secondaryContainer = Color(0xFFEAF1FF),
            onSecondaryContainer = Color(0xFF3F6CFF),
            outlineVariant = Color(0xFFEBEDF0),
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}

/** Sport: Keep-style energetic green. */
@Composable
fun SportTheme(enabled: Boolean, content: @Composable () -> Unit) {
    if (!enabled) {
        content()
        return
    }
    val colors = if (isSystemInDarkTheme()) {
        darkColorScheme(
            primary = Color(0xFF6FDB9A),
            onPrimary = Color(0xFF0B3D24),
            primaryContainer = Color(0xFF1C5236),
            onPrimaryContainer = Color(0xFF9AF2BC),
            background = Color(0xFF101711),
            surface = Color(0xFF101711),
            onSurface = Color(0xFFE0EEE4),
            onSurfaceVariant = Color(0xFF93A89B),
            surfaceVariant = Color(0xFF1D2A20),
            surfaceContainer = Color(0xFF1D2A20),
            surfaceContainerHigh = Color(0xFF243529),
            surfaceContainerHighest = Color(0xFF2B4231),
            secondaryContainer = Color(0xFF245743),
            onSecondaryContainer = Color(0xFF9AF2BC),
            outlineVariant = Color(0xFF314A38),
        )
    } else {
        lightColorScheme(
            primary = Color(0xFF1BC47E),
            onPrimary = Color.White,
            primaryContainer = Color(0xFFC7F6DC),
            onPrimaryContainer = Color(0xFF0C7446),
            background = Color(0xFFF5FBF5),
            surface = Color(0xFFF5FBF5),
            onSurface = Color(0xFF1E2621),
            onSurfaceVariant = Color(0xFF8B9A90),
            surfaceVariant = Color(0xFFE0EDE3),
            surfaceContainerLow = Color(0xFFECF6EC),
            surfaceContainer = Color(0xFFF0F9F0),
            surfaceContainerHigh = Color(0xFFE0F0E3),
            surfaceContainerHighest = Color(0xFFD6EBDA),
            secondaryContainer = Color(0xFFD7F5E1),
            onSecondaryContainer = Color(0xFF0C7446),
            outlineVariant = Color(0xFFE0EDE3),
        )
    }
    MaterialTheme(colorScheme = colors, content = content)
}
