// A narrow grammar keeps quantities reviewable. Unrecognised speech stays editable.
export function parseStockSpeech(text) {
 const numbers={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
 const normalized=text.toLowerCase().trim().replace(/[.!?]$/,'').replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,w=>numbers[w]);
 const m=/^(receive|remove|move|count)\s+(\d+)(?:\s+(?:units?|pieces?))?$/.exec(normalized);
 return m&&Number(m[2])<=1000000000?{operation:m[1],quantity:Number(m[2])}:null;
}
