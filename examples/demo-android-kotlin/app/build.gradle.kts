plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.projectcrossplay.demo"
    compileSdk = 33

    defaultConfig {
        applicationId = "com.projectcrossplay.demo"
        minSdk = 30
        targetSdk = 33
        versionCode = 1
        versionName = "0.1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// Deliberately no dependencies beyond the Kotlin stdlib: the demo proves the
// framework drives plain platform widgets, and the build stays small/fast.
