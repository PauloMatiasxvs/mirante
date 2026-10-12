import { PostProcessStage, type Viewer } from 'cesium';
import type { VisionMode } from './types';

const SHADERS: Partial<Record<VisionMode, string>> = {
  // Green phosphor luminance with grain, scanlines and a tube vignette.
  night: /* glsl */ `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;

    float noise(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 color = texture(colorTexture, v_textureCoordinates).rgb;
      float luma = pow(dot(color, vec3(0.299, 0.587, 0.114)), 0.75) * 1.4;
      float grain = noise(v_textureCoordinates * czm_viewport.zw + mod(czm_frameNumber, 97.0)) - 0.5;
      float scan = 0.9 + 0.1 * sin(v_textureCoordinates.y * czm_viewport.w * 1.4);
      float vignette = smoothstep(0.82, 0.25, length(v_textureCoordinates - 0.5));
      out_FragColor = vec4(vec3(0.32, 1.0, 0.42) * (luma + grain * 0.14) * scan * vignette, 1.0);
    }
  `,

  // Luminance mapped onto an "iron" palette, like a thermal camera.
  thermal: /* glsl */ `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;

    vec3 palette(float t) {
      vec3 c = mix(vec3(0.02, 0.0, 0.08), vec3(0.38, 0.0, 0.55), smoothstep(0.0, 0.25, t));
      c = mix(c, vec3(0.86, 0.1, 0.28), smoothstep(0.25, 0.5, t));
      c = mix(c, vec3(1.0, 0.55, 0.0), smoothstep(0.5, 0.75, t));
      return mix(c, vec3(1.0, 0.96, 0.7), smoothstep(0.75, 1.0, t));
    }

    void main() {
      vec3 color = texture(colorTexture, v_textureCoordinates).rgb;
      float luma = dot(color, vec3(0.299, 0.587, 0.114));
      out_FragColor = vec4(palette(clamp(luma * 1.25, 0.0, 1.0)), 1.0);
    }
  `,
};

export function createVisionModes(viewer: Viewer) {
  let stage: PostProcessStage | null = null;
  return {
    apply(mode: VisionMode) {
      if (stage) viewer.scene.postProcessStages.remove(stage);
      stage = null;
      const fragmentShader = SHADERS[mode];
      if (fragmentShader) {
        stage = new PostProcessStage({ fragmentShader });
        viewer.scene.postProcessStages.add(stage);
      }
    },
  };
}
