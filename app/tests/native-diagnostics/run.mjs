// Run after a local Android compile has populated the Kotlin/JSON Gradle cache.
import {readdir, mkdtemp, rm} from 'node:fs/promises';
import {join, dirname, delimiter} from 'node:path';
import {tmpdir, homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const here=dirname(fileURLToPath(import.meta.url));
const cache=join(process.env.GRADLE_USER_HOME ?? join(homedir(),'.gradle'),'caches/modules-2/files-2.1');
async function jars(path) {
  let entries; try {entries=await readdir(path,{withFileTypes:true})} catch {return []}
  return (await Promise.all(entries.map(e=>e.isDirectory()?jars(join(path,e.name)):e.name.endsWith('.jar')?[join(path,e.name)]:[]))).flat();
}
const compiler=(await jars(join(cache,'org.jetbrains.kotlin/kotlin-compiler-embeddable'))).find(p=>p.includes('/2.1.20/'));
const stdlib=(await jars(join(cache,'org.jetbrains.kotlin/kotlin-stdlib'))).find(p=>p.includes('/2.1.20/'));
const deps=(await Promise.all(['org.jetbrains.kotlin/kotlin-script-runtime','org.jetbrains.kotlin/kotlin-reflect','org.jetbrains.kotlinx/kotlinx-coroutines-core-jvm','org.jetbrains/annotations','org.jetbrains.intellij.deps/trove4j','org.json/json'].map(p=>jars(join(cache,p))))).flat();
if(!compiler||!stdlib) throw new Error('Compile Android locally first (Kotlin 2.1.20 dependencies required).');
const cp=[compiler,stdlib,...deps].join(delimiter);
const java=process.env.JAVA_HOME?join(process.env.JAVA_HOME,'bin/java'):'java';
const out=await mkdtemp(join(tmpdir(),'veetr-native-history-'));
try {
  const sources=(await readdir(here)).filter(s=>s.endsWith('.kt')).map(s=>join(here,s));
  sources.push(join(here,'../../node_modules/expo-location/android/src/main/java/expo/modules/location/VeetrLocationDiagnostics.kt'));
  execFileSync(java,['-cp',cp,'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler','-nowarn','-no-stdlib','-no-reflect','-classpath',cp,'-d',out,...sources],{stdio:'inherit'});
  execFileSync(java,['-cp',[out,cp].join(delimiter),'expo.modules.location.HistoryTestKt'],{stdio:'inherit'});
} finally {await rm(out,{recursive:true,force:true})}
