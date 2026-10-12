import type Phaser from 'phaser';
import { game } from '../../state';
import type { PetKind } from '../../pet';
import type { Point } from '../../pathfinding';

// 탐험 화면(GameScene)과 그 도우미 파일들이 같이 쓰는 작은 함수들

export type MapObject = Phaser.Types.Tilemaps.TiledObject;

// 지도 물체에 붙은 사용자 정의 값 (예: 길목의 도착 지도 이름)
export function prop(obj: MapObject, name: string): string | undefined {
  return (obj.properties as { name: string; value: string }[] | undefined)?.find((p) => p.name === name)?.value;
}

// 그 동물이 이미 동료인지
export function hasPet(kind: PetKind) {
  const s = game.state;
  return kind === 'frog' ? s.frog : kind === 'parrot' ? s.parrot : kind === 'hamster' ? s.hamster : s.pet;
}

// 지도 물체의 가운데 (점이면 그 점, 칸 범위면 범위 가운데)
export function center(o: MapObject): Point {
  return { x: o.x! + (o.width ?? 0) / 2, y: o.y! + (o.height ?? 0) / 2 };
}
