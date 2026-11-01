// Only these bundled files are served to the local renderer.
const paths=[
 'web/index.html',
 'web/app.js',
 'web/dashboard.js',
 'web/report-view.js',
 'web/style.css',
 'web/brand-icon.png',
 'shared/week-report.js',
 'shared/time.js',
 'shared/layout.js',
 'shared/appearance.js',
 'shared/dashboard.js',
 'shared/report-model.js',
 'shared/report-format.js',
 'shared/report-csv.js',
 'web/reports/dialog.js',
 'web/reports/desktop.js',
 'web/reports/chart.js',
 'web/reports/image-export.js',
];
const files=new Map(paths.map(p=>[p==='web/index.html'?'/':'/'+p.replace(/^web\//,''),p]));
export const uiFileFor=url=>files.get(url);
