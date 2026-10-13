-- Prisma can't express partial indexes or CHECK constraints, so they live here.

-- Only in-flight rows are indexed, so the claim query stays cheap however many
-- finished images pile up.
CREATE INDEX "images_claimable_idx" ON "images" ("created_at")
  WHERE "status" IN ('pending', 'processing');

CREATE INDEX "images_awaiting_upload_idx" ON "images" ("created_at")
  WHERE "status" = 'awaiting_upload';

ALTER TABLE "images"
  ADD CONSTRAINT "images_original_filename_length" CHECK (char_length("original_filename") BETWEEN 1 AND 255),
  ADD CONSTRAINT "images_declared_size_positive" CHECK ("declared_size_bytes" > 0),
  ADD CONSTRAINT "images_attempts_non_negative" CHECK ("attempts" >= 0);

ALTER TABLE "image_check_results"
  ADD CONSTRAINT "image_check_results_reason_iff_failed" CHECK (("outcome" = 'failed') = ("reason" IS NOT NULL));
