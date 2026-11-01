package org.timeledger.app;

import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.os.Build;
import org.json.*;
import java.util.*;

public class LedgerDb extends SQLiteOpenHelper {
    public LedgerDb(Context context){super(context,"ledger.sqlite",null,1);setWriteAheadLoggingEnabled(true);}
    @Override public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)");db.execSQL("CREATE TABLE devices(id TEXT PRIMARY KEY,name TEXT NOT NULL,platform TEXT NOT NULL,last_seen INTEGER)");db.execSQL("CREATE TABLE sessions(id TEXT PRIMARY KEY,device_id TEXT,app_id TEXT,app_name TEXT,start INTEGER,end INTEGER,source_seq INTEGER,seq INTEGER,updated_at INTEGER,deleted_at INTEGER)");db.execSQL("CREATE INDEX session_seq ON sessions(seq)");db.execSQL("CREATE INDEX session_time ON sessions(start,end)");}
    @Override public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){}
    public synchronized String get(String key,String fallback){try(Cursor c=getReadableDatabase().rawQuery("SELECT value FROM meta WHERE key=?",new String[]{key})){return c.moveToFirst()?c.getString(0):fallback;}}
    public synchronized JSONObject object(String key,JSONObject fallback){String value=get(key,null);if(value==null||value.equals("null"))return fallback;try{return new JSONObject(value);}catch(Exception e){return fallback;}}
    public synchronized void put(String key,Object value){ContentValues v=new ContentValues();v.put("key",key);v.put("value",String.valueOf(value));getWritableDatabase().insertWithOnConflict("meta",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    public synchronized long next(){long n=Long.parseLong(get("sequence","0"))+1;put("sequence",n);return n;}
    public synchronized JSONObject device() throws JSONException {JSONObject d=object("device",null);if(d==null){d=new JSONObject().put("id",UUID.randomUUID().toString()).put("name",Build.MANUFACTURER+" "+Build.MODEL).put("platform","android");put("device",d);}upsertDevice(d);return d;}
    public synchronized JSONObject settings() throws JSONException {JSONObject s=object("settings",null);if(s==null){s=new JSONObject().put("dayStart",4).put("timeZone","Asia/Hong_Kong").put("weekStart",1).put("revision","default").put("baseRevision",JSONObject.NULL);put("settings",s);}return s;}
    public synchronized void upsertDevice(JSONObject d) throws JSONException {ContentValues v=new ContentValues();v.put("id",d.getString("id"));v.put("name",d.getString("name"));v.put("platform",d.getString("platform"));v.put("last_seen",System.currentTimeMillis());getWritableDatabase().insertWithOnConflict("devices",null,v,SQLiteDatabase.CONFLICT_REPLACE);}
    public synchronized JSONArray devices() throws JSONException {JSONArray a=new JSONArray();String own=device().getString("id");try(Cursor c=getReadableDatabase().rawQuery("SELECT * FROM devices",null)){while(c.moveToNext())a.put(new JSONObject().put("id",c.getString(0)).put("name",c.getString(1)).put("platform",c.getString(2)).put("lastSeen",c.getLong(3)).put("local",c.getString(0).equals(own)));}return a;}
    private JSONObject row(Cursor c) throws JSONException{return new JSONObject().put("id",c.getString(0)).put("deviceId",c.getString(1)).put("appId",c.getString(2)).put("appName",c.getString(3)).put("start",c.getLong(4)).put("end",c.getLong(5)).put("sourceSeq",c.getLong(6)).put("seq",c.getLong(7)).put("updatedAt",c.getLong(8)).put("deletedAt",c.isNull(9)?JSONObject.NULL:c.getLong(9));}
    public synchronized JSONArray periodSessions(String device, String app, long start, long end) throws JSONException {
        JSONArray rows = new JSONArray();
        String query = "SELECT * FROM sessions WHERE device_id=? AND app_id=? AND deleted_at IS NULL AND start<? AND end>? ORDER BY start DESC";
        try (Cursor cursor = getReadableDatabase().rawQuery(query, new String[]{device, app, String.valueOf(end), String.valueOf(start)})) {
            while (cursor.moveToNext()) rows.put(row(cursor));
        }
        return rows;
    }
    public synchronized JSONArray sessions() throws JSONException {JSONArray a=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT * FROM sessions ORDER BY start DESC",null)){while(c.moveToNext())a.put(row(c));}return a;}
    public synchronized JSONObject find(String id) throws JSONException {try(Cursor c=getReadableDatabase().rawQuery("SELECT * FROM sessions WHERE id=?",new String[]{id})){return c.moveToFirst()?row(c):null;}}
    public synchronized void write(JSONObject s,boolean local) throws JSONException {
        long start=s.getLong("start"),end=s.getLong("end");if(start<0||end<start||end-start>32L*86400000||end>System.currentTimeMillis()+86400000L)throw new JSONException("Invalid session interval");
        if(s.getString("id").length()>100||s.getString("appId").length()>500||s.getString("appName").length()>200)throw new JSONException("Invalid session identity");
        JSONObject old=find(s.getString("id"));if(old!=null){if(!old.isNull("deletedAt"))return;if(!old.getString("deviceId").equals(s.getString("deviceId"))||!old.getString("appId").equals(s.getString("appId"))||old.getLong("start")!=start)throw new JSONException("Session origin changed");if(!local&&s.isNull("deletedAt")&&old.getLong("sourceSeq")>=s.getLong("sourceSeq"))return;}
        long seq=next();ContentValues v=new ContentValues();v.put("id",s.getString("id"));v.put("device_id",s.getString("deviceId"));v.put("app_id",s.getString("appId"));v.put("app_name",s.getString("appName"));v.put("start",start);v.put("end",end);v.put("source_seq",local?seq:s.getLong("sourceSeq"));v.put("seq",seq);v.put("updated_at",System.currentTimeMillis());if(s.isNull("deletedAt"))v.putNull("deleted_at");else v.put("deleted_at",s.getLong("deletedAt"));getWritableDatabase().insertWithOnConflict("sessions",null,v,SQLiteDatabase.CONFLICT_REPLACE);
    }
    public synchronized void delete(String id) throws JSONException {JSONObject s=find(id);if(s==null||!s.isNull("deletedAt"))return;ContentValues v=new ContentValues();v.put("deleted_at",System.currentTimeMillis());v.put("seq",next());v.put("updated_at",System.currentTimeMillis());getWritableDatabase().update("sessions",v,"id=?",new String[]{id});}
    public synchronized JSONArray changes(long after, String peerId) throws JSONException {JSONArray a=new JSONArray();try(Cursor c=getReadableDatabase().rawQuery("SELECT * FROM sessions WHERE seq>? AND (device_id=? OR (device_id=? AND deleted_at IS NOT NULL)) ORDER BY seq LIMIT 1000",new String[]{String.valueOf(after),device().getString("id"),peerId})){while(c.moveToNext())a.put(row(c));}return a;}
    public synchronized void receive(JSONObject result) throws JSONException {
        JSONObject other=result.getJSONObject("device");if(!other.getString("platform").equals("windows"))throw new JSONException("Unknown platform");upsertDevice(other);JSONArray changes=result.getJSONArray("changes");if(changes.length()>1000)throw new JSONException("Batch too large");
        SQLiteDatabase db=getWritableDatabase();db.beginTransaction();try{for(int i=0;i<changes.length();i++){JSONObject s=changes.getJSONObject(i);if(!s.getString("deviceId").equals(other.getString("id"))){JSONObject old=find(s.getString("id"));if(s.isNull("deletedAt")||old==null||!old.getString("deviceId").equals(s.getString("deviceId")))throw new JSONException("Session source mismatch");delete(s.getString("id"));}else write(s,false);}put("pullCursor",result.getLong("cursor"));if(result.optLong("ack")>0)put("pushCursor",result.getLong("ack"));db.setTransactionSuccessful();}finally{db.endTransaction();}
        JSONObject remote=result.getJSONObject("settings"),local=settings();if(remote.getInt("dayStart")<0||remote.getInt("dayStart")>23||!Arrays.asList(TimeZone.getAvailableIDs()).contains(remote.getString("timeZone")))throw new JSONException("Invalid settings");if(local.getInt("dayStart")==remote.getInt("dayStart")&&local.getString("timeZone").equals(remote.getString("timeZone"))){put("settingsConflict","null");return;}if(remote.getString("revision").equals(local.optString("baseRevision")))return;if(local.getString("revision").equals("default")||remote.optString("baseRevision").equals(local.getString("revision"))){put("settings",remote);put("settingsConflict","null");}else if(!remote.getString("revision").equals("default"))put("settingsConflict",remote);
    }
}
