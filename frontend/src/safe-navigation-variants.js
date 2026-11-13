// Limited STT spelling recovery for informational commands only.
// These requests open a report or replay audio; they NEVER confirm a pick or save.
// Require matching word count and a bounded typo distance, never substrings.
export const normalizeVoiceText=text=>String(text||'').normalize('NFC').toLocaleLowerCase()
 .replace(/[.,!?।॥;:؟]/g,' ').trim().replace(/\s+/g,' ');

const NEGATIONS=/\b(?:not|dont|don't|never|no|without|nahi|nahin|mat|don't|cancel)\b|(?:नहीं|नही|मत|नको|వద్దు|కాదు|లేదు|नको|नहीं है)/iu;

function editDistanceWithin(a,b,limit){
 if(Math.abs(a.length-b.length)>limit)return false;
 let previous=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const row=[i];let best=row[0];
  for(let j=1;j<=b.length;j++){
   const cost=a[i-1]===b[j-1]?0:1;
   const value=Math.min(previous[j]+1,row[j-1]+1,previous[j-1]+cost);
   row[j]=value;best=Math.min(best,value);
  }
  if(best>limit)return false;
  previous=row;
 }
 return previous[b.length]<=limit;
}
export function safeNavigationVariant(text,phrases){
 const value=normalizeVoiceText(text);
 if(!value||NEGATIONS.test(value))return false;
 const words=value.split(' ');
 for(const original of phrases){
  const expected=normalizeVoiceText(original);
  if(value===expected)return true;
  const expectedWords=expected.split(' ');
  if(words.length!==expectedWords.length||value.length<9||expected.length<9)continue;
  // The verb/intent-bearing word must remain recognizable.
  if(!editDistanceWithin(words[0],expectedWords[0],1))continue;
  const maxEdits=Math.max(value.length,expected.length)>=18?2:1;
  if(editDistanceWithin(value,expected,maxEdits))return true;
 }
 return false;
}
