import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DatabaseService } from '../database/database.service';
import { TranscodeService } from './transcode.service';
import { VideosService } from './videos.service';

// Sólo cubrimos setLike acá: el resto del servicio (subida, HLS) toca FFmpeg y
// el disco, y se prueba por otros caminos. setLike es pura lógica de DB con
// ramas que vale la pena fijar.
describe('VideosService.setLike', () => {
  let service: VideosService;
  let db: { query: jest.Mock };

  beforeEach(async () => {
    db = { query: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: DatabaseService, useValue: db },
        // setLike no lo usa, pero es dependencia del constructor.
        { provide: TranscodeService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(VideosService);
  });

  it('rechaza un id de video no numérico sin tocar la DB', async () => {
    await expect(service.setLike('abc', 1, true)).rejects.toThrow(
      BadRequestException,
    );
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lanza NotFound si el video no existe', async () => {
    db.query.mockResolvedValueOnce({ rows: [] }); // SELECT existencia

    await expect(service.setLike('7', 1, true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('inserta el like y devuelve el total actualizado', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // existe
      .mockResolvedValueOnce({ rows: [] }) // INSERT ... ON CONFLICT
      .mockResolvedValueOnce({ rows: [{ like_count: 3 }] }); // COUNT

    const result = await service.setLike('7', 42, true);

    expect(result).toEqual({ liked: true, like_count: 3 });
    // La segunda llamada es el INSERT.
    const [insertSql, insertParams] = db.query.mock.calls[1];
    expect(insertSql).toMatch(/INSERT INTO video_likes/);
    expect(insertParams).toEqual([7, 42]);
  });

  it('borra el like cuando liked es false', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] }) // existe
      .mockResolvedValueOnce({ rows: [] }) // DELETE
      .mockResolvedValueOnce({ rows: [{ like_count: 0 }] }); // COUNT

    const result = await service.setLike('7', 42, false);

    expect(result).toEqual({ liked: false, like_count: 0 });
    const [deleteSql, deleteParams] = db.query.mock.calls[1];
    expect(deleteSql).toMatch(/DELETE FROM video_likes/);
    expect(deleteParams).toEqual([7, 42]);
  });
});
