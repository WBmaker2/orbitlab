varying vec3 vLocalNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main() {
  vLocalNormal = normalize(position);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
