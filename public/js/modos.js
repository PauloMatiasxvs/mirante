// Modos de visão aplicados como pós-processamento (shaders) sobre o globo.

const { Cesium } = window;

const SHADERS = {
  // Visão noturna: luminância em verde fósforo, granulado, linhas e vinheta.
  noturna: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;

    float ruido(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 cor = texture(colorTexture, v_textureCoordinates).rgb;
      float luz = pow(dot(cor, vec3(0.299, 0.587, 0.114)), 0.75) * 1.4;
      float grao = ruido(v_textureCoordinates * czm_viewport.zw + mod(czm_frameNumber, 97.0)) - 0.5;
      float linhas = 0.9 + 0.1 * sin(v_textureCoordinates.y * czm_viewport.w * 1.4);
      float vinheta = smoothstep(0.82, 0.25, length(v_textureCoordinates - 0.5));
      vec3 verde = vec3(0.32, 1.0, 0.42) * (luz + grao * 0.14) * linhas * vinheta;
      out_FragColor = vec4(verde, 1.0);
    }
  `,

  // Térmica: luminância mapeada numa paleta "ferro em brasa".
  termica: `
    uniform sampler2D colorTexture;
    in vec2 v_textureCoordinates;

    vec3 paleta(float t) {
      vec3 c = mix(vec3(0.02, 0.0, 0.08), vec3(0.38, 0.0, 0.55), smoothstep(0.0, 0.25, t));
      c = mix(c, vec3(0.86, 0.1, 0.28), smoothstep(0.25, 0.5, t));
      c = mix(c, vec3(1.0, 0.55, 0.0), smoothstep(0.5, 0.75, t));
      return mix(c, vec3(1.0, 0.96, 0.7), smoothstep(0.75, 1.0, t));
    }

    void main() {
      vec3 cor = texture(colorTexture, v_textureCoordinates).rgb;
      float luz = dot(cor, vec3(0.299, 0.587, 0.114));
      out_FragColor = vec4(paleta(clamp(luz * 1.25, 0.0, 1.0)), 1.0);
    }
  `,
};

let estagioAtual = null;

export function aplicarModo(viewer, modo) {
  if (estagioAtual) {
    viewer.scene.postProcessStages.remove(estagioAtual);
    estagioAtual = null;
  }
  if (SHADERS[modo]) {
    estagioAtual = viewer.scene.postProcessStages.add(
      new Cesium.PostProcessStage({ fragmentShader: SHADERS[modo] }),
    );
  }
  document.body.dataset.modo = modo;
}
