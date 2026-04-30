# Audio Clip Credits

These audio clips are synthetic sine-wave tones generated programmatically using FFmpeg. They are not derived from any copyrighted work.

## Generation

All clips were generated with:

```
ffmpeg -f lavfi -i "sine=frequency=<Hz>:duration=15" -c:a libopus -b:a 64k -ar 48000 clip-NN.ogg
```

| File | Frequency | License |
|------|-----------|---------|
| clip-01.ogg | 220 Hz | CC0 1.0 Universal (Public Domain) |
| clip-02.ogg | 275 Hz | CC0 1.0 Universal (Public Domain) |
| clip-03.ogg | 330 Hz | CC0 1.0 Universal (Public Domain) |
| clip-04.ogg | 385 Hz | CC0 1.0 Universal (Public Domain) |
| clip-05.ogg | 440 Hz (A4) | CC0 1.0 Universal (Public Domain) |
| clip-06.ogg | 495 Hz | CC0 1.0 Universal (Public Domain) |
| clip-07.ogg | 550 Hz | CC0 1.0 Universal (Public Domain) |
| clip-08.ogg | 605 Hz | CC0 1.0 Universal (Public Domain) |
| clip-09.ogg | 660 Hz | CC0 1.0 Universal (Public Domain) |
| clip-10.ogg | 715 Hz | CC0 1.0 Universal (Public Domain) |

These synthetic tones are dedicated to the public domain under the
[Creative Commons CC0 1.0 Universal Public Domain Dedication](https://creativecommons.org/publicdomain/zero/1.0/).

**Purpose:** Playwright fixture audio for automated testing only. Not for distribution.
