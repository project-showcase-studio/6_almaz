// Planar mirror: the scene is rendered from the camera reflected in the mirror plane (oblique near plane
// clipped to the glass) and projected back onto the surface, so reflections have correct perspective and
// parallax — the hallway, the bars on the glass and the viewer's surroundings line up as in a real mirror.
// Geometry is in the mesh's local frame with the reflective face at z = 0, facing +z.
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = cameraPosition - wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec3 tint;
  varying vec4 vUv;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vec3 c = texture2DProj(tDiffuse, vUv).rgb;
    // silvered glass: ~88 % reflectance, a touch greener and darker at grazing angles (glass path length)
    float g = 1.0 - clamp(dot(normalize(vN), normalize(vView)), 0.0, 1.0);
    vec3 t = mix(tint, tint * vec3(0.86, 0.93, 0.9), g * g);
    gl_FragColor = vec4(c * t, 1.0);
  }`;

const _p = new THREE.Plane(), _n = new THREE.Vector3(), _rp = new THREE.Vector3(), _cp = new THREE.Vector3();
const _rot = new THREE.Matrix4(), _look = new THREE.Vector3(), _view = new THREE.Vector3(), _target = new THREE.Vector3();
const _clip = new THREE.Vector4(), _q = new THREE.Vector4(), _size = new THREE.Vector2();

export class Mirror extends THREE.Mesh {
  constructor(geometry, { scale = 0.85, tint = '#e0e2e1', clipBias = 0.0015 } = {}) {
    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    const textureMatrix = new THREE.Matrix4();
    const material = new THREE.ShaderMaterial({
      name: 'planarMirror',
      uniforms: { tDiffuse: { value: rt.texture }, textureMatrix: { value: textureMatrix }, tint: { value: new THREE.Color(tint) } },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    super(geometry, material);
    this.isMirror = true;
    this.castShadow = false;
    this.receiveShadow = false;
    const cam = new THREE.PerspectiveCamera();
    this.onBeforeRender = (renderer, scene, camera) => {
      _rp.setFromMatrixPosition(this.matrixWorld);
      _cp.setFromMatrixPosition(camera.matrixWorld);
      _rot.extractRotation(this.matrixWorld);
      _n.set(0, 0, 1).applyMatrix4(_rot).normalize();
      _view.subVectors(_rp, _cp);
      if (_view.dot(_n) > 0) return; // looking at the back
      _view.reflect(_n).negate().add(_rp);
      _rot.extractRotation(camera.matrixWorld);
      _look.set(0, 0, -1).applyMatrix4(_rot).add(_cp);
      _target.subVectors(_rp, _look).reflect(_n).negate().add(_rp);
      cam.position.copy(_view);
      cam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(_n);
      cam.lookAt(_target);
      cam.far = camera.far;
      cam.updateMatrixWorld();
      cam.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse).multiply(this.matrixWorld);
      // oblique near plane on the mirror (nothing behind the glass leaks into the reflection)
      _p.setFromNormalAndCoplanarPoint(_n, _rp).applyMatrix4(cam.matrixWorldInverse);
      _clip.set(_p.normal.x, _p.normal.y, _p.normal.z, _p.constant);
      const e = cam.projectionMatrix.elements;
      _q.set((Math.sign(_clip.x) + e[8]) / e[0], (Math.sign(_clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
      _clip.multiplyScalar(2 / _clip.dot(_q));
      e[2] = _clip.x;
      e[6] = _clip.y;
      e[10] = _clip.z + 1 - clipBias;
      e[14] = _clip.w;
      renderer.getDrawingBufferSize(_size);
      const w = Math.max(16, Math.round(_size.x * scale)), h = Math.max(16, Math.round(_size.y * scale));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      const prevRT = renderer.getRenderTarget(), prevShadow = renderer.shadowMap.autoUpdate, prevXR = renderer.xr.enabled;
      this.visible = false;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(rt);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false) renderer.clear();
      renderer.render(scene, cam);
      renderer.xr.enabled = prevXR;
      renderer.shadowMap.autoUpdate = prevShadow;
      renderer.setRenderTarget(prevRT);
      if (camera.viewport !== undefined) renderer.state.viewport(camera.viewport);
      this.visible = true;
    };
  }
}
