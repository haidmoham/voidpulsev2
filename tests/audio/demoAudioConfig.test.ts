import { describe, expect, it } from "vitest";
import { readDemoAudioConfig } from "../../src/audio/DemoAudioConfig";

describe("demo-audio configuration", () => {
  it("keeps rights metadata optional instead of inventing a track identity", () => {
    expect(readDemoAudioConfig({ VITE_DEMO_AUDIO_URL: "https://audio.example/demo.ogg" })).toEqual({
      available: true,
      url: "https://audio.example/demo.ogg",
      title: null,
      attribution: null,
      license: null,
      licenseUrl: null,
    });
  });

  it("retains only supplied, human-readable metadata", () => {
    expect(readDemoAudioConfig({
      VITE_DEMO_AUDIO_URL: "https://audio.example/demo.ogg",
      VITE_DEMO_AUDIO_TITLE: "Night Signal",
      VITE_DEMO_AUDIO_ATTRIBUTION: "A. Example",
      VITE_DEMO_AUDIO_LICENSE: "CC BY 4.0",
      VITE_DEMO_AUDIO_LICENSE_URL: "https://creativecommons.org/licenses/by/4.0/",
    })).toMatchObject({
      available: true,
      title: "Night Signal",
      attribution: "A. Example",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    });
  });

  it("leaves the sample unavailable without a valid external http(s) URL", () => {
    expect(readDemoAudioConfig({ VITE_DEMO_AUDIO_URL: "data:audio/ogg;base64,abc" })).toEqual({
      available: false,
      reason: "Set VITE_DEMO_AUDIO_URL to an absolute http(s) URL for a licensed sample.",
    });
  });
});
