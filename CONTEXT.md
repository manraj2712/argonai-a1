# Image Intake

Collects the photos an owner submits for headshot generation and decides, image by image, whether each one is good enough to keep.

## Language

### People

**Owner**:
The anonymous person a set of images belongs to. Every image has exactly one owner, and owners never see each other's images.
_Avoid_: User, account, customer

### Images

**Image**:
One file an owner submitted, together with everything we know about it.
_Avoid_: Photo, upload, file, asset

**Original**:
The bytes exactly as the owner sent them. Untrusted until proven otherwise.
_Avoid_: Raw, source file

**Normalized Image**:
The re-encoded copy of an original that every later step works from: upright, stripped of metadata, in a web-displayable format.
_Avoid_: Converted image, processed file

**Thumbnail**:
A small rendition of the normalized image used for previews.
_Avoid_: Preview (a preview is the UI element; the thumbnail is what it shows)

**Accepted Set**:
All of an owner's images whose status is accepted. It is the only thing a new image is compared against for similarity. An owner needs at least six to move on, and we ask for ten.
_Avoid_: Gallery, library

### Lifecycle

**Status**:
Where an image is in its lifecycle. Exactly one of the values below.

**Awaiting Upload**:
We have agreed to receive an image but its bytes have not arrived yet.

**Pending**:
The original has arrived and is waiting to be examined.
_Avoid_: Queued, uploaded

**Processing**:
The image is being examined right now.

**Accepted**:
The image passed every check and joins the accepted set.

**Rejected**:
The image failed at least one check. This is a verdict about the image and is shown to the owner with reasons.
_Avoid_: Invalid, denied

**Failed**:
We could not finish examining the image because something on our side broke. Says nothing about the image's quality.
_Avoid_: Error (as a status), rejected

### Checks

**Precheck**:
A check done in the owner's browser before anything is sent. A file that fails a precheck is rejected on the spot and never becomes an image on the server.
_Avoid_: Client validation

**Check**:
One rule an image is examined against, such as blur or face count.
_Avoid_: Validation, validator, rule

**Gate Check**:
A check the image must pass before any other check can meaningfully run (it can be decoded, and it is big enough). The first gate failure ends examination.

**Quality Check**:
A check that runs only after all gate checks pass. Every quality check runs, so the owner learns about every problem at once.

**Check Result**:
The outcome of one check on one image: passed or not, and what was measured.

**Rejection Reason**:
The stable, owner-facing explanation attached to a failed check result (for example _too blurry_ or _multiple faces_).
_Avoid_: Error message, failure code

**Near-Duplicate**:
An image whose visual fingerprint is close enough to an image already in the owner's accepted set that keeping both adds nothing.
_Avoid_: Duplicate (implies byte-identical), similar image

**Fingerprint**:
A compact summary of what an image looks like, built so that visually similar images get close fingerprints.
_Avoid_: Hash (too generic), checksum
