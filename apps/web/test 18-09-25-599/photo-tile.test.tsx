import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotoTile } from '../src/features/intake/components/PhotoTile';
import type { IntakeItem } from '../src/features/intake/intake-reducer';

const item: IntakeItem = {
  key: 'k',
  imageId: 'id',
  filename: 'beach.jpg',
  phase: 'rejected',
  progress: 1,
  localPreviewUrl: null,
  thumbnailUrl: 'https://thumb/beach.webp',
  checks: [
    { code: 'blur', outcome: 'failed', reason: 'blurry', measurement: {} },
    { code: 'face_count', outcome: 'failed', reason: 'multiple_faces', measurement: {} },
    { code: 'face_size', outcome: 'passed', reason: null, measurement: {} },
  ],
  clientRejection: null,
  error: null,
  createdAt: '2026-10-13T10:00:00.000Z',
};

describe('PhotoTile', () => {
  it('shows a short label for every failed check, with the fix on hover', () => {
    render(<PhotoTile item={item} onRemove={vi.fn()} />);

    expect(screen.getByText('Blurry face detected')).toHaveAttribute(
      'title',
      'The photo is too blurry.',
    );
    expect(screen.getByText('More than one face')).toBeInTheDocument();
    expect(screen.queryByText(/Face is too far away/)).not.toBeInTheDocument();
  });

  it('tells the owner a failure is not about their photo', () => {
    render(<PhotoTile item={{ ...item, phase: 'failed', checks: [] }} onRemove={vi.fn()} />);
    expect(screen.getByText("Couldn't check this photo")).toHaveAttribute(
      'title',
      expect.stringMatching(/not with your photo/),
    );
  });

  it('removes by key', () => {
    const onRemove = vi.fn();
    render(<PhotoTile item={item} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove beach.jpg' }));

    expect(onRemove).toHaveBeenCalledWith('k');
  });

  it('overlays upload progress and then the checking state', () => {
    const { rerender } = render(
      <PhotoTile
        item={{ ...item, phase: 'uploading', progress: 0.4, checks: [] }}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Uploading 40%')).toBeInTheDocument();

    rerender(<PhotoTile item={{ ...item, phase: 'processing', checks: [] }} onRemove={vi.fn()} />);
    expect(screen.getByText('Checking')).toBeInTheDocument();
  });
});
