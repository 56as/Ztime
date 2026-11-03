package org.timeledger.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import androidx.webkit.WebViewAssetLoader;
import com.google.zxing.integration.android.*;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView web;private LedgerDb db;private final ScheduledExecutorService tasks=Executors.newScheduledThreadPool(3);private ScheduledFuture<?> foreground,desktopRequests;private String exportContent;
    @Override public void onCreate(Bundle saved){super.onCreate(saved);db=new LedgerDb(this);web=new WebView(this);android.widget.FrameLayout frame=new android.widget.FrameLayout(this);frame.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));frame.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});setContentView(frame);web.getSettings().setJavaScriptEnabled(true);web.getSettings().setDomStorageEnabled(true);web.getSettings().setAllowFileAccess(false);web.getSettings().setAllowContentAccess(false);web.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);web.addJavascriptInterface(new Bridge(),"TimeLedgerNative");
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onJsAlert(WebView v,String url,String message,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->r.confirm()).setOnCancelListener(d->r.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String url,String message,JsResult r){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->r.confirm()).setNegativeButton("取消",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).show();return true;}
            @Override public boolean onJsPrompt(WebView v,String url,String message,String value,JsPromptResult r){android.widget.EditText input=new android.widget.EditText(MainActivity.this);input.setText(value);new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(input).setPositiveButton("确定",(d,w)->r.confirm(input.getText().toString())).setNegativeButton("取消",(d,w)->r.cancel()).setOnCancelListener(d->r.cancel()).show();return true;}
        });
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient(){@Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){WebResourceResponse result=loader.shouldInterceptRequest(r.getUrl());return result!=null?result:new WebResourceResponse("text/plain","UTF-8",403,"Blocked",Collections.emptyMap(),new java.io.ByteArrayInputStream(new byte[0]));}@Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !r.getUrl().toString().startsWith("https://appassets.androidplatform.net/assets/web/");}});
        web.loadUrl("https://appassets.androidplatform.net/assets/web/index.html");SyncWorker.schedule(this);
    }
    @Override protected void onResume(){super.onResume();
        desktopRequests=tasks.scheduleWithFixedDelay(()->{
            try{SyncClient.waitForDesktop(this,db);}catch(Exception ignored){/* Regular sync handles reconnection and discovery. */}
        },0,2,TimeUnit.SECONDS);
        foreground=tasks.scheduleWithFixedDelay(()->{try{UsageCollector.collect(this,db);if(db.object("peer",null)!=null)SyncClient.sync(db);}catch(Exception e){db.put("syncError",e.getMessage()==null?"等待连接":e.getMessage());}},0,30,TimeUnit.SECONDS);}
    @Override protected void onPause(){if(desktopRequests!=null)desktopRequests.cancel(true);if(foreground!=null)foreground.cancel(false);super.onPause();}
    @Override protected void onDestroy(){tasks.shutdownNow();web.removeJavascriptInterface("TimeLedgerNative");web.destroy();super.onDestroy();}
    @Override public void onBackPressed(){web.evaluateJavascript("window.ledgerBack ? window.ledgerBack() : false",result->{if(!"true".equals(result))moveTaskToBack(true);});}
    public class Bridge {
        @JavascriptInterface public void request(String payload){tasks.execute(()->{long id=0;JSONObject answer=new JSONObject();try{JSONObject request=new JSONObject(payload);id=request.getLong("id");Object data=route(request.getString("method"),request.getString("path"),request.optJSONObject("body"));answer.put("ok",true).put("data",data==null?JSONObject.NULL:data);}catch(Exception e){try{answer.put("ok",false).put("error",e.getMessage()==null?"操作失败":e.getMessage());}catch(Exception ignored){}}final long requestId=id;final String json=answer.toString();runOnUiThread(()->web.evaluateJavascript("window.ledgerReceive("+requestId+","+json+")",null));});}
    }
    private Object route(String method,String path,JSONObject body)throws Exception {
        if(body==null)body=new JSONObject();Uri u=Uri.parse(path);String p=u.getPath();
        if(method.equals("GET")&&p.equals("/api/summary")){
            try{UsageCollector.collect(this,db);}catch(Exception e){db.put("collector",new JSONObject().put("state","error"));}
            JSONObject result=new JSONObject().put("native",true).put("version",getPackageManager().getPackageInfo(getPackageName(),0).versionName).put("device",db.device()).put("devices",db.devices()).put("sessions",db.sessions()).put("settings",db.settings()).put("paused",Boolean.parseBoolean(db.get("paused","false"))).put("collector",db.object("collector",new JSONObject())).put("appearance",db.object("appearance",null)).put("layout",db.object("layout",null)).put("weekLayout",db.object("weekLayout",null)).put("periodLayout",db.object("periodLayout",null)).put("settingsConflict",db.object("settingsConflict",null)).put("lastSync",Long.parseLong(db.get("lastSync","0"))).put("syncError",db.get("syncError","")).put("requests",new JSONArray());
            JSONArray peers=new JSONArray();JSONObject peer=db.object("peer",null);if(peer!=null&&peer.has("device"))peers.put(new JSONObject().put("id",peer.getJSONObject("device").getString("id")).put("last_sync",Long.parseLong(db.get("lastSync","0"))));return result.put("peers",peers).put("phoneTiming",db.object("phoneTiming",new JSONObject()));
        }
        if(method.equals("PUT")&&p.equals("/api/period-layout")){
            JSONArray cards=body.getJSONArray("cards");
            Set<String> keys=new HashSet<>(Arrays.asList("trend","ranking","compare"));
            if(cards.length()!=keys.size())throw new Exception("仪表盘布局无效");
            for(int i=0;i<cards.length();i++){
                JSONObject card=cards.getJSONObject(i);
                if(!keys.remove(card.getString("key")) || !(card.opt("visible") instanceof Boolean))throw new Exception("仪表盘布局无效");
            }
            db.put("periodLayout",new JSONObject().put("cards",cards));
        }
        else if(method.equals("PUT")&&p.equals("/api/layout")){JSONArray widgets=body.getJSONArray("widgets");if(widgets.length()>10)throw new Exception("布局无效");Set<String> ids=new HashSet<>();for(int i=0;i<widgets.length();i++){JSONObject w=widgets.getJSONObject(i);String id=w.getString("id");if(!Arrays.asList("header","phone","computer","apps","hours","week","changes","pie","deviceShare","stats").contains(id)||!ids.add(id)||w.getInt("w")<3||w.getInt("w")>12||w.getInt("h")<(id.equals("header")?96:140)||w.getInt("h")>900)throw new Exception("模块无效");for(String sizeKey:Arrays.asList("timeFontSize","unitFontSize")){if(w.has(sizeKey)){double size=w.getDouble(sizeKey);int min=sizeKey.equals("timeFontSize")?24:14,max=sizeKey.equals("timeFontSize")?72:36;if(size!=Math.rint(size)||size<min||size>max)throw new Exception("时间字号无效");}}}String page=body.optString("page","home");if(!page.equals("home")&&!page.equals("week"))throw new Exception("布局页面无效");db.put(page.equals("week")?"weekLayout":"layout",new JSONObject().put("widgets",widgets));}
        else if(method.equals("PUT")&&p.equals("/api/appearance")){if(!Arrays.asList("system","light","dark").contains(body.optString("theme"))||!Arrays.asList("blue","green","purple","amber","pink","teal","coral","graphite").contains(body.optString("accentColor")))throw new Exception("外观选项无效");db.put("appearance",new JSONObject().put("theme",body.getString("theme")).put("accentColor",body.getString("accentColor")));}
        else if(method.equals("PUT") && p.equals("/api/phone-timing")){
            String repeat=body.getString("repeat"),start=body.getString("start"),end=body.getString("end");
            if(!Arrays.asList("off","daily","weekdays","weekends").contains(repeat))throw new Exception("重复日期无效");
            java.time.LocalTime.parse(start);java.time.LocalTime.parse(end);
            if(!repeat.equals("off") && start.equals(end))throw new Exception("起止时间不能相同");
            synchronized(UsageCollector.class){
                UsageCollector.collect(this,db);
                resetActiveStart();
                db.put("phoneTiming",new JSONObject().put("repeat",repeat).put("start",start).put("end",end));
            }
        }
        else if(method.equals("PUT")&&p.equals("/api/settings")){int hour=body.getInt("dayStart");String tz=body.getString("timeZone");if(hour<0||hour>23||!Arrays.asList(TimeZone.getAvailableIDs()).contains(tz))throw new Exception("请检查日界线和时区");synchronized(UsageCollector.class){
                JSONObject previous=db.settings();
                if(!previous.getString("timeZone").equals(tz) && !db.object("phoneTiming",new JSONObject()).optString("repeat","off").equals("off")){
                    UsageCollector.collect(this,db);
                    resetActiveStart();
                }
                db.put("settings",new JSONObject().put("dayStart",hour).put("timeZone",tz).put("weekStart",1).put("baseRevision",previous.getString("revision")).put("revision",UUID.randomUUID().toString()));}}

        else if(method.equals("POST")&&p.equals("/api/settings/resolve")){JSONObject r=db.object("settingsConflict",null);if(r!=null){if(body.optString("choice").equals("remote"))db.put("settings",r);else {JSONObject keep=db.settings();keep.put("baseRevision",r.getString("revision")).put("revision",UUID.randomUUID().toString());db.put("settings",keep);}}db.put("settingsConflict","null");}
        else if(method.equals("POST")&&p.equals("/api/pause")){UsageCollector.collect(this,db);db.put("paused",body.getBoolean("paused"));db.put("captureState",new JSONObject());db.put("captureCursor",System.currentTimeMillis());}
        else if(method.equals("POST")&&p.equals("/api/permission"))runOnUiThread(()->startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)));
        else if(method.equals("POST")&&p.equals("/api/battery"))runOnUiThread(()->startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()))));
        else if(method.equals("POST")&&p.equals("/api/scan"))runOnUiThread(()->new IntentIntegrator(this).setDesiredBarcodeFormats(IntentIntegrator.QR_CODE).setPrompt("扫描电脑上的配对二维码").setBeepEnabled(false).setOrientationLocked(false).initiateScan());
        else if(method.equals("POST")&&p.equals("/api/connect")){UsageCollector.collect(this,db);SyncClient.pair(db,body.getString("uri"));tasks.execute(()->{try{SyncClient.sync(db);}catch(Exception e){db.put("syncError",e.getMessage()==null?"同步失败":e.getMessage());}});}
        else if(method.equals("POST")&&p.equals("/api/sync")){UsageCollector.collect(this,db);boolean changed=SyncClient.sync(db);return new JSONObject().put("ok",true).put("message",changed?"同步完成":"已是最新");}
        else if(method.equals("DELETE")&&p.equals("/api/peer")){SyncClient.unpair(db);}
        else if(method.equals("GET")&&p.equals("/api/sessions")&&u.getQueryParameter("start")!=null){
            long start=Long.parseLong(u.getQueryParameter("start")),end=Long.parseLong(u.getQueryParameter("end"));
            if(end<=start)throw new Exception("时间范围无效");
            return db.periodSessions(u.getQueryParameter("deviceId"),u.getQueryParameter("appId"),start,end);
        }
        else if(method.equals("GET")&&p.equals("/api/sessions")){JSONArray result=new JSONArray(),all=db.sessions();for(int i=0;i<all.length()&&result.length()<500;i++){JSONObject s=all.getJSONObject(i);if(s.isNull("deletedAt")&&(u.getQueryParameter("appId")==null||s.getString("appId").equals(u.getQueryParameter("appId")))&&(u.getQueryParameter("deviceId")==null||s.getString("deviceId").equals(u.getQueryParameter("deviceId"))))result.put(s);}return result;}
        else if(method.equals("DELETE")&&p.equals("/api/session")){db.delete(body.getString("id"));resetActiveStart();}
        else if(method.equals("DELETE")&&p.equals("/api/data")){if(!body.optString("confirm").equals("删除"))throw new Exception("请确认删除");JSONArray all=db.sessions();for(int i=0;i<all.length();i++)db.delete(all.getJSONObject(i).getString("id"));resetActiveStart();}
        else if(method.equals("POST") && (p.equals("/api/period-report") || p.equals("/api/week-report"))){
            String filename=body.getString("filename");
            if(!filename.matches("Ztime-(日|周|月|年)报-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.(txt|csv|pdf|png)"))throw new Exception("报告文件名无效");
            String extension=filename.substring(filename.lastIndexOf('.')+1);
            String mime=switch(extension){case "csv" -> "text/csv";case "pdf" -> "application/pdf";case "png" -> "image/png";default -> "text/plain";};
            byte[] bytes;
            if(p.equals("/api/week-report"))bytes=("\uFEFF"+body.getString("content")).getBytes(StandardCharsets.UTF_8);
            else {
                String encoded=body.getString("data");
                if(encoded.length()>8000000)throw new Exception("报告文件太大");
                bytes=android.util.Base64.decode(encoded,android.util.Base64.DEFAULT);
            }
            if(!savingReport.compareAndSet(false,true))throw new Exception("请先完成当前保存");
            try{java.nio.file.Files.write(reportFile().toPath(),bytes);}
            catch(Exception e){savingReport.set(false);throw e;}
            runOnUiThread(()->{
                try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,filename),701);}
                catch(ActivityNotFoundException e){reportFile().delete();savingReport.set(false);reportNotice("无法打开文件选择器");}
            });
        }
        else if(method.equals("GET")&&p.equals("/api/export")){JSONArray sessions=db.sessions(),filtered=new JSONArray();for(int i=0;i<sessions.length();i++)if(sessions.getJSONObject(i).isNull("deletedAt"))filtered.put(sessions.getJSONObject(i));boolean csv="csv".equals(u.getQueryParameter("format"));String content;if(csv){StringBuilder b=new StringBuilder("\uFEFFid,device_id,app_id,app_name,start_utc,end_utc,duration_ms\r\n");for(int i=0;i<filtered.length();i++){JSONObject s=filtered.getJSONObject(i);List<String> values=Arrays.asList(s.getString("id"),s.getString("deviceId"),s.getString("appId"),s.getString("appName"),java.time.Instant.ofEpochMilli(s.getLong("start")).toString(),java.time.Instant.ofEpochMilli(s.getLong("end")).toString(),String.valueOf(s.getLong("end")-s.getLong("start")));for(int j=0;j<values.size();j++){String v=values.get(j);if(v.matches("^[=+@-].*"))v="'"+v;b.append('"').append(v.replace("\"","\"\"")).append('"');if(j<values.size()-1)b.append(',');}b.append("\r\n");}content=b.toString();}else content=new JSONObject().put("schemaVersion",1).put("settings",db.settings()).put("devices",db.devices()).put("sessions",filtered).toString(2);exportContent=content;String mime=csv?"text/csv":"application/json",filename="time-ledger."+(csv?"csv":"json");runOnUiThread(()->startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType(mime).addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,filename),700));return new JSONObject().put("saved",true);}
        else throw new Exception("接口不存在");
        return new JSONObject().put("ok",true);
    }
    private final java.util.concurrent.atomic.AtomicBoolean savingReport=new java.util.concurrent.atomic.AtomicBoolean();
    private java.io.File reportFile(){return new java.io.File(getCacheDir(),"period-report.tmp");}
    private void reportNotice(String message){runOnUiThread(()->web.evaluateJavascript("window.ledgerReportNotice("+JSONObject.quote(message)+")",null));}
    private void resetActiveStart()throws Exception{JSONObject s=db.object("captureState",new JSONObject());s.put("start",System.currentTimeMillis());db.put("captureState",s);db.put("captureCursor",System.currentTimeMillis());}
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){super.onActivityResult(requestCode,resultCode,data);if(requestCode==701){
        java.io.File pending=reportFile();
        if(resultCode!=RESULT_OK||data==null||data.getData()==null){pending.delete();savingReport.set(false);reportNotice("已取消保存");return;}
        tasks.execute(()->{
            try(var out=getContentResolver().openOutputStream(data.getData(),"wt")){
                if(out==null)throw new java.io.IOException();
                java.nio.file.Files.copy(pending.toPath(),out);
            }catch(Exception e){reportNotice("报告保存失败，请重试");return;}
            finally{pending.delete();savingReport.set(false);}
            reportNotice("报告已保存");
        });
        return;
    }if(requestCode==700){if(resultCode==RESULT_OK&&data!=null&&exportContent!=null){String text=exportContent;tasks.execute(()->{try(var out=getContentResolver().openOutputStream(data.getData())){if(out!=null)out.write(text.getBytes(StandardCharsets.UTF_8));}catch(Exception ignored){}});}return;}IntentResult result=IntentIntegrator.parseActivityResult(requestCode,resultCode,data);if(result!=null&&result.getContents()!=null)web.evaluateJavascript("window.ledgerPairUri("+JSONObject.quote(result.getContents())+")",null);}
}
