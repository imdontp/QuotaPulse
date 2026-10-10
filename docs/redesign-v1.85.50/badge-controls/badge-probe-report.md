# Production badge counterfactual diagnostic

Result: the historical badge variation is **unreproduced** in these controls. No causal repair claim follows from this result.

All probes used the full synthetic in-memory fixture copied from `scripts/check-stable-captures.mts`, actual frozen production dist, fixed2025-05-17T13:42Z Date in browser/API, Thai/dark, actual bundled font warm-up and platform-font inspection, deviceScaleFactor1, Asia/Bangkok, reduced motion, and fresh Chrome processes with the original renderer arguments: disable-gpu, deterministic-mode, disable-skia-runtime-opts, force-color-profile=srgb. Own HTTP server7816, output directories under this ignored tmp folder. Browser request guard blocked external origins and API methods other thanGET. Final fixture snapshots were unchanged. No app source/dist rebuild or stable-capture output write occurred.

| Control | Radius | Fresh processes | Full-page frames | Varied badge pixels |
|---|---|---:|---:|---:|
| Native newdist / override after firstpaint |9px|8|16|0|
| Override after firstpaint |999px|8|16|0|
| CSS response override before firstpaint |9px|8|16|0|
| CSS response override before firstpaint |999px|8|16|0|
| CSS response override before firstpaint |50%|8|16|0|
| Samepage Overview1586x992→Live1672x941 |9px|4|8|0|
| Samepage Overview1586x992→Live1672x941 |999px|4|8|0|
| Samepage Overview widths390/900/1280/back1586→Live1672 |9px|4|8|0|
| Samepage Overview widths390/900/1280/back1586→Live1672 |999px|4|8|0|

Total56 independent Chrome processes and112 actual fullpage screenshots. Every control's badge DOM paint inputs were stable within its group: x183,y327,width20,height18,text4,color/background/font/lineheight/border/transform/dpr. Computed radius was verified for every frame. All page errors, external requests, API write requests, HTTP>=400 responses: zero.

All96 fullpage screenshots for9px/999px across the controls share SHA256 `6c3f94d960466df755242628f2c5e4adeb2755b86fc3dd3a745fef051a253dc6`. This is observed diagnostic whole-page byte equality; it does not replace the full unmasked canonical/repeat case or full matrix gate.

Raw badge bitmap SHA256 (20x18 RGBA pixels):

- 9px and999px all controls: `4d8609a74adf13ba3d870da205931d29183357dd60f5869c9126a0ec87e6fa19`.
- 50%: `d2a3176011285ef3b0ad37f0fb7b782db5bd67801e549c09e48f41a75c8bbf3f`.
- Preserved historical canonical: `4d8609a74adf13ba3d870da205931d29183357dd60f5869c9126a0ec87e6fa19`.
- Preserved historical repeat: `8cf6959126b53f3718ec88d3ea304bb3d1f6729814a6d98bce4750439726e2b5`.

Historical canonical/repeat differ in14 badge edgepixels, maxchannel delta28. Every9/999 control matches the canonical badge exactly and differs from the repeat at those14 pixels. The50% ellipse differs from BOTH historical badges at71 pixels, maxdelta70. Thus the actual ellipse bitmap does not match the historical changed shape; the proposed roundedrect-versus-ellipse explanation is unsupported by these measurements. The viewport-history control also fails to reproduce the changed shape, so these particular resize operations are not sufficient to cause it.

Scope limits: this minimized history does not execute every functional interaction and intermediate API state from the original full stable-capture run. No claim that999px can never vary, or9px fixes its rendering, is supported. The original focused unmasked case run by root is a separate result.

Artifacts: `badge-analysis.json` contains rawhashes, actual pixel differences and pergroup counts. Each control directory contains `records.json` with actual DOMstyles/fonts/geometry and wholepage PNGs. Runners are repo ignored `tmp/badge-counterfactual51.mts`, `tmp/badge-prepaint51.mts`, `tmp/badge-history51.mts`; builders and pixel analyzer are in this directory.
