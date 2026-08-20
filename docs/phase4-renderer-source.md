# Phase 4 Renderer Source Note

The Phase 4 mobile renderer will use `expo-gl`'s `GLView` as the native OpenGL ES render target. The official Expo documentation states that a GL context is created when the view mounts, its drawing buffer is presented each frame, and the context exposes a WebGL-like API suited to 2D and 3D graphics. It also notes that rendering must call `gl.endFrameEXP()` to present the native frame and that remote debugging does not support the synchronous native calls required by `GLView`.

This supports a direct shader-based triangle renderer from parser/kernel-derived tessellation while avoiding a fabricated display mesh. Phase 4 will keep a separate web fallback for the browser preview; acceptance testing of native rendering remains deterministic scene-state testing rather than browser preview testing.

Source: [Expo GLView documentation](https://docs.expo.dev/versions/latest/sdk/gl-view/), retrieved 2026-08-20.
