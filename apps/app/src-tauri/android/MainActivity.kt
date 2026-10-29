// Sustituye al MainActivity.kt que genera `tauri android init` (lo copia
// GitHub Actions; ver .github/workflows/build.yml y CLAUDE.md).
//
// La app se dibuja de borde a borde (edge-to-edge, obligatorio desde
// Android 15): también por detrás de la barra de estado y de la de
// navegación. El WebView no siempre informa de esas barras en
// env(safe-area-inset-*), así que se las pasamos a la web nosotros:
// `window.FarmHabitInsets.get()` devuelve sus medidas en px CSS y, cuando
// cambian (giro, teclado), se avisa con el evento `farmhabit:insets`.
// src/lib/insets.ts las convierte en variables CSS.

package io.github.adelledgar.farmhabit

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import org.json.JSONObject

class MainActivity : TauriActivity() {
  @Volatile private var insetsJson = "{}"

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(
      object {
        @JavascriptInterface fun get(): String = insetsJson
      },
      "FarmHabitInsets",
    )
    ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
      )
      // Con el teclado abierto, el hueco de abajo es el del teclado.
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      val density = resources.displayMetrics.density.toDouble()
      insetsJson = JSONObject()
        .put("top", bars.top / density)
        .put("right", bars.right / density)
        .put("bottom", maxOf(bars.bottom, ime.bottom) / density)
        .put("left", bars.left / density)
        .toString()
      view.post {
        (view as WebView).evaluateJavascript(
          "window.dispatchEvent(new Event('farmhabit:insets'))",
          null,
        )
      }
      ViewCompat.onApplyWindowInsets(view, insets)
    }
  }
}
