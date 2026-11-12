# Capability matrix
| Capability | Implementation / boundary |
|---|---|
| Image | MobileNet encoder pack + worker-trained classifier; file and explicit still-camera input |
| CSV | Linear softmax/regression, numeric/categorical transforms, split-safe preprocessing, batch inference |
| Text | 26 signed hashed word-count features, linear softmax; no language model/semantic embeddings |
| Audio | Actual browser decode, 8 kHz resampling, 24 spectrum features; 0.25–10 seconds |
| Video | Actual browser decode, six 32px frames pooled into 24 features; 0.25–12 seconds |
| Custom | Validated affine JSON, 1–30 numeric inputs, regression or 2–20 classes; no executable graphs |
| Peer | Manual WebRTC offer/answer, 8 MB model limit, chunks + SHA-256, explicit new-project import |
| Encrypted links | Existing image-only relay protocol; opt-in, separately deployed same-origin service |
| Offline | Production shell + worker assets; image encoder must first be installed |
| Backup | Modality-specific private JSON; restores create new IDs, never overwrite an existing project |

Media projects: <=2,000 examples and 32 MB raw data, <=50 versions per full backup and 64 MB backup file. Browser codecs vary. No guarantees for speech recognition, object tracking, arbitrary model conversion, cross-browser identical floating-point results, physical-device coverage, internet NAT traversal, fairness, or calibrated probabilities. No cloud deployment has been performed.
