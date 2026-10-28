package com.chadm.ledu

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Article
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.DirectionsRun
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material3.Icon
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.chadm.ledu.music.MusicListScreen
import com.chadm.ledu.music.PlaylistScreen
import com.chadm.ledu.music.PlayerScreen
import com.chadm.ledu.news.ArticleScreen
import com.chadm.ledu.news.ManageFeedsScreen
import com.chadm.ledu.news.DiscoverScreen
import com.chadm.ledu.news.NewsScreen
import com.chadm.ledu.ui.theme.LeduTheme
import com.chadm.ledu.ui.theme.NewsTheme
import com.chadm.ledu.ui.theme.MusicTheme
import com.chadm.ledu.sport.SportHomeScreen
import com.chadm.ledu.sport.SportImportScreen
import com.chadm.ledu.sport.WorkoutDetailScreen
import com.chadm.ledu.ui.theme.SportTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // AMap SDK 9+ refuses to load tiles unless privacy compliance is
        // explicitly acknowledged before any MapView is created.
        com.amap.api.maps.MapsInitializer.updatePrivacyShow(this, true, true)
        com.amap.api.maps.MapsInitializer.updatePrivacyAgree(this, true)
        enableEdgeToEdge()
        setContent {
            LeduTheme {
                LeduApp()
            }
        }
    }
}

private object Route {
    const val MUSIC = "music"
    const val PLAYER = "player"
    const val PLAYLIST = "playlist/{id}?name={name}"
    const val NEWS = "news"
    const val DISCOVER = "discover"
    const val MANAGE = "manage"
    const val ARTICLE = "article/{id}"
    const val SPORT = "sport"
    const val WORKOUT = "workout/{logId}"
    const val SPORT_IMPORT = "sport_import"
}

@Composable
fun LeduApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val topLevelRoutes = setOf(Route.MUSIC, Route.NEWS, Route.DISCOVER, Route.SPORT)
    val keyboardVisible = WindowInsets.ime.getBottom(LocalDensity.current) > 0
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val onOpenNavigationDrawer: () -> Unit = { scope.launch { drawerState.open() } }
    val selectDestination: (String) -> Unit = { route ->
        scope.launch {
            drawerState.close()
            navController.navigateTopLevel(route)
        }
    }

    MusicTheme(
        enabled = currentRoute == Route.MUSIC || currentRoute == Route.PLAYER ||
            currentRoute == Route.PLAYLIST,
    ) {
    NewsTheme(
        enabled = currentRoute == Route.NEWS || currentRoute == Route.DISCOVER ||
            currentRoute == Route.MANAGE || currentRoute == Route.ARTICLE,
    ) {
    SportTheme(
        enabled = currentRoute == Route.SPORT || currentRoute == Route.WORKOUT ||
            currentRoute == Route.SPORT_IMPORT,
    ) {
    ModalNavigationDrawer(
        drawerState = drawerState,
        gesturesEnabled = currentRoute in topLevelRoutes && !keyboardVisible,
        drawerContent = {
            ModalDrawerSheet(Modifier.widthIn(max = 320.dp)) {
                Column(
                    Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 12.dp),
                ) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 24.dp)) {
                        Text("乐读", style = MaterialTheme.typography.headlineMedium)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "音乐与资讯",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    HorizontalDivider(Modifier.padding(bottom = 12.dp))
                    NavigationDrawerItem(
                        selected = currentRoute == Route.MUSIC,
                        onClick = { selectDestination(Route.MUSIC) },
                        icon = { Icon(Icons.Filled.MusicNote, contentDescription = null) },
                        label = { Text("音乐") },
                    )
                    NavigationDrawerItem(
                        selected = currentRoute == Route.NEWS,
                        onClick = { selectDestination(Route.NEWS) },
                        icon = { Icon(Icons.Filled.Article, contentDescription = null) },
                        label = { Text("新闻") },
                    )
                    NavigationDrawerItem(
                        selected = currentRoute == Route.DISCOVER,
                        onClick = { selectDestination(Route.DISCOVER) },
                        icon = { Icon(Icons.Filled.Explore, contentDescription = null) },
                        label = { Text("发现") },
                    )
                    NavigationDrawerItem(
                        selected = currentRoute == Route.SPORT,
                        onClick = { selectDestination(Route.SPORT) },
                        icon = { Icon(Icons.Filled.DirectionsRun, contentDescription = null) },
                        label = { Text("运动") },
                    )
                    Spacer(Modifier.height(12.dp))
                }
            }
        },
    ) {
    Scaffold(
        contentWindowInsets = WindowInsets.safeDrawing,
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Route.MUSIC,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding).imePadding(),
        ) {
            composable(Route.MUSIC) {
                MusicListScreen(
                    onOpenNavigationDrawer = onOpenNavigationDrawer,
                    onOpenPlayer = { navController.navigate(Route.PLAYER) },
                    onOpenPlaylist = { id, name ->
                        navController.navigate("playlist/$id?name=${Uri.encode(name)}")
                    },
                )
            }
            composable(
                Route.PLAYLIST,
                arguments = listOf(
                    navArgument("id") { type = NavType.LongType },
                    navArgument("name") { type = NavType.StringType; defaultValue = "歌单" },
                ),
            ) { entry ->
                PlaylistScreen(
                    playlistId = entry.arguments?.getLong("id") ?: 0L,
                    playlistName = entry.arguments?.getString("name") ?: "歌单",
                    onBack = { navController.popBackStack() },
                    onOpenPlayer = { navController.navigate(Route.PLAYER) },
                )
            }
            composable(Route.PLAYER) {
                PlayerScreen(onBack = { navController.popBackStack() })
            }
            composable(Route.NEWS) {
                NewsScreen(
                    onOpenNavigationDrawer = onOpenNavigationDrawer,
                    onOpenArticle = { id -> navController.navigate("article/$id") },
                    onManage = { navController.navigate(Route.MANAGE) },
                )
            }
            composable(Route.DISCOVER) {
                DiscoverScreen(onOpenNavigationDrawer = onOpenNavigationDrawer)
            }
            composable(Route.MANAGE) {
                ManageFeedsScreen(onBack = { navController.popBackStack() })
            }
            composable(
                Route.ARTICLE,
                arguments = listOf(navArgument("id") { type = NavType.LongType }),
            ) { entry ->
                ArticleScreen(
                    articleId = entry.arguments?.getLong("id") ?: 0L,
                    onBack = { navController.popBackStack() },
                )
            }
            composable(Route.SPORT) {
                SportHomeScreen(
                    onOpenNavigationDrawer = onOpenNavigationDrawer,
                    onOpenWorkout = { logId -> navController.navigate("workout/$logId") },
                    onOpenImport = { navController.navigate(Route.SPORT_IMPORT) },
                )
            }
            composable(
                Route.WORKOUT,
                arguments = listOf(navArgument("logId") { type = NavType.StringType }),
            ) { entry ->
                WorkoutDetailScreen(
                    logId = entry.arguments?.getString("logId") ?: "",
                    onBack = { navController.popBackStack() },
                )
            }
            composable(Route.SPORT_IMPORT) {
                SportImportScreen(
                    onBack = { navController.popBackStack() },
                    onDone = { navController.popBackStack() },
                )
            }
        }
    }
    }
    }
    }
    }
    // Register after destination handlers so Back dismisses the drawer first.
    if (drawerState.isOpen) {
        BackHandler {
            scope.launch { drawerState.close() }
        }
    }
}

private fun androidx.navigation.NavHostController.navigateTopLevel(route: String) {
    navigate(route) {
        popUpTo(graph.startDestinationId) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

