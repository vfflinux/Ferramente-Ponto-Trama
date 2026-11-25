package com.pontoetrama.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Ponto & Trama — Aplicativo Android Nativo (100% offline).
 * Serve os arquivos embutidos de `assets/frontend/` em 127.0.0.1 para garantir
 * persistência estável de IndexedDB e localStorage sem depender de internet.
 */
public class MainActivity extends Activity {

    private static final int REQ_FILE_CHOOSER = 1001;
    private static final int PORTA_PREFERENCIAL = 18421;

    private WebView webView;
    private LocalAssetServer assetServer;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Cores nativas da barra de status e navegação combinando com o tema Ponto & Trama
        getWindow().setStatusBarColor(Color.parseColor("#010736"));
        getWindow().setNavigationBarColor(Color.parseColor("#010736"));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0d1c42"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && ("127.0.0.1".equals(uri.getHost()) || "localhost".equals(uri.getHost()))) {
                    return false;
                }
                // Links externos (ex: link de referência no Banco de Amostras) abrem no navegador do celular
                if (uri != null && ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }
        });

        // Suporte nativo a upload de fotos (fios, agulhas, amostras) e backup JSON
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

        assetServer = new LocalAssetServer(getAssets(), PORTA_PREFERENCIAL);
        int porta = assetServer.iniciar();

        if (porta > 0) {
            webView.loadUrl("http://127.0.0.1:" + porta + "/index.html");
        } else {
            webView.loadUrl("file:///android_asset/frontend/index.html");
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
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        // Primeiro tenta fechar modais/drawers abertos via ESC ou voltar para Home
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){" +
                "  var abertos = document.querySelectorAll('.drawer-overlay-bib.aberto, .modal-overlay-fio[style*=\"flex\"], .modal-overlay-bib[style*=\"flex\"], .modal-overlay-amostra[style*=\"flex\"], .modal-overlay-banco[style*=\"flex\"]');" +
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
        if (assetServer != null) {
            assetServer.parar();
        }
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }

    /**
     * Mini servidor HTTP loopback local (127.0.0.1) que serve `assets/frontend/`
     * em porta fixa para manter o IndexedDB/localStorage persistente no Android.
     */
    private static class LocalAssetServer {
        private final AssetManager assets;
        private final int portaPreferencial;
        private ServerSocket serverSocket;
        private ExecutorService pool;
        private volatile boolean rodando = false;

        LocalAssetServer(AssetManager assets, int portaPreferencial) {
            this.assets = assets;
            this.portaPreferencial = portaPreferencial;
        }

        int iniciar() {
            InetAddress loopback = InetAddress.getLoopbackAddress();
            for (int p = portaPreferencial; p < portaPreferencial + 10; p++) {
                try {
                    serverSocket = new ServerSocket(p, 16, loopback);
                    break;
                } catch (IOException ignored) {
                }
            }
            if (serverSocket == null) {
                try {
                    serverSocket = new ServerSocket(0, 16, loopback);
                } catch (IOException e) {
                    return -1;
                }
            }

            rodando = true;
            pool = Executors.newFixedThreadPool(4);
            Thread acceptThread = new Thread(() -> {
                while (rodando) {
                    try {
                        Socket client = serverSocket.accept();
                        pool.execute(() -> atenderCliente(client));
                    } catch (IOException e) {
                        if (!rodando) break;
                    }
                }
            }, "PontoETrama-LocalAssets");
            acceptThread.setDaemon(true);
            acceptThread.start();
            return serverSocket.getLocalPort();
        }

        void parar() {
            rodando = false;
            if (serverSocket != null) {
                try {
                    serverSocket.close();
                } catch (IOException ignored) {
                }
            }
            if (pool != null) {
                pool.shutdownNow();
            }
        }

        private void atenderCliente(Socket socket) {
            try (Socket s = socket;
                 BufferedReader in = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
                 OutputStream out = s.getOutputStream()) {

                String reqLine = in.readLine();
                if (reqLine == null || reqLine.isEmpty()) return;

                String[] partes = reqLine.split(" ");
                if (partes.length < 2) return;

                String rawPath = partes[1];
                int qIdx = rawPath.indexOf('?');
                if (qIdx >= 0) rawPath = rawPath.substring(0, qIdx);

                String rel = URLDecoder.decode(rawPath, "UTF-8");
                while (rel.startsWith("/")) rel = rel.substring(1);
                if (rel.isEmpty()) rel = "index.html";
                if (rel.contains("..")) {
                    enviarErro(out, 403, "Forbidden");
                    return;
                }

                byte[] conteudo = lerAsset("frontend/" + rel);
                if (conteudo == null) {
                    enviarErro(out, 404, "Not Found");
                    return;
                }

                String mime = detectarMime(rel);
                String headers =
                    "HTTP/1.1 200 OK\r\n" +
                    "Content-Type: " + mime + "\r\n" +
                    "Content-Length: " + conteudo.length + "\r\n" +
                    "Cache-Control: no-cache\r\n" +
                    "Connection: close\r\n\r\n";

                out.write(headers.getBytes(StandardCharsets.UTF_8));
                out.write(conteudo);
                out.flush();
            } catch (Exception ignored) {
            }
        }

        private byte[] lerAsset(String caminho) {
            try (InputStream is = assets.open(caminho);
                 ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];
                int n;
                while ((n = is.read(chunk)) != -1) {
                    buf.write(chunk, 0, n);
                }
                return buf.toByteArray();
            } catch (IOException e) {
                return null;
            }
        }

        private void enviarErro(OutputStream out, int code, String msg) throws IOException {
            byte[] body = msg.getBytes(StandardCharsets.UTF_8);
            String headers =
                "HTTP/1.1 " + code + " " + msg + "\r\n" +
                "Content-Type: text/plain; charset=utf-8\r\n" +
                "Content-Length: " + body.length + "\r\n" +
                "Connection: close\r\n\r\n";
            out.write(headers.getBytes(StandardCharsets.UTF_8));
            out.write(body);
            out.flush();
        }

        private String detectarMime(String path) {
            String p = path.toLowerCase();
            if (p.endsWith(".html")) return "text/html; charset=utf-8";
            if (p.endsWith(".css")) return "text/css; charset=utf-8";
            if (p.endsWith(".js")) return "application/javascript; charset=utf-8";
            if (p.endsWith(".json")) return "application/json; charset=utf-8";
            if (p.endsWith(".png")) return "image/png";
            if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
            if (p.endsWith(".webp")) return "image/webp";
            if (p.endsWith(".svg")) return "image/svg+xml";
            return "application/octet-stream";
        }
    }
}
