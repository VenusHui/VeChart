import { ShareDocumentView } from '@/components/share-document-view';

export default async function SharePage({
  params
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <ShareDocumentView shareId={shareId} />;
}
