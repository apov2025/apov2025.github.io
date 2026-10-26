// Shape the back of the slim concept into a broad, gently crowned surface.
// Front geometry, maximum central thickness, and the connector land stay fixed.
export function roundPrototypeBack(geometry, { width = 76.0086455331412, height = 125 } = {}) {
  const mesh = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const attributes = Object.entries(mesh.attributes);
  if (attributes.some(([, attribute]) => attribute.isInterleavedBufferAttribute)) throw new Error('Expected non-interleaved source geometry');
  const stride = attributes.reduce((sum, [, attribute]) => sum + attribute.itemSize, 0);
  const offsets = {};
  let offset = 0;
  for (const [name, attribute] of attributes) { offsets[name] = offset; offset += attribute.itemSize; }
  const data = Object.fromEntries(attributes.map(([name]) => [name, []]));
  const position = offsets.position, normal = offsets.normal;
  const shoulderStart = -1.85;
  const halfWidth = width / 2, halfHeight = height / 2;
  function read(index) {
    const vertex = [];
    for (const [, attribute] of attributes) for (let i = 0; i < attribute.itemSize; i++) vertex.push(attribute.array[index * attribute.itemSize + i]);
    return vertex;
  }
  function distanceSquared(a, b) {
    return (a[position] - b[position]) ** 2 + (a[position + 1] - b[position + 1]) ** 2 + (a[position + 2] - b[position + 2]) ** 2;
  }
  function displacement(x, y, z) {
    // Restore the shallow rear crown; front shoulders and control lands stay fixed.
    if (z >= shoulderStart) return 0;
    const range = shoulderStart + 3.1;
    const t = Math.max(0, Math.min(1, (shoulderStart - z) / range));
    const nx = x / halfWidth, ny = y / halfHeight;
    const radial = 1 - (1 - nx * nx) * (1 - ny * ny);
    return 1.05 * radial * t ** 1.15;
  }
  function emit(vertex) {
    const x = vertex[position], y = vertex[position + 1], z = vertex[position + 2];
    if (z < shoulderStart) {
      const delta = .0001;
      const fx = (displacement(x + delta,y,z) - displacement(x - delta,y,z)) / (2 * delta);
      const fy = (displacement(x,y + delta,z) - displacement(x,y - delta,z)) / (2 * delta);
      const fz = (displacement(x,y,z + delta) - displacement(x,y,z - delta)) / (2 * delta);
      if (1 + fz <= 0) throw new Error('Rear profile folded over');
      vertex[position + 2] = z + displacement(x,y,z);
      // Inverse-transpose Jacobian preserves the debossed wordmark and smooth normals.
      const nz = vertex[normal + 2] / (1 + fz);
      const vx = vertex[normal] - fx * nz, vy = vertex[normal + 1] - fy * nz;
      const length = Math.hypot(vx, vy, nz);
      vertex[normal] = vx / length; vertex[normal + 1] = vy / length; vertex[normal + 2] = nz / length;
    }
    for (const [name, attribute] of attributes) for (let i = 0; i < attribute.itemSize; i++) data[name].push(vertex[offsets[name] + i]);
  }
  function triangle(a, b, c) {
    const rear = Math.min(a[position + 2], b[position + 2], c[position + 2]) < shoulderStart;
    const edges = [distanceSquared(a,b), distanceSquared(b,c), distanceSquared(c,a)];
    const longest = Math.max(...edges);
    // Subdivide only the broad rear triangles so its crown is geometric,
    // rather than a lighting trick over the original planar triangle fan.
    if (rear && longest > 36) {
      const index = edges.indexOf(longest);
      const [u,v,w] = index === 0 ? [a,b,c] : index === 1 ? [b,c,a] : [c,a,b];
      const mid = Array.from({ length: stride }, (_, i) => (u[i] + v[i]) / 2);
      triangle(u,mid,w); triangle(mid,v,w);
    } else { emit(a.slice()); emit(b.slice()); emit(c.slice()); }
  }
  for (let index = 0; index < mesh.attributes.position.count; index += 3) triangle(read(index),read(index+1),read(index+2));
  for (const [name, attribute] of attributes) mesh.setAttribute(name, new attribute.constructor(new Float32Array(data[name]), attribute.itemSize));
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
}
