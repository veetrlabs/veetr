import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { themeColors } from "../constants/colors";
import { eventsFor, seriesRounds, standingsForView, type Series } from "../../../veetr.org/src/features/racing/domain";

export default function SeriesDetail({ series, boatId, onBoat, onRace }: {
  series: Series; boatId?: string; onBoat: (id: string) => void; onRace: (id: string) => void;
}) {
  const { theme } = useTheme(), c = themeColors[theme];
  const [category, setCategory] = useState(series.categories[0]?.id ?? "");
  const boat = series.boats.find(b => b.id === boatId);
  const categoryId = boat?.categoryId ?? category;
  const events = eventsFor(series).filter(e => series.races.some(r => (r.eventId ?? r.id) === e.id)).sort((a,b) => a.order-b.order);
  const rounds = seriesRounds(series, categoryId);
  const standings = standingsForView(series, categoryId);
  const rows = boat ? standings.filter(row => row.id === boat.id) : standings;
  const label = (text: string, onPress: () => void) => <Pressable accessibilityRole="link" onPress={onPress} style={{ minHeight:44, justifyContent:"center" }}><Text style={{ color:c.text, textDecorationLine:"underline" }}>{text}</Text></Pressable>;
  const cellWidth = 112, rowHeight = 72, headerHeight = 88;
  return <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16, gap:16 }}>
    {boat ? <View style={{ gap:8 }}>
      <Text style={{ color:c.text, fontSize:24, fontWeight:"700" }}>{boat.name}</Text>
      <Text style={{ color:c.textMuted }}>{series.categories.find(cat => cat.id === boat.categoryId)?.name}</Text>
      {!!boat.sailNumber && <Text style={{ color:c.text }}>Sail number · {boat.sailNumber}</Text>}
      {!!boat.className && <Text style={{ color:c.text }}>Class · {boat.className}</Text>}
      {!!boat.length && <Text style={{ color:c.text }}>Length · {boat.length} m</Text>}
      {!!boat.skipper && <Text style={{ color:c.text }}>Skipper · {boat.skipper}</Text>}
      {label("Full boat profile on website", () => void Linking.openURL(`https://veetr.org/boats/?boat=${encodeURIComponent(boat.id)}`))}
      <Text style={{ color:c.text, fontSize:18, fontWeight:"600" }}>{series.name}</Text>
    </View> : <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
      {series.categories.map(cat => <Pressable key={cat.id} accessibilityRole="button" accessibilityState={{selected:category===cat.id}} onPress={() => setCategory(cat.id)} style={{padding:12,minHeight:44,borderRadius:12,backgroundColor:category===cat.id?"#006b62":c.buttonBg}}><Text style={{color:category===cat.id?"white":c.text}}>{cat.name}</Text></Pressable>)}
    </View>}
    <Text style={{color:c.textMuted}}>Series points · Swipe sideways for more races</Text>
    <Text style={{color:c.text}}>Discarded scores are crossed out and marked “Discarded”.</Text>
    <View style={{flexDirection:"row", borderWidth:1,borderColor:c.border,borderRadius:12,overflow:"hidden"}}>
      <View style={{width:136,backgroundColor:c.panelBg}}>
        <View style={{height:headerHeight,justifyContent:"center",padding:12}}><Text style={{color:c.text,fontWeight:"700"}}>Place / Boat</Text></View>
        {rows.map(row => <Pressable key={row.id} accessibilityRole="link" accessibilityLabel={`View boat ${series.boats.find(b=>b.id===row.id)?.name}`} onPress={()=>onBoat(row.id)} style={{height:rowHeight,padding:10,justifyContent:"center",borderTopWidth:1,borderColor:c.border}}>
          <Text numberOfLines={2} style={{color:c.text,fontWeight:"600"}}>{row.rank || "—"} · {series.boats.find(b=>b.id===row.id)?.name}</Text>
        </Pressable>)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={{flexDirection:"row",backgroundColor:c.panelBg}}>
            <View style={{width:72,height:headerHeight,justifyContent:"center",alignItems:"center"}}><Text style={{color:c.text,fontWeight:"700"}}>Total</Text></View>
            {events.map(event => <Pressable key={event.id} accessibilityRole="link" accessibilityLabel={`View race ${event.name}`} onPress={()=>onRace(event.id)} style={{width:cellWidth,height:headerHeight,justifyContent:"center",padding:8}}><Text style={{color:c.text,fontWeight:"600",textDecorationLine:"underline"}}>{event.name}{(event.countAs??1)>1?` ×${event.countAs}`:""}</Text></Pressable>)}
          </View>
          {rows.map(row=><View key={row.id} style={{flexDirection:"row",height:rowHeight,borderTopWidth:1,borderColor:c.border}}>
            <View style={{width:72,justifyContent:"center",alignItems:"center"}}><Text accessibilityLabel={`Total ${row.countedTotal}`} style={{color:c.text,fontWeight:"700",fontSize:18}}>{row.scores.length?row.countedTotal:"—"}</Text>{row.discardedRaceIds.length > 0 && <Text style={{color:c.textMuted,fontSize:11,marginTop:4}}>{row.discardedRaceIds.length} discarded</Text>}</View>
            {events.map(event=>{
              const scores=rounds.filter(round=>round.eventId===event.id).map(round=>row.scores.find(score=>score.raceId===round.id));
              return <View key={event.id} style={{width:cellWidth,flexDirection:"row",gap:6,alignItems:"center",padding:8}}>{scores.map((score,i)=> {
                const discarded = !!score && row.discardedRaceIds.includes(score.raceId);
                return <View key={i} style={{gap:4,alignItems:"center"}}>
                  <Text accessibilityLabel={score?`${event.name}: ${score.points}${discarded?", discarded":""}`:`${event.name}: no result`} style={{color:c.text,fontSize:16,textDecorationLine:discarded?"line-through":"none",textDecorationStyle:"solid"}}>{score?.points??"—"}</Text>
                  {discarded && <Text style={{color:c.textMuted,fontSize:10}}>Discarded</Text>}
                </View>;
              })}</View>;

            })}
          </View>)}
        </View>
      </ScrollView>
    </View>
    {!rows.length&&<Text style={{color:c.textMuted}}>No published results in this category.</Text>}
    <Text style={{color:c.textMuted,fontSize:12}}>Published races only. Crossed-out scores are discarded. Total includes counted scores.</Text>
  </ScrollView>;
}
