# Fixture sources

All photos are works of NASA and in the public domain in the United States. They were
downloaded from Wikimedia Commons at 1200px width.

| File                 | Source                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `single-face.jpg`    | [Neil Armstrong pose.jpg](https://commons.wikimedia.org/wiki/File:Neil_Armstrong_pose.jpg) |
| `single-face-2.jpg`  | [Buzz Aldrin.jpg](https://commons.wikimedia.org/wiki/File:Buzz_Aldrin.jpg)                 |
| `single-face-2.heic` | `single-face-2.jpg` converted with macOS `sips -s format heic`                             |
| `group.jpg`          | [Apollo 11 Crew.jpg](https://commons.wikimedia.org/wiki/File:Apollo_11_Crew.jpg)           |

Blurry, tiny, small-face and near-duplicate variants are generated in the tests from these
originals, so the thresholds they exercise stay visible next to the assertions.
