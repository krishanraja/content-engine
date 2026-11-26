# Where his face comes from

Read by the cover-art skill before a face-led cover.

- **Real photos:** only the files at the top of his Drive folder "Photos" (`1PQDSg4_kD6zwVerqvxaiQE5Ocjnsd6xB`, in
  Video Engine > Krish Clone - Assets), never its subfolders, for the cover itself (Krish, 2026-11-17). Its subfolder
  "All other photos" (never the DO-NOT-USE folder inside it) is for his likeness profile and generated headshots only
  (`photos.py fetch --references`; krish-clone `clone faceprofile`). The home computers publish them to
  the library every pass (`scripts/post-pack/photos.py publish`); a cloud session gets them with
  `python3 scripts/post-pack/photos.py fetch --out <folder>`.
- **Generated headshots:** made from those references on Higgsfield (`gpt_image_2_6`, about 0.25 credits a still by
  the connector's `get_cost`; say the cost before generating). A generated headshot of him is used on a cover only
  once he has approved that still in his own words and krish-clone records it (`clone registry`); until then it is
  shown to him as an option, never filed. How to close the last 10% of his likeness is krish-clone's
  `docs/GENERATORS.md`, "His likeness in stills": his words per still, one attribute edited at a time, re-measured
  with `clone likeness`.
- **Generated scenes** for a piece: classy editorial stills, no people, no text, no logos, never a fake of a real
  event or document. Real proof beats a generated scene whenever the piece has one.
