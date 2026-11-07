---
title: "OpenCV"
subtitle: "AI / ML"
summary: "Built DocVision's scan-noise pipeline, degrading clean pages into realistic bad scans to train and test on."
tags: [skill, opencv, computer-vision, image-processing]
weight: 1
icon: /images/skills/opencv.svg
images: []
links: []
related: [proj-docvision, skill-ml]
---

In **DocVision**, OpenCV turns clean document pages into realistic "bad scans", so the models are
trained and tested on the kind of pages real OCR struggles with:

- **Skew and rotation:** perspective warps, with each field's label box warped to match.
- **Stains:** ellipse-shaped marks drawn over the page.
- **Blur and resolution loss:** Gaussian blur and downscaling.
