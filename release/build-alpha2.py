"""Build a deterministic, allowlisted prerelease with existing Python 3 only."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import tarfile

root = Path(__file__).resolve().parent.parent
version = '0.1.0-alpha.2'
name = f'cml-local-alpha-{version}'
# Freeze the original payload inventory, replacing only packaging documentation.
original = json.loads((root / 'release/cml-local-alpha-0.1.0-alpha.1.files.json').read_text())
files = [entry['path'] for entry in original['files']
         if entry['path'] not in ('release/PRERELEASE_NOTES.md', 'release/build-prerelease.py')]
files += ['WHY_CML.md', 'release/PRERELEASE_NOTES-alpha.2.md', 'release/build-alpha2.py']
files = sorted(set(files))
entries = []
for relative in files:
    path = root / relative
    if path.is_symlink() or any(part.startswith('.') for part in Path(relative).parts):
        raise ValueError(f'Unexpected hidden file or symlink: {relative}')
    data = path.read_bytes()
    entries.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest = (json.dumps({'build': version, 'appVersion': '0.1.0', 'compilerVersion': '1.2.0-alpha.0', 'archiveRoot': name, 'payloadFileCount': len(entries), 'archiveFileCount': len(entries) + 1, 'inventoryNote': 'The archive also includes this manifest; a self-hash is omitted to avoid circularity.', 'files': entries}, indent=2) + '\n').encode()
manifest_path = root / 'release' / f'{name}.files.json'
manifest_path.write_bytes(manifest)
archive = root / 'release' / f'{name}.tar.gz'
with archive.open('wb') as output:
    with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w', format=tarfile.PAX_FORMAT) as tar:
            for relative, data in [(p, (root / p).read_bytes()) for p in files] + [('release/' + manifest_path.name, manifest)]:
                info = tarfile.TarInfo(name + '/' + relative)
                info.size = len(data)
                info.mode = 0o644
                info.mtime = 0
                info.uid = info.gid = 0
                info.uname = info.gname = ''
                tar.addfile(info, io.BytesIO(data))
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(root / 'release' / f'{name}.tar.gz.sha256').write_text(f'{digest}  {archive.name}\n')
print(f'{archive.name}: {len(files) + 1} files, {archive.stat().st_size} bytes\nSHA-256: {digest}')
