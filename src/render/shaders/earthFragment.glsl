uniform sampler2D uMap;
uniform vec3 uSunDirLocal;
uniform float uTerminator;
uniform vec3 uAtmosphereColor;

varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

const float PI = 3.14159265359;

void main() {
  vec3 n = normalize(vLocalNormal);
  float lon = atan(n.z, n.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 - lon / (2.0 * PI), 0.5 - lat / PI);
  vec3 surface = texture2D(uMap, uv).rgb;

  float sunDot = dot(n, normalize(uSunDirLocal));
  float day = smoothstep(-0.11, 0.16, sunDot);
  day = mix(1.0, day, uTerminator);

  vec3 night = surface * vec3(0.05, 0.075, 0.13) + vec3(0.004, 0.009, 0.024);
  vec3 color = mix(night, surface, day);

  float twilight = smoothstep(-0.24, -0.02, sunDot) * (1.0 - smoothstep(0.0, 0.22, sunDot));
  color += vec3(0.2, 0.075, 0.02) * twilight * uTerminator;

  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - max(dot(normalize(vWorldNormal), viewDir), 0.0), 3.0);
  color += uAtmosphereColor * rim * day * 0.42;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
