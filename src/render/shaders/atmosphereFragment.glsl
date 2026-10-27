uniform vec3 uSunDirLocal;
uniform vec3 uColor;

varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vec3 worldNormal = normalize(vWorldNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float rim = pow(1.0 - abs(dot(worldNormal, viewDir)), 3.0);
  float sun = smoothstep(-0.18, 0.35, dot(normalize(vLocalNormal), normalize(uSunDirLocal)));
  float alpha = rim * sun * 0.65;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
