# Native dashboard Activity canvas

On Windows, the review262 Electron window reported minimized while the renderer continued to report document.hidden as false. With a synthetic call, theme change and resize, the Activity canvas clear count increased from 19 to 22 during minimization. The dashboard main process now sends its window visibility to its isolated preload. The Activity canvas observes that state alongside document visibility and intersection.

The [native stages](stages.json) cover a real hide, show, minimize, restore and route change on the compiled source build. No paints occurred during the hidden or minimized updates. On restoration the canvas showed the latest synthetic minute bucket (1700 tokens) and stayed idle after settling. Leaving Overview removed the canvas. The owned Electron process exited with code zero.

The probe uses the production main, preload and web assets with a synthetic local daemon. It exercises native window methods, with background throttling enabled and no visibility emulation. Its scope is the Activity canvas. Other dashboard animations and a physical tray click require separate evidence. The delivered review262 ZIP predates this fix.
