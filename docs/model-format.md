# Model formats
Use the application's export/import UI as the executable format authority; JSON schemas under packages/contracts are documentation aids, not a replacement for runtime validation.

Image artifacts include validated encoder metadata and finite classifier parameters. CSV artifacts include validated transforms, task, coefficients, labels, provenance and evaluation. Media artifacts wrap the CSV linear engine with format neuron-multimodal version 1, modality text/audio/video, an exact versioned extractor identifier and a validated classifier with matching feature dimensions. Text uses hash-words-26-v1, audio audio-spectrum-24-v1, video video-grid-24-v1.

Custom artifacts use neuron-custom-linear version 1: bounded numeric feature names, finite affine coefficients/bias, and task-specific output shape/labels. See the UI-downloaded template and runtime custom validator. No JavaScript, pickle, ONNX graphs or remote execution is accepted. All model artifacts may reveal private labels/features; model-only is not anonymized.

Full-project backup is a different envelope, carrying raw examples/versions. Media restore tolerates small browser codec feature differences (absolute <0.02), but verifies exact raw SHA-256 and preserves the validated stored features. Text comparison is strict (<1e-8). These checks detect corruption, not hostile-model certification or semantic accuracy.
