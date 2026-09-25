package com.morefunos.smm;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

public final class SmmConnectionStore{
    private static final String PREFS="mfk.smm.connection.v1";
    public static final class Config{
        public final String host,deviceId,pairingToken;public final int port;
        Config(String host,int port,String deviceId,String pairingToken){this.host=host;this.port=port;this.deviceId=deviceId;this.pairingToken=pairingToken;}
    }
    private final SharedPreferences preferences;
    public SmmConnectionStore(Context context){preferences=context.getApplicationContext().getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    public synchronized void save(String host,int port,String deviceId,String token){
        preferences.edit().putString("host",safe(host)).putInt("port",port>0&&port<=65535?port:17831).putString("deviceId",safe(deviceId)).putString("pairingToken",safe(token)).commit();
    }
    public synchronized Config read(){return new Config(preferences.getString("host",""),preferences.getInt("port",17831),preferences.getString("deviceId",""),preferences.getString("pairingToken",""));}
    public synchronized JSONObject snapshot(){
        final Config c=read();final JSONObject o=new JSONObject();
        try{o.put("host",c.host).put("port",c.port).put("deviceId",c.deviceId).put("configured",!c.host.isEmpty()&&!c.deviceId.isEmpty());}catch(JSONException ignored){}
        return o;
    }
    private static String safe(String value){return value==null?"":value.trim();}
}
