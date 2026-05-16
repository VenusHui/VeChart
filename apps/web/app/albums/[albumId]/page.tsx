import { AlbumDetail } from '@/components/album-detail';

export default async function AlbumPage({
  params
}: {
  params: Promise<{ albumId: string }>;
}) {
  const { albumId } = await params;
  return <AlbumDetail albumId={albumId} />;
}
