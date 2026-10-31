package org.timeledger.app;

import android.content.Context;
import androidx.work.*;
import org.json.JSONObject;
import java.util.concurrent.TimeUnit;

public class SyncWorker extends Worker {
    public SyncWorker(Context context,WorkerParameters parameters){super(context,parameters);}
    public static void schedule(Context c){PeriodicWorkRequest work=new PeriodicWorkRequest.Builder(SyncWorker.class,15,TimeUnit.MINUTES).build();WorkManager.getInstance(c).enqueueUniquePeriodicWork("time-ledger-collect-sync",ExistingPeriodicWorkPolicy.KEEP,work);}
    @Override public Result doWork(){try(LedgerDb db=new LedgerDb(getApplicationContext())){UsageCollector.collect(getApplicationContext(),db);if(db.object("peer",null)!=null){try{SyncClient.sync(db);}catch(Exception e){db.put("syncError",e.getMessage()==null?"等待电脑连接":e.getMessage());}}return Result.success();}catch(Exception e){return Result.retry();}}
}
