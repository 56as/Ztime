package org.timeledger.app;

import android.app.*;
import android.app.usage.*;
import android.content.Context;
import android.os.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

public class UsageCollector {
    public static boolean granted(Context context){AppOpsManager appOps=(AppOpsManager)context.getSystemService(Context.APP_OPS_SERVICE);return appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),context.getPackageName())==AppOpsManager.MODE_ALLOWED;}
    private static String label(Context c,String pkg){try{return c.getPackageManager().getApplicationLabel(c.getPackageManager().getApplicationInfo(pkg,0)).toString();}catch(Exception e){return pkg;}}
    public static synchronized void collect(Context context,LedgerDb db) throws Exception {
        long now=System.currentTimeMillis();
        if(!granted(context)){db.put("collector",new JSONObject().put("state","permission"));return;}
        if(Boolean.parseBoolean(db.get("paused","false"))){db.put("captureCursor",now);db.put("captureState",new JSONObject());db.put("collector",new JSONObject().put("state","paused"));return;}
        long cursor=Long.parseLong(db.get("captureCursor",String.valueOf(now-2L*86400000)));
        if(cursor>now||now-cursor>3L*86400000){cursor=Math.max(now-3L*86400000,0);db.put("captureState",new JSONObject());db.put("captureGap",true);}
        JSONObject state=db.object("captureState",new JSONObject());boolean screen=state.optBoolean("screen"),unlocked=state.optBoolean("unlocked");String pkg=state.optString("pkg","");long start=state.optLong("start",cursor);
        UsageStatsManager usage=(UsageStatsManager)context.getSystemService(Context.USAGE_STATS_SERVICE);UsageEvents events=usage.queryEvents(cursor,now);if(events==null)return;UsageEvents.Event event=new UsageEvents.Event();String own=db.device().getString("id");
        while(events.hasNextEvent()){
            events.getNextEvent(event);long t=event.getTimeStamp();int type=event.getEventType();
            if(!pkg.isEmpty()&&screen&&unlocked)save(context,db,own,pkg,start,t);
            boolean wasEligible=screen&&unlocked&&!pkg.isEmpty();String old=pkg;
            if(type==UsageEvents.Event.SCREEN_INTERACTIVE)screen=true;
            if(type==UsageEvents.Event.SCREEN_NON_INTERACTIVE){screen=false;unlocked=false;}
            if(type==UsageEvents.Event.KEYGUARD_SHOWN)unlocked=false;
            if(type==UsageEvents.Event.KEYGUARD_HIDDEN)unlocked=true;
            if(type==UsageEvents.Event.ACTIVITY_RESUMED){pkg=event.getPackageName()==null?"":event.getPackageName();}
            if(type==UsageEvents.Event.ACTIVITY_PAUSED&&pkg.equals(event.getPackageName()))pkg="";
            if(type==UsageEvents.Event.DEVICE_SHUTDOWN){screen=false;unlocked=false;pkg="";}
            if(!wasEligible||!old.equals(pkg)||!screen||!unlocked)start=t;
        }
        if(!pkg.isEmpty()&&screen&&unlocked)save(context,db,own,pkg,start,now);
        boolean actualScreen=((PowerManager)context.getSystemService(Context.POWER_SERVICE)).isInteractive();boolean actualUnlocked=!((KeyguardManager)context.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked();
        if((screen!=actualScreen||unlocked!=actualUnlocked)&&actualScreen&&actualUnlocked)start=now;
        state=new JSONObject().put("screen",actualScreen).put("unlocked",actualUnlocked).put("pkg",pkg).put("start",start);
        db.put("captureState",state);db.put("captureCursor",now);db.put("collector",new JSONObject().put("state","ready").put("lastSample",now));
    }
    private static void save(Context context,LedgerDb db,String own,String pkg,long start,long end) throws Exception {if(end<=start)return;String id=UUID.nameUUIDFromBytes((own+":"+pkg+":"+start).getBytes(StandardCharsets.UTF_8)).toString();db.write(new JSONObject().put("id",id).put("deviceId",own).put("appId",pkg).put("appName",label(context,pkg)).put("start",start).put("end",end).put("deletedAt",JSONObject.NULL),true);}
}
