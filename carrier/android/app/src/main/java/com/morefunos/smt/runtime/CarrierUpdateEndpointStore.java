package com.morefunos.smt.runtime;

import android.content.Context;
import android.content.SharedPreferences;

import com.morefunos.smt.BuildConfig;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;

public final class CarrierUpdateEndpointStore {
    private static final String PREFS_NAME="mfk_carrier_update_endpoint";
    private static final String KEY_ACTIVE="active_endpoint";
    private static final String KEY_PREVIOUS="previous_endpoint";
    private final SharedPreferences preferences;
    private final String builtInDefault;

    public static final class EndpointInfo{
        public final String activeEndpoint;
        public final String builtInDefaultEndpoint;
        public final String previousEndpoint;
        EndpointInfo(String active,String builtIn,String previous){activeEndpoint=active;builtInDefaultEndpoint=builtIn;previousEndpoint=previous;}
    }

    public CarrierUpdateEndpointStore(Context context){
        preferences=context.getApplicationContext().getSharedPreferences(PREFS_NAME,Context.MODE_PRIVATE);
        builtInDefault=BuildConfig.CARRIER_UPDATE_MANIFEST_URL;
    }

    public String validateCandidate(String raw)throws IOException{
        final String value=raw==null?"":raw.trim();
        if(value.isEmpty())throw new IOException("CARRIER_UPDATE_ENDPOINT_NOT_CONFIGURED");
        try{
            final URI uri=new URI(value);
            if(!"https".equalsIgnoreCase(uri.getScheme())||uri.getHost()==null||uri.getHost().trim().isEmpty()||uri.getUserInfo()!=null||uri.getFragment()!=null)
                throw new IOException("CARRIER_UPDATE_ENDPOINT_INVALID");
            return uri.toString();
        }catch(URISyntaxException error){throw new IOException("CARRIER_UPDATE_ENDPOINT_INVALID",error);}
    }

    public synchronized String effectiveEndpoint()throws IOException{
        final String active=preferences.getString(KEY_ACTIVE,null);
        return active==null||active.trim().isEmpty()?builtInDefaultEndpoint():validateCandidate(active);
    }
    public String builtInDefaultEndpoint()throws IOException{return validateCandidate(builtInDefault);}
    public synchronized String previousEndpoint()throws IOException{
        final String previous=preferences.getString(KEY_PREVIOUS,null);
        return previous==null||previous.trim().isEmpty()?null:validateCandidate(previous);
    }
    public synchronized EndpointInfo endpointInfo()throws IOException{return new EndpointInfo(effectiveEndpoint(),builtInDefaultEndpoint(),previousEndpoint());}

    public synchronized String applyValidatedCandidate(String raw)throws IOException{
        final String candidate=validateCandidate(raw);
        final String current=effectiveEndpoint();
        if(candidate.equals(current))return current;
        final SharedPreferences.Editor editor=preferences.edit().putString(KEY_PREVIOUS,current);
        if(candidate.equals(builtInDefaultEndpoint()))editor.remove(KEY_ACTIVE);else editor.putString(KEY_ACTIVE,candidate);
        if(!editor.commit())throw new IOException("CARRIER_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }
    public synchronized String restorePrevious()throws IOException{
        final String previous=previousEndpoint();
        if(previous==null)throw new IOException("CARRIER_UPDATE_PREVIOUS_ENDPOINT_NOT_AVAILABLE");
        final String current=effectiveEndpoint();
        final SharedPreferences.Editor editor=preferences.edit().putString(KEY_PREVIOUS,current);
        if(previous.equals(builtInDefaultEndpoint()))editor.remove(KEY_ACTIVE);else editor.putString(KEY_ACTIVE,previous);
        if(!editor.commit())throw new IOException("CARRIER_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }
    public synchronized String restoreDefault()throws IOException{
        final String current=effectiveEndpoint(),target=builtInDefaultEndpoint();
        if(target.equals(current))return current;
        if(!preferences.edit().putString(KEY_PREVIOUS,current).remove(KEY_ACTIVE).commit())throw new IOException("CARRIER_UPDATE_ENDPOINT_PERSIST_FAILED");
        return effectiveEndpoint();
    }
}
