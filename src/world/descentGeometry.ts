import { BufferAttribute, BufferGeometry } from "three";

/** A fixed seed keeps the spatial composition reproducible across visits. */
function randomStream(seed: number): () => number {
  let state = seed;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223 | 0;
    return (state >>> 0) / 4294967296;
  };
}

export function createContourGeometry(): BufferGeometry {
  const rings = 64;
  const segments = 256;
  const positions = new Float32Array(rings * (segments + 1) * 2 * 3);
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const depth = (ring + 0.22 * Math.sin(ring * 2.4)) / rings * 180;
    for (let segment = 0; segment <= segments; segment++) {
      for (let side = 0; side < 2; side++) {
        const vertex = (ring * (segments + 1) + segment) * 2 + side;
        // position encodes angle, persistent layer depth, and ribbon edge.
        positions[vertex * 3] = segment / segments * Math.PI * 2;
        positions[vertex * 3 + 1] = depth;
        positions[vertex * 3 + 2] = side * 2 - 1;
      }
      if (segment < segments) {
        const a = (ring * (segments + 1) + segment) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

export function createMoteGeometry(): BufferGeometry {
  const random = randomStream(83019);
  const positions = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 3 + random() * 22;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = random() * 180;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  return geometry;
}

/** Small cutouts share one mesh but keep their own depth, turn, and musical voice. */
export function createPigmentGeometry(): BufferGeometry {
  const random = randomStream(24108);
  const positions: number[] = [];
  const seeds: number[] = [];
  const pigments: number[] = [];
  for (let index = 0; index < 156; index++) {
    const angle = random() * Math.PI * 2;
    const radius = 3.2 + random() * 15;
    const depth = random() * 180;
    const size = index % 9 === 0 ? 0.8 + random() * 0.65 : 0.15 + random() * 0.48;
    const sides = index % 3 === 0 ? 3 : 5;
    const phase = random() * Math.PI * 2;
    for (let face = 0; face < sides; face++) {
      const a = face / sides * Math.PI * 2;
      const b = (face + 1) / sides * Math.PI * 2;
      const vertices = [[0.12, 0.05, 0.3], [Math.cos(a), Math.sin(a), 0], [Math.cos(b), Math.sin(b), 0]] as const;
      for (const vertex of vertices) {
        positions.push(vertex[0] * size, vertex[1] * size * (index % 4 === 0 ? 1.8 : 0.8), vertex[2] * size);
        seeds.push(Math.cos(angle) * radius, Math.sin(angle) * radius, depth, phase);
        pigments.push(index % 6, index % 3, 0.72 + face / sides * 0.28);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("aSeed", new BufferAttribute(new Float32Array(seeds), 4));
  geometry.setAttribute("aShape", new BufferAttribute(new Float32Array(pigments), 3));
  return geometry;
}
