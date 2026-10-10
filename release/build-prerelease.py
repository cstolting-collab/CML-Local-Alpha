"""Build a deterministic, allowlisted prerelease with existing Python 3 only."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import tarfile

root = Path(__file__).resolve().parent.parent
version = '0.1.0-alpha.1'
name = f'cml-local-alpha-{version}'
files = [
    'TESTER_README.md', 'README.md', 'package.json', 'server.js', 'store.js',
    'validator.js', 'verify-receipt.js', 'evidence/COMPILER_PROVENANCE.json',
    'release/PRERELEASE_NOTES.md', 'release/build-prerelease.py',
]
for folder in ('public', 'desktop', 'tester', 'tests', 'examples', 'vendor/compiler'):
    files.extend(p.relative_to(root).as_posix() for p in (root / folder).rglob('*') if p.is_file())
files = sorted(set(files))
entries = []
for relative in files:
    path = root / relative
    if path.is_symlink() or any(part.startswith('.') for part in Path(relative).parts):
        raise ValueError(f'Unexpected hidden file or symlink: {relative}')
    data = path.read_bytes()
    entries.append({'path': relative, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
manifest = (json.dumps({'build': version, 'archiveRoot': name, 'files': entries}, indent=2) + '\n').encode()
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
