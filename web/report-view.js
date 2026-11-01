import {weekReport} from './shared/week-report.js';
import {showReportDialog} from './reports/dialog.js';

// The host supplies Android document saving; desktop output is only loaded on demand.
export async function openWeekReport(snapshot,dialog,saveNativeText){
 const report=weekReport(snapshot);
 if(saveNativeText){
  showReportDialog(dialog,{text:report.content,formats:[['txt','保存文本']],
   save:async()=>{await saveNativeText(report);return {close:true};}});
  return;
 }
 const {desktopPreview}=await import('./reports/desktop.js');
 showReportDialog(dialog,desktopPreview(snapshot,report));
}
