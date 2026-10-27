uniform sampler2D uMap;
uniform vec3 uSunDirLocal;

varying vec3 vLocalNormal;

const float PI = 3.14159265359;

void main() {
  vec3 n = normalize(vLocalNormal);
  float lon = atan(n.z, n.x);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  vec2 uv = vec2(0.5 - lon / (2.0 * PI), 0.5 - lat / PI);
  vec3 surface = texture2D(uMap, uv).rgb;

  float sunDot = dot(n, normalize(uSunDirLocal));
  float day = smoothstep(-0.055, 0.13, sunDot);
  vec3 night = surface * 0.04 + vec3(0.008, 0.009, 0.012);
  vec3 color = mix(night, surface, day);

  // A hint of earthshine on the night side.
  color += vec3(0.012, 0.014, 0.021) * (1.0 - day);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
