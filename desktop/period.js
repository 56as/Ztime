import {periodBounds,periodStats} from '../shared/period.js';

export function readPeriod(store,params,now=Date.now()){
 const from=params.get('from'),to=params.get('to'),settings=store.get('settings');
 const {start,end}=periodBounds(from,to,settings,now);
 const rows=store.sessionsInRange(start,end);
 const detail=params.get('detail');
 // Existing clients omit detail and expect both bin apps and day sessions.
 const options={includeBinApps:detail!=='totals',includeSessions:detail===null||detail==='ring'};
 return periodStats(rows,store.devices(),settings,from,to,params.get('mode'),params.get('scope')||'all',now,options);
}
