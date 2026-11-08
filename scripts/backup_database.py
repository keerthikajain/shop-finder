"""Create a consistent SQLite backup without copying a live database file."""
import argparse
import os
import sqlite3
if os.name=='posix':os.umask(0o077)
from pathlib import Path

def backup(source, destination):
 source=Path(source).resolve();destination=Path(destination).resolve()
 if not source.is_file():raise ValueError('Source database does not exist.')
 if source==destination:raise ValueError('Choose a separate backup path.')
 destination.parent.mkdir(parents=True,exist_ok=True)
 # Exclusive creation prevents accidentally replacing an earlier backup.
 fd=os.open(destination,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
 try:
  with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as src,sqlite3.connect(destination) as dst:
   src.backup(dst)
   if dst.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Backup integrity check failed.')
 except Exception:
  destination.unlink(missing_ok=True);raise
 return destination

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('source');parser.add_argument('destination')
 args=parser.parse_args()
 print(backup(args.source,args.destination))
