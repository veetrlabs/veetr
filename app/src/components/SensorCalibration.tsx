import {useEffect,useRef,useState} from 'react';
import {View,Text,Pressable} from 'react-native';
import {useBLE} from '../context/BLEContext';
import {useTheme} from '../context/ThemeContext';
import {themeColors} from '../constants/colors';
import {t} from '../i18n';
import {sensorCalibrationCommand,type CalibrationStatus} from '../utils/sensorCalibration';
const instructions=[
 'Detach Vane from the boat. Keep it powered and connected by Bluetooth. Do not rotate the boat. Keep the assembled device away from magnets, speakers and large metal objects.',
 'Hold Vane in 4–6 different orientations, like resting a cube on different faces. Hold each position for about one second.',
 'Place Vane on a stationary surface and leave it completely still for at least three seconds.',
 'Slowly rotate Vane about 180° and back around each axis: roll, pitch and yaw. Take about two seconds per rotation. Repeat until magnetic quality reaches 2/3 or 3/3.',
];
export default function SensorCalibration({onActive}:{onActive:(active:boolean)=>void}) {
 const {state,sendCommand}=useBLE(),c=themeColors[useTheme().theme];
 const [step,setStep]=useState(0),[status,setStatus]=useState<CalibrationStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),active=useRef(false),saving=useRef(false),lock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(active.current&&!saving.current)void sensorCalibrationCommand(sendCommand,4).catch(()=>{});};},[sendCommand]);
 const accept=(next:CalibrationStatus)=>{
  if(!alive.current)return;
  setStatus(next); active.current=['starting','running','saving'].includes(next.state);saving.current=next.state==='saving';onActive(active.current);
 };
 async function command(op:1|3|4) {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try {const next=await sensorCalibrationCommand(sendCommand,op);accept(next);if(op===1&&alive.current)setStep(1);}
  catch(e){if(alive.current)setError((e as Error).message);}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 useEffect(()=>{
  if(!status || !['starting','running','saving'].includes(status.state))return;
  let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   if(stopped)return;
   if(!lock.current) {
    lock.current=true;
    try{const next=await sensorCalibrationCommand(sendCommand,2);if(!stopped)accept(next);}
    catch(e){if(!stopped){setError((e as Error).message);active.current=false;onActive(false);setStatus(null);}}
    finally{lock.current=false;}
   }
   if(!stopped)timer=setTimeout(poll,1000);
  };timer=setTimeout(poll,1000);
  return()=>{stopped=true;clearTimeout(timer);};
 },[status?.state,sendCommand]);
 const running=!!status&&['starting','running','saving'].includes(status.state);
 const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:16,borderRadius:10,backgroundColor:c.buttonBg,opacity:disabled ? .5 : 1}}><Text style={{color:c.text}}>{t(label)}</Text></Pressable>;
 return <View style={{padding:20,gap:14,borderRadius:16,backgroundColor:c.panelBg}}>
  <Text style={{color:c.text,fontSize:20,fontWeight:'600'}}>{t('Calibrate Vane sensors')}</Text>
  <Text style={{color:c.textSecondary}}>{t(instructions[running?step:0])}</Text>
  {!running&&button('Vane is detached — start calibration',()=>void command(1),busy||!state.isConnected||state.firmwareInfo.isUpdating)}
  {running&&<>
   <Text style={{color:c.text}}>{t('Magnetic quality:')} {status?.mag}/3 · {t('Acceleration quality:')} {status?.accel}/3</Text>
   {status?.state==='starting'&&<Text style={{color:c.text}}>{t('Waiting for sensor confirmation…')}</Text>}
   {status?.state==='running'&&step<3&&button('Done — next step',()=>setStep(s=>s+1),busy)}
   {status?.state==='running'&&step===3&&button('Save sensor calibration',()=>void command(3),busy||!status.ready)}
   {status?.state==='saving'?<Text style={{color:c.text}}>{t('Waiting for the sensor to confirm saving…')}</Text>:button('Cancel calibration',()=>void command(4),busy)}
  </>}
  {status?.state==='saved'&&<Text style={{color:c.text}}>{t('Sensor confirmed calibration saved to flash. Remount Vane in its sailing position, then set vessel level and north reference below.')}</Text>}
  {status&&['failed','unconfirmed','unavailable','cancelled'].includes(status.state)&&<Text style={{color:c.text}}>{t(status.state==='cancelled'?'Calibration stopped. No save was requested.':'Calibration was not confirmed. Check the connection and try again. A save timeout does not prove that saving failed.')}</Text>}
  {!!error&&<Text accessibilityRole="alert" style={{color:c.text}}>{t(error)}</Text>}
 </View>;
}
