package com.morefunos.smt.smm;

import androidx.annotation.NonNull;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/**
 * Narrow HTTP/JSON host for SMM PWA on the store LAN.
 * Transport/trust only: Order/Pricing authority remains in the active MFK runtime.
 */
public final class SmmLanHost implements Closeable {
    public interface Handler { @NonNull String handle(@NonNull String deviceId,@NonNull String json); }
    public static final int DEFAULT_PORT=17831;
    private static final int MAX_BODY=262144;
    private final SmmTrustedDeviceStore trustedDevices;
    private final Handler handler;
    private final ExecutorService executor=Executors.newCachedThreadPool();
    private volatile ServerSocket server; private volatile boolean running;

    public SmmLanHost(@NonNull SmmTrustedDeviceStore trustedDevices,@NonNull Handler handler){this.trustedDevices=trustedDevices;this.handler=handler;}

    public synchronized void start()throws IOException{
        if(running)return;
        server=new ServerSocket(DEFAULT_PORT,16,InetAddress.getByName("0.0.0.0"));
        server.setReuseAddress(true);running=true;executor.execute(this::acceptLoop);
    }
    private void acceptLoop(){while(running){try{Socket s=server.accept();executor.execute(()->serve(s));}catch(IOException e){if(running)running=false;}}}

    private void serve(Socket socket){
        try(Socket client=socket){
            client.setSoTimeout(5000);
            final InputStream input=client.getInputStream();
            final OutputStream output=client.getOutputStream();
            final BufferedReader reader=new BufferedReader(new InputStreamReader(input,StandardCharsets.UTF_8));
            final String requestLine=reader.readLine();
            if(requestLine==null)return;
            final String[] parts=requestLine.split(" ");
            if(parts.length<2){write(output,400,json(false,"SMM_HTTP_BAD_REQUEST").toString());return;}
            final String method=parts[0],path=parts[1];
            int length=0;String line;
            while((line=reader.readLine())!=null&&!line.isEmpty()){
                final int colon=line.indexOf(':');if(colon<1)continue;
                final String name=line.substring(0,colon).trim();
                if("Content-Length".equalsIgnoreCase(name))length=Integer.parseInt(line.substring(colon+1).trim());
            }
            if("OPTIONS".equals(method)){write(output,204,"");return;}
            if("GET".equals(method)&&"/smm/v1/health".equals(path)){write(output,200,json(true,"SMM_LAN_HOST_READY").toString());return;}
            if(!"POST".equals(method)||!"/smm/v1/request".equals(path)){write(output,404,json(false,"SMM_HTTP_NOT_FOUND").toString());return;}
            if(length<1||length>MAX_BODY){write(output,413,json(false,"SMM_HTTP_BODY_INVALID").toString());return;}
            final char[] chars=new char[length];int offset=0;
            while(offset<length){int n=reader.read(chars,offset,length-offset);if(n<0)break;offset+=n;}
            final JSONObject envelope=new JSONObject(new String(chars,0,offset));
            final String deviceId=envelope.optString("deviceId","").trim();
            final String action=envelope.optString("action","").trim();
            final String response;
            if("pair".equals(action)){
                final boolean paired=trustedDevices.pair(deviceId,envelope.optString("pairingToken",""));
                response=json(paired,paired?"SMM_DEVICE_PAIRED":"SMM_PAIRING_REJECTED").toString();
            }else if(!trustedDevices.trusted(deviceId)){
                response=json(false,"SMM_DEVICE_NOT_TRUSTED").toString();
            }else{
                final Object payload=envelope.opt("payload");
                response=payload instanceof JSONObject?handler.handle(deviceId,payload.toString()):json(false,"SMM_PAYLOAD_REQUIRED").toString();
            }
            write(output,200,response);
        }catch(Exception ignored){}
    }

    private static void write(OutputStream output,int status,String body)throws IOException{
        final byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
        final String reason=status==200?"OK":status==204?"No Content":status==404?"Not Found":status==413?"Payload Too Large":"Bad Request";
        final String headers="HTTP/1.1 "+status+" "+reason+"\r\n"+
            "Content-Type: application/json; charset=utf-8\r\n"+
            "Content-Length: "+bytes.length+"\r\n"+
            "Access-Control-Allow-Origin: *\r\n"+
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"+
            "Access-Control-Allow-Headers: Content-Type\r\n"+
            "Access-Control-Allow-Private-Network: true\r\n"+
            "Cache-Control: no-store\r\nConnection: close\r\n\r\n";
        output.write(headers.getBytes(StandardCharsets.US_ASCII));output.write(bytes);output.flush();
    }
    private static JSONObject json(boolean ok,String code)throws JSONException{return new JSONObject().put("ok",ok).put("code",code).put("protocolVersion",1);}
    @Override public synchronized void close(){running=false;if(server!=null){try{server.close();}catch(IOException ignored){}server=null;}executor.shutdownNow();}
}
