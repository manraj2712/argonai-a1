import type { RequestHandler } from 'express';
import {
  createImagesRequestSchema,
  imageIdParamsSchema,
  listImagesQuerySchema,
  type CreateImagesResponse,
  type ImageResponse,
  type ListImagesResponse,
} from '@image-intake/shared';
import { ownerIdOf } from '../../core/http/owner-session.js';
import { parseRequest } from '../../core/http/parse-request.js';
import type { ImagesService } from './images.service.js';

export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  create: RequestHandler = async (req, res) => {
    const body = parseRequest(createImagesRequestSchema, req.body);
    const items = await this.images.createUploadSlots(ownerIdOf(req), body);
    res.status(201).json({ items } satisfies CreateImagesResponse);
  };

  complete: RequestHandler = async (req, res) => {
    const { id } = parseRequest(imageIdParamsSchema, req.params);
    const image = await this.images.completeUpload(ownerIdOf(req), id);
    res.status(202).json({ image } satisfies ImageResponse);
  };

  list: RequestHandler = async (req, res) => {
    const query = parseRequest(listImagesQuerySchema, req.query);
    const page = await this.images.list(ownerIdOf(req), {
      statuses: query.status,
      limit: query.limit,
      cursor: query.cursor,
    });
    res.json(page satisfies ListImagesResponse);
  };

  get: RequestHandler = async (req, res) => {
    const { id } = parseRequest(imageIdParamsSchema, req.params);
    const image = await this.images.get(ownerIdOf(req), id);
    res.json({ image } satisfies ImageResponse);
  };

  remove: RequestHandler = async (req, res) => {
    const { id } = parseRequest(imageIdParamsSchema, req.params);
    await this.images.delete(ownerIdOf(req), id);
    res.status(204).end();
  };
}
