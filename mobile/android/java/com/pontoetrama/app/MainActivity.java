package com.pontoetrama.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Ponto & Trama — Aplicativo Android 100% Local e Offline.
 *
 * - ZERO permissão de internet (INTERNET não existe no AndroidManifest).
 * - ZERO servidor HTTP externo ou socket TCP.
 * - ZERO abertura de navegador / páginas web externas.
 * - Todos os arquivos do app são lidos diretamente dos assets internos do APK
 *   em memória via WebViewClient.shouldInterceptRequest no domínio virtual
 *   local `appassets.androidplatform.net` (padrão oficial Android).
 * - Persistência local permanente via IndexedDB + localStorage no armazenamento
 *   privado do celular, além de exportação nativa de backup via SAF.
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int REQ_SAVE_FILE = 1002;
    private static final String HOST_LOCAL = "appassets.androidplatform.net";
    private static final String URL_INICIAL = "https://" + HOST_LOCAL + "/index.html";

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String conteudoPendenteSalvar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.parseColor("#010736"));
        getWindow().setNavigationBarColor(Color.parseColor("#010736"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0d1c42"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.addJavascriptInterface(new PonteAndroidNativa(), "PontoETramaAndroid");

        final AssetManager assets = getAssets();

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null || !HOST_LOCAL.equalsIgnoreCase(uri.getHost())) {
                    // Bloqueia qualquer acesso externo — o app roda 100% local no celular
                    return respostaVazia(403, "Offline");
                }

                String rawPath = uri.getPath();
                if (rawPath == null || rawPath.isEmpty() || "/".equals(rawPath)) {
                    rawPath = "/index.html";
                }
                String rel;
                try {
                    rel = URLDecoder.decode(rawPath, "UTF-8");
                } catch (Exception e) {
                    rel = rawPath;
                }
                while (rel.startsWith("/")) {
                    rel = rel.substring(1);
                }
                if (rel.isEmpty()) {
                    rel = "index.html";
                }
                if (rel.contains("..")) {
                    return respostaVazia(403, "Forbidden");
                }

                try {
                    InputStream is = assets.open("frontend/" + rel);
                    String mime = detectarMime(rel);
                    String encoding = isTexto(mime) ? "UTF-8" : null;
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-cache");
                    return new WebResourceResponse(mime, encoding, 200, "OK", headers, is);
                } catch (IOException e) {
                    return respostaVazia(404, "Not Found");
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                // Permite navegação somente nos assets internos; nunca abre navegador/página web
                if (uri != null && HOST_LOCAL.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                return true;
            }
        });

        // Suporte nativo a galeria/câmera (fotos de projetos, fios, agulhas, amostras) e importar backup JSON
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                try {
                    Intent intent = params.createIntent();
                    startActivityForResult(intent, REQ_FILE_CHOOSER);
                    return true;
                } catch (Exception e) {
                    filePathCallback = null;
                    return false;
                }
            }
        });

        webView.loadUrl(URL_INICIAL);
    }

    private class PonteAndroidNativa {
        @JavascriptInterface
        public boolean isNativo() {
            return true;
        }

        @JavascriptInterface
        public void atualizarTema(final String corHex) {
            runOnUiThread(() -> {
                try {
                    int cor = Color.parseColor(corHex);
                    getWindow().setStatusBarColor(cor);
                    getWindow().setNavigationBarColor(cor);
                } catch (Exception ignored) {
                }
            });
        }

        @JavascriptInterface
        public void manterTelaAcesa(final boolean ativo) {
            runOnUiThread(() -> {
                if (ativo) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            });
        }

        @JavascriptInterface
        public void salvarArquivo(final String nomeArquivo, final String conteudo) {
            conteudoPendenteSalvar = conteudo;
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, nomeArquivo != null ? nomeArquivo : "ponto-e-trama-backup.json");
                    startActivityForResult(intent, REQ_SAVE_FILE);
                } catch (Exception e) {
                    conteudoPendenteSalvar = null;
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o seletor de arquivos.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE_CHOOSER) {
            if (filePathCallback != null) {
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            }
            return;
        }
        if (requestCode == REQ_SAVE_FILE) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && conteudoPendenteSalvar != null) {
                try (OutputStream os = getContentResolver().openOutputStream(data.getData())) {
                    if (os != null) {
                        os.write(conteudoPendenteSalvar.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                        Toast.makeText(this, "Backup salvo no celular!", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "Erro ao salvar arquivo.", Toast.LENGTH_SHORT).show();
                }
            }
            conteudoPendenteSalvar = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){" +
                "  var chk = document.getElementById('opcao-menu');" +
                "  if (window.innerWidth <= 768 && chk && !chk.checked) { chk.checked = true; return 'menu'; }" +
                "  var abertos = document.querySelectorAll('.overlay-pasta-aberta.aberto, .drawer-overlay-proj.aberto, .drawer-overlay-bib.aberto, .drawer-overlay-estoque.aberto, .modal-overlay-cfg[style*=\"flex\"], .modal-overlay-proj[style*=\"flex\"], .modal-overlay-fio[style*=\"flex\"], .modal-overlay-bib[style*=\"flex\"], .modal-overlay-amostra[style*=\"flex\"], .modal-overlay-banco[style*=\"flex\"]');" +
                "  if (abertos.length > 0) { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); return 'closed'; }" +
                "  var home = document.getElementById('secao-home');" +
                "  if (home && home.style.display === 'none') {" +
                "    var btnHome = document.querySelector('.barraLateral .botaoFerramenta[data-ferramenta=\"home\"]');" +
                "    if (btnHome) { btnHome.click(); return 'home'; }" +
                "  }" +
                "  return 'exit';" +
                "})()",
                value -> {
                    if (value == null || value.contains("exit")) {
                        runOnUiThread(MainActivity.super::onBackPressed);
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    private static WebResourceResponse respostaVazia(int status, String reason) {
        return new WebResourceResponse(
            "text/plain",
            "UTF-8",
            status,
            reason,
            null,
            new ByteArrayInputStream(new byte[0])
        );
    }

    private static boolean isTexto(String mime) {
        return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
    }

    private static String detectarMime(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        return "application/octet-stream";
    }
}
