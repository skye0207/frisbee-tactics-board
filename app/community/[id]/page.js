import CommunityTacticViewer from '@/components/CommunityTacticViewer';

export default async function CommunityTacticPage({ params }) {
  const { id } = await params;
  return <CommunityTacticViewer tacticId={id} />;
}
