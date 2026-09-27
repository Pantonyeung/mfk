plugins {
    id("com.android.application")
}

val roomVersion = "2.8.5"

val runtimeUpdateManifestUrl = providers.gradleProperty("morefunRuntimeUpdateManifestUrl")
    .orElse("https://morefunos-v2-smt-ota.pantonyeung.workers.dev/runtime-update.json")
    .get()
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

val carrierUpdateManifestUrl = providers.gradleProperty("morefunCarrierUpdateManifestUrl")
    .orElse("https://morefunos-v2-smt-ota.pantonyeung.workers.dev/carrier-update.json")
    .get()
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

val lanPrinterEndpointsJson = providers.gradleProperty("morefunLanPrinterEndpoints")
    .orElse("[]")
    .get()
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")

android {
    namespace = "com.morefunos.smt"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.morefunos.smt"
        minSdk = 24
        targetSdk = 30
        versionCode = 107
        versionName = "1.0.7"
        buildConfigField("String", "RUNTIME_UPDATE_MANIFEST_URL", "\"$runtimeUpdateManifestUrl\"")
        buildConfigField("String", "CARRIER_UPDATE_MANIFEST_URL", "\"$carrierUpdateManifestUrl\"")
        buildConfigField("String", "LAN_PRINTER_ENDPOINTS_JSON", "\"$lanPrinterEndpointsJson\"")
        javaCompileOptions {
            annotationProcessorOptions {
                arguments += mapOf(
                    "room.incremental" to "true",
                    "room.schemaLocation" to "$projectDir/schemas",
                )
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures { buildConfig = true }
    sourceSets["main"].assets.srcDir(file("../../../v2local/dist"))

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                it.jvmArgs(
                    "--add-opens=java.base/java.lang=ALL-UNNAMED",
                    "--add-opens=java.base/java.util=ALL-UNNAMED",
                    "--add-opens=java.base/java.io=ALL-UNNAMED",
                    "--add-opens=java.base/java.net=ALL-UNNAMED",
                    "--add-opens=java.base/java.security=ALL-UNNAMED",
                    "--add-opens=java.base/java.text=ALL-UNNAMED",
                    "--add-opens=java.base/jdk.internal.access=ALL-UNNAMED",
                    "--add-opens=java.desktop/java.awt.font=ALL-UNNAMED",
                    "--add-opens=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED",
                )
            }
        }
    }

    lint {
        abortOnError = true
        warningsAsErrors = true
        disable += "OldTargetApi"
        disable += "ExpiredTargetSdkVersion"
        disable += "GradleDependency"
        // Recovery crash/boot evidence intentionally uses synchronous commit() so data survives process termination.
        disable += "ApplySharedPref"
    }
}

val verifySmtWebBundle by tasks.registering {
    doLast {
        val index = file("../../../v2local/dist/index.html")
        check(index.isFile) { "MFK SMT runtime missing. Build v2local before assembling the Android carrier." }
    }
}

tasks.named("preBuild").configure { dependsOn(verifySmtWebBundle) }

dependencies {
    implementation("androidx.webkit:webkit:1.16.0")
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("com.sunmi:printerlibrary:1.0.18")
    annotationProcessor("androidx.room:room-compiler:$roomVersion")
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.room:room-testing:$roomVersion")
    testImplementation("org.robolectric:robolectric:4.16")
}
