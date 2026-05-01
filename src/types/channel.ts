export interface Block {
  id: number;
  title: string;
  kind: string;
  imageUrl?: string | null;
}

export interface Channel {
  id: string;
  slug: string;
  title: string;
  description: string;
  x: number;
  y: number;
  z: number;
  size: number;
  color: string;
  emissiveIntensity?: number;
  blockCount?: number;
  followerCount?: number;
  neighbors: string[];
  thumbnailUrl?: string | null;
  blocks?: Block[];
}
