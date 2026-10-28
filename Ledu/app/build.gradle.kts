import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.isFile) file.inputStream().use { load(it) }
}

android {
    namespace = "com.chadm.ledu"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.chadm.ledu"
        minSdk = 30
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
        manifestPlaceholders["amapApiKey"] = localProperties.getProperty("amap.api.key", "TODO_KEY")
    }

    signingConfigs {
        create("release") {
            storeFile = localProperties.getProperty("release.store.file")?.let { rootProject.file(it) }
            storePassword = localProperties.getProperty("release.store.password")
            keyAlias = localProperties.getProperty("release.key.alias")
            keyPassword = localProperties.getProperty("release.key.password")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
    lint {
        // Crash in the lint tool itself (IncompatibleClassChangeError), not a real issue.
        disable += "NullSafeMutableLiveData"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    // Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2025.09.00")
    implementation(composeBom)
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-tooling-preview")

    // Activity / Navigation / Lifecycle
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.navigation:navigation-compose:2.8.4")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")

    // Core
    implementation("androidx.core:core-ktx:1.15.0")

    // Media3: background playback with a MediaSessionService (pattern taken
    // from the decompiled Kugou player: service owns the session, UI is a shell)
    implementation("androidx.media3:media3-exoplayer:1.5.1")
    implementation("androidx.media3:media3-session:1.5.1")
    implementation("androidx.media3:media3-common:1.5.1")

    // Room: RSS feed subscription + article storage
    implementation("androidx.room:room-runtime:2.7.2")
    implementation("androidx.room:room-ktx:2.7.2")
    ksp("androidx.room:room-compiler:2.7.2")

    // OkHttp: RSS fetching
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Coil: cover images on list cards and article body images (network)
    implementation("io.coil-kt:coil-compose:2.7.0")

    // AMap SDK: workout track rendering (wgs84->gcj02 converted polylines).
    // With a placeholder key the app falls back to a locally drawn Canvas track.
    implementation("com.amap.api:3dmap:10.0.600")
}
