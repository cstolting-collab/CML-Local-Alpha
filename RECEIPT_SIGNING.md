# Receipt signing and trust

The current source checkout supports optional local Ed25519 signatures on
verification receipts. It uses Node's built-in cryptography and requires no
network service or additional package. The published `v0.1.0-alpha.2` archives
and their sample receipts remain unchanged and unsigned. These signing commands
apply to this checkout, not to an extracted alpha.2 archive.

An unsigned receipt establishes reproducibility and internal consistency with
the bundled compiler. A signed receipt additionally lets a recipient verify
that the holder of a separately trusted private key endorsed the receipt body.
The association between that key and a person or organization must be confirmed
separately. A signature alone does not identify the document's author, establish
when it was created, or prove external execution.

## Create an owner-controlled key

Run these commands on the key owner's computer, from the project root. Use a
private directory outside the repository, document storage, and exported files.
On Windows, run them in WSL and keep the key in the Linux user's home directory.
Private-key creation and loading require POSIX file permissions; they refuse to
run in native Windows Node because Windows ACL protection is not implemented.
Verification with a public key remains available in native Windows Node.

```bash
node receipt-key.js "$HOME/.cml-receipt-signing"
```

The command creates a **new** directory with mode `0700`, an Ed25519
`signing.private.pem` with mode `0600`, and `signing.public.pem`. It refuses to
overwrite an existing directory or key. Its output gives the two paths and a
`keyId` of the form `sha256:<hex fingerprint>`, computed from the public key's
SPKI DER representation. It does not print private-key bytes.

Keep `signing.private.pem` private. Do not commit it, paste it into a message,
include it in an archive, or place it alongside receipts. Keep any backup under
the owner's control, with appropriate encryption and access restrictions.
`signing.public.pem` and the fingerprint may be shared with intended verifiers.
Have recipients confirm the key or its fingerprint through a trusted channel
independent of the receipt they are assessing.

## Export signed receipts from the local app

Stop the existing CML server for this checkout using the normal shutdown
instructions, then start a foreground server with the private-key path:

```bash
CML_RECEIPT_SIGNING_KEY="$HOME/.cml-receipt-signing/signing.private.pem" node server.js
```

Open `http://127.0.0.1:4180`, validate a document, and export its verification
receipt. The configured server signs new receipt exports. The setting must be
present when that server starts; setting it in another shell or reusing an
already-running server does not change that server's configuration. The
foreground server stops with Ctrl+C.

When `CML_RECEIPT_SIGNING_KEY` is configured but cannot be loaded or is invalid,
startup fails. There is no fallback to unsigned exports. When the setting is
absent, exports remain unsigned for compatibility. Verify an exported file
with the expected public key, as shown below, to confirm its signature.

A server key identifies the signing server's key holder. If several people use
the same server, its signature does not distinguish which person authored or
exported a document.

## Sign a separate copy of an existing receipt

To endorse an existing internally consistent receipt, provide its path, your
private key, and a new output filename:

```bash
node sign-receipt.js RECEIPT.json --private-key "$HOME/.cml-receipt-signing/signing.private.pem" --output NEW_SIGNED.json
```

The output is created exclusively: an existing output file is rejected, and
the original receipt is preserved. Signing an old receipt creates a new signed
endorsement of that body. It does not retroactively prove who created the
original, when it was created, or who held it before signing. Keep the original
and signed copy distinguishable in any evidence record.

## Verify with an independently trusted public key

The recipient supplies the public key they have independently associated with
the intended signer:

```bash
node verify-receipt.js SIGNED.json --trusted-key /path/to/confirmed/signing.public.pem
```

Verification checks the receipt digest, compiler fingerprint, recomputed
validation results, and signature against that public key. A successful signed
verification reports `authentication.status: "trusted-signature"` and the
signing `keyId`. The receipt contains the public-key fingerprint, not a public
key to trust automatically. Supplying `--trusted-key` requires a signature;
unsigned receipts are rejected. Signed receipts without `--trusted-key` also
fail verification, so an untrusted signature cannot silently become an
unsigned success.

Legacy schema-1 receipts remain verifiable without a trust key:

```bash
node verify-receipt.js examples/sample-pass.verification.json
```

Their authentication status is explicitly `unsigned`. Successful verification
does not upgrade them to authenticated records. A receipt's PASS or FAIL verdict
describes its static compiler validation; signature authentication is a separate
result. A faithfully recorded FAIL can itself be an authentic, verifiable
receipt.

## Format and evidence limits

Signed receipts use schema 2, retain the existing top-level receipt fields,
and add `signing` metadata with algorithm `Ed25519` and the public-key `keyId`,
plus a `signature`. The verifier supports the original unsigned schema 1 as
well as signed schema 2. Existing published files are not rewritten to adopt
the new schema.

The schema-2 digest is SHA-256 over UTF-8 `JSON.stringify(body)`, where `body`
omits only `receiptSha256` and `signature`. The signed UTF-8 message is the
literal prefix `CML-Local-Verification-Receipt/v2`, one NUL byte, and the
lowercase hexadecimal digest. Ed25519 signs this message with a null algorithm
argument in Node. The signature is canonical base64 encoding of 64 bytes.
Keep JSON field order when transporting a receipt; whitespace formatting can
change because verification parses the JSON before recomputing its digest.

Both verification modes report `externalExecutionVerified: false`. The
compiler recheck is local static validation. Proving execution by a renderer,
runtime, or another external system requires evidence produced by that system
and a verifier for that evidence; receipt signing does not supply either.
Signatures also do not provide a trusted timestamp, a custody history, safety
certification, or deployment or launch authority.

Receipts can contain complete current and last-accepted source. Prepare
shareable sample content before validation and export. Altering a receipt body
invalidates its existing digest and, when present, its signature. Keep an
original private if it contains sensitive material; share a newly generated
sample receipt or a clearly labeled excerpt instead of presenting an edited
copy as the original verified record.

## Key loss, replacement, and compromise

If the private key is lost, a new key can sign future receipts. Old receipts
remain verifiable with the old public key, so preserve that public key and the
record of whose key it was. Generate replacements in a new private directory;
the key tool deliberately refuses overwrite. Recipients must independently
confirm the replacement key before trusting it.

If a private key may have been exposed, stop using it and notify recipients
through an authenticated channel. They must remove it from the keys they
accept and explicitly confirm a replacement. This local verifier has no online
revocation lookup: passing an old key with `--trusted-key` still asks the
verifier to trust it. A signature cannot establish that a receipt predates a
compromise because this format provides no trusted timestamp.
