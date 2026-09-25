package com.morefunos.smm;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final String SMM_URL="https://mfk-smm.pantonyeung.workers.dev/";
    private WebView webView;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final SmmConnectionStore connectionStore=new SmmConnectionStore(this);

    @SuppressLint({"SetJavaScriptEnabled","JavascriptInterface"})
    @Override protected void onCreate(Bundle state){
        super.onCreate(state);
        webView=new WebView(this);
        final WebSettings settings=webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new NativeBridge(),"MfkSmmNative");
        setContentView(webView);
        webView.loadUrl(SMM_URL);
    }

    private final class NativeBridge{
        @JavascriptInterface public String connection(){
            return connectionStore.snapshot().toString();
        }
        @JavascriptInterface public void configure(String host,int port,String deviceId,String pairingToken){
            connectionStore.save(host,port,deviceId,pairingToken);
        }
        @JavascriptInterface public void send(String correlationId,String payload){
            io.execute(()->{
                final JSONObject result;
                try{result=sendToSmt(payload);}
                catch(Exception error){
                    result=new JSONObject();
                    try{result.put("ok",false).put("code","SMM_LAN_TRANSPORT_FAILED").put("message",error.getMessage());}
                    catch(Exception ignored){}
                }
                final String script="window.__MFK_SMM_NATIVE_RESULT__&&window.__MFK_SMM_NATIVE_RESULT__("
                    +JSONObject.quote(correlationId)+","+JSONObject.quote(result.toString())+")";
                runOnUiThread(()->webView.evaluateJavascript(script,null));
            });
        }
    }

    private JSONObject sendToSmt(String payload)throws Exception{
        final SmmConnectionStore.Config config=connectionStore.read();
        if(config.host.isEmpty()||config.deviceId.isEmpty())throw new IOException("SMM_CONNECTION_NOT_CONFIGURED");
        try(Socket socket=new Socket()){
            socket.connect(new InetSocketAddress(config.host,config.port),3000);
            socket.setSoTimeout(5000);
            try(BufferedWriter writer=new BufferedWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8));
                BufferedReader reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8))){
                final JSONObject request=new JSONObject(payload);
                final JSONObject envelope=new JSONObject()
                    .put("deviceId",config.deviceId)
                    .put("action","request")
                    .put("payload",request);
                writer.write(envelope.toString());writer.write("\n");writer.flush();
                final String response=reader.readLine();
                if(response==null)throw new IOException("SMM_LAN_EMPTY_RESPONSE");
                return new JSONObject(response);
            }
        }
    }

    @Override protected void onDestroy(){
        io.shutdownNow();
        if(webView!=null)webView.destroy();
        webView=null;
        super.onDestroy();
    }
}
