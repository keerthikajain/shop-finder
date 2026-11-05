"""Summarize an explicitly exported local test log. No provider calls."""
import argparse,json,statistics
from collections import defaultdict,Counter
from pathlib import Path

def summarize(data):
    groups=defaultdict(list)
    for e in data.get('entries',[]):groups[(e.get('language','unknown'),e.get('stage','unknown'))].append(e)
    rows=[]
    for (language,stage),entries in sorted(groups.items()):
        durations=[e['ms'] for e in entries if isinstance(e.get('ms'),(int,float)) and 'error' not in e]
        outcomes=Counter(e.get('outcome','unreviewed') for e in entries)
        rows.append({'language':language,'stage':stage,'events':len(entries),'unique_trials':len({e['trial_id'] for e in entries if e.get('trial_id')}),'technical_errors':sum(bool(e.get('error')) for e in entries),'human_outcomes':dict(outcomes),'mean_success_ms':round(statistics.mean(durations),2) if durations else None})
    return {'note':'Stage observations, not overall language accuracy. Unreviewed events are not counted as correct. A trial can have multiple events. Compare the same script, speaker and noise conditions.','groups':rows}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('log',type=Path);args=parser.parse_args()
    print(json.dumps(summarize(json.loads(args.log.read_text(encoding='utf-8'))),ensure_ascii=False,indent=2))
