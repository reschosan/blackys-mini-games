export const OUTSIDE_GRID = -1;

/** A square floor of tiles centred on the origin, numbered row by row. */
export class SquareGrid {
  readonly tileCount: number;
  private readonly half: number;

  constructor(
    readonly side: number,
    readonly tileSize: number,
  ) {
    this.tileCount = side * side;
    this.half = (side * tileSize) / 2;
  }

  /** The tile under a point, or `OUTSIDE_GRID`. */
  tileAt(x: number, z: number): number {
    return this.tileOf(Math.floor((x + this.half) / this.tileSize), Math.floor((z + this.half) / this.tileSize));
  }

  /** The tile at a column and row, or `OUTSIDE_GRID`. */
  tileOf(column: number, row: number): number {
    return this.contains(column, row) ? row * this.side + column : OUTSIDE_GRID;
  }

  columnOf(tile: number): number {
    return tile % this.side;
  }

  rowOf(tile: number): number {
    return Math.floor(tile / this.side);
  }

  centreOf(tile: number): { x: number; z: number } {
    return {
      x: this.columnOf(tile) * this.tileSize - this.half + this.tileSize / 2,
      z: this.rowOf(tile) * this.tileSize - this.half + this.tileSize / 2,
    };
  }

  private contains(column: number, row: number): boolean {
    return column >= 0 && row >= 0 && column < this.side && row < this.side;
  }
}
