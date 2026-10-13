-- CreateEnum
CREATE TYPE "image_status" AS ENUM ('awaiting_upload', 'pending', 'processing', 'accepted', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "image_format" AS ENUM ('jpeg', 'png', 'heic');

-- CreateEnum
CREATE TYPE "check_code" AS ENUM ('file_size', 'format', 'resolution', 'blur', 'face_count', 'face_size', 'similarity');

-- CreateEnum
CREATE TYPE "check_outcome" AS ENUM ('passed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "rejection_reason" AS ENUM ('file_too_small', 'file_too_large', 'unsupported_format', 'unreadable_image', 'resolution_too_low', 'resolution_too_high', 'blurry', 'no_face', 'multiple_faces', 'face_too_small', 'too_similar');

-- CreateTable
CREATE TABLE "owners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "image_status" NOT NULL DEFAULT 'awaiting_upload',
    "original_filename" TEXT NOT NULL,
    "declared_mime_type" TEXT NOT NULL,
    "declared_size_bytes" INTEGER NOT NULL,
    "size_bytes" INTEGER,
    "format" "image_format",
    "width" INTEGER,
    "height" INTEGER,
    "fingerprint" BIGINT,
    "original_key" TEXT NOT NULL,
    "normalized_key" TEXT,
    "thumbnail_key" TEXT,
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMPTZ(3),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_check_results" (
    "image_id" UUID NOT NULL,
    "check_code" "check_code" NOT NULL,
    "outcome" "check_outcome" NOT NULL,
    "reason" "rejection_reason",
    "measurement" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "image_check_results_pkey" PRIMARY KEY ("image_id","check_code")
);

-- CreateIndex
CREATE INDEX "images_owner_status_created_idx" ON "images"("owner_id", "status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "images_owner_created_idx" ON "images"("owner_id", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_check_results" ADD CONSTRAINT "image_check_results_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE ON UPDATE CASCADE;
