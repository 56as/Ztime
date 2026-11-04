import {periodStats} from './shared/period.js';

// The page selects a date range. The adapter owns the platform and transport.
export function periodData(api){
 return {
  readPeriod(snapshot,query){
   if(snapshot.native){
    const {from,to,mode,scope}=query;
    return periodStats(snapshot.sessions,snapshot.devices,snapshot.settings,from,to,mode,scope);
   }
   return api('/api/period?'+new URLSearchParams(query));
  },
  saveLayout(cards){return api('/api/period-layout','PUT',{cards});}
 };
}
