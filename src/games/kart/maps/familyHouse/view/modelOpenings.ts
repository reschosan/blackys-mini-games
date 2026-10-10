import * as THREE from 'three';

type Vertex = readonly number[];
type Polygon = readonly Vertex[];
type Plane = { readonly axis: number; readonly boundary: number; readonly direction: number };

function clipPolygon(polygon: Polygon, plane: Plane, inside: boolean): Polygon {
  const result: Vertex[] = [];
  const distance = (vertex: Vertex) => (vertex[plane.axis]! - plane.boundary) * plane.direction;
  for (let index = 0; index < polygon.length; index += 1) {
    const from = polygon[index]!;
    const to = polygon[(index + 1) % polygon.length]!;
    const a = distance(from);
    const b = distance(to);
    const keepA = inside ? a >= 0 : a <= 0;
    const keepB = inside ? b >= 0 : b <= 0;
    if (keepA) result.push(from);
    if (keepA !== keepB) result.push(from.map((value, channel) => value + ((to[channel]! - value) * a) / (a - b)));
  }
  return result;
}

function subtractBox(polygon: Polygon, box: THREE.Box3): Polygon[] {
  const planes: Plane[] = [
    { axis: 0, boundary: box.min.x, direction: 1 },
    { axis: 0, boundary: box.max.x, direction: -1 },
    { axis: 1, boundary: box.min.y, direction: 1 },
    { axis: 1, boundary: box.max.y, direction: -1 },
    { axis: 2, boundary: box.min.z, direction: 1 },
    { axis: 2, boundary: box.max.z, direction: -1 },
  ];
  const result: Polygon[] = [];
  let remainder = polygon;
  for (const plane of planes) {
    const outside = clipPolygon(remainder, plane, false);
    if (outside.length >= 3) result.push(outside);
    remainder = clipPolygon(remainder, plane, true);
    if (remainder.length < 3) break;
  }
  return result;
}

export function geometryWithOpenings(mesh: THREE.Mesh, openings: readonly THREE.Box3[]): THREE.BufferGeometry | null {
  const bounds = new THREE.Box3().setFromObject(mesh);
  const relevant = openings.filter((opening) => opening.intersectsBox(bounds));
  if (relevant.length === 0) return null;
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  source.applyMatrix4(mesh.matrixWorld);
  const names = ['position', ...Object.keys(source.attributes).filter((name) => name !== 'position')];
  let stride = 0;
  const channels = names.map((name) => {
    const attribute = source.getAttribute(name);
    const channel = { name, attribute, offset: stride, size: attribute.itemSize };
    stride += attribute.itemSize;
    return channel;
  });
  const vertices = readVertices(channels, source.getAttribute('position').count);
  const output = cutTriangles(vertices, relevant);
  const geometry = new THREE.BufferGeometry();
  for (const channel of channels) geometry.setAttribute(channel.name, attributeFromVertices(output, stride, channel.offset, channel.size));
  source.dispose();
  return geometry;
}

function cutTriangles(vertices: readonly Vertex[], openings: readonly THREE.Box3[]): number[] {
  const output: number[] = [];
  for (let index = 0; index < vertices.length; index += 3) {
    let polygons: Polygon[] = [vertices.slice(index, index + 3)];
    for (const opening of openings) polygons = polygons.flatMap((polygon) => subtractBox(polygon, opening));
    for (const polygon of polygons) {
      for (let corner = 1; corner < polygon.length - 1; corner += 1) output.push(...polygon[0]!, ...polygon[corner]!, ...polygon[corner + 1]!);
    }
  }
  return output;
}

function attributeFromVertices(vertices: readonly number[], stride: number, start: number, size: number): THREE.Float32BufferAttribute {
  const values: number[] = [];
  for (let offset = 0; offset < vertices.length; offset += stride) values.push(...vertices.slice(offset + start, offset + start + size));
  return new THREE.Float32BufferAttribute(values, size);
}

function readVertices(channels: readonly { attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; size: number }[], count: number): Vertex[] {
  return Array.from({ length: count }, (_, index) =>
    channels.flatMap(({ attribute, size }) => Array.from({ length: size }, (_, component) => attribute.getComponent(index, component))),
  );
}
