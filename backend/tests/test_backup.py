import importlib.util
import sqlite3
from pathlib import Path
import pytest

spec=importlib.util.spec_from_file_location('backup_database',Path(__file__).resolve().parents[2]/'scripts/backup_database.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

def test_backup_is_consistent_and_never_overwrites(tmp_path):
 source=tmp_path/'source.sqlite3';target=tmp_path/'backup.sqlite3'
 with sqlite3.connect(source) as db:
  db.execute('CREATE TABLE example(value TEXT)');db.execute("INSERT INTO example VALUES ('saved')")
 module.backup(source,target)
 with sqlite3.connect(target) as db:assert db.execute('SELECT value FROM example').fetchone()[0]=='saved'
 with pytest.raises(FileExistsError):module.backup(source,target)
 with pytest.raises(ValueError):module.backup(source,source)
 with pytest.raises(ValueError):module.backup(tmp_path/'absent',target)
