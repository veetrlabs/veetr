import postcss from 'postcss';
import base from '../features/racing/style.css?raw';
import theme from '../features/racing/theme.css?raw';
import mapChart from '../features/racing/map-chart-panel.css?raw';
// Scope the existing application styles; marketing and Starlight keep their own CSS.
export function racingStyles() {
 // Raw CSS imports are not resolved by PostCSS. Include the shared layout here
 // so it is scoped and embedded with the rest of the race application styles.
 const root=postcss.parse(base+'\n'+theme+'\n'+mapChart);
 root.walkRules(rule=>{
  if (rule.parent?.type==='atrule' && /keyframes$/.test((rule.parent as postcss.AtRule).name)) return;
  rule.selector=postcss.list.comma(rule.selector).map(selector=>{
   if(selector.trim()===':root'||selector.trim()==='body')return '.race-app';
   return `.race-app ${selector}`;
  }).join(', ');
 });
 return root.toString();
}
